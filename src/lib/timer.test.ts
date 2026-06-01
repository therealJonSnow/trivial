import { describe, it, expect } from "vitest";
import {
  armClock,
  deriveTimer,
  pauseClock,
  resumeClock,
  firstGunEpoch,
  GO_HOLD_MS,
  PRE_ROLL_MS,
} from "./timer";
import { buildSchedule } from "./schedule";
import type { BoatClass } from "./types";

function boat(name: string, py: number): BoatClass {
  return {
    id: py,
    name,
    py,
    category: "dinghy",
    crew: 1,
    rig: "U",
    spinnaker: false,
    change: 0,
    notes: "",
  };
}

const schedule = buildSchedule([boat("RS800", 797), boat("Mirror", 1364)], 60)!;
const WARN = 5 * 60_000; // 5-4-1 sequence lead-in
const GUN = 1_000_000; // arbitrary epoch for the first gun
// startedAt so that firstGunEpoch === GUN
const clock = armClock(GUN - WARN, "5-4-1");

describe("phase detection", () => {
  it("firstGunEpoch accounts for the sequence lead-in + postponement", () => {
    expect(firstGunEpoch(clock)).toBe(GUN);
  });

  it("3-2-1 sequence is a 3-minute lead-in with 3/2/1 milestones", () => {
    const c = armClock(0, "3-2-1");
    expect(c.warningMs).toBe(3 * 60_000);
    // 2:30 into the lead-in → past the 3-min signal, before the 2-min signal
    const v = deriveTimer(c, schedule, 30_000);
    expect(v.phase).toBe("warning");
    expect(v.activeMilestoneMs).toBe(3 * 60_000);
    // 1:30 to go → 2-min signal segment
    const v2 = deriveTimer(c, schedule, 90_000);
    expect(v2.activeMilestoneMs).toBe(2 * 60_000);
  });

  it("is in the warning phase before the first gun", () => {
    const v = deriveTimer(clock, schedule, GUN - WARN); // just tapped Start
    expect(v.phase).toBe("warning");
    expect(v.countdownMs).toBe(WARN);
    expect(v.activeMilestoneMs).toBe(5 * 60_000);
  });

  it("lights the 4:00 milestone (5-4-1) between 4 and 1 minutes to go", () => {
    const v = deriveTimer(clock, schedule, GUN - 3 * 60_000); // 3:00 to go
    expect(v.activeMilestoneMs).toBe(4 * 60_000);
  });

  it("lights the 1:00 milestone at one minute to go", () => {
    const v = deriveTimer(clock, schedule, GUN - 60_000);
    expect(v.activeMilestoneMs).toBe(60_000);
  });

  it("enters the race phase and flashes GO at the first gun", () => {
    const v = deriveTimer(clock, schedule, GUN);
    expect(v.phase).toBe("race");
    expect(v.flashing?.classes[0]?.name).toBe("Mirror"); // earliest start
    expect(v.startedOrders).toContain(1);
    expect(v.nextStart?.isScratch).toBe(true);
  });

  it("stops flashing once GO_HOLD has elapsed", () => {
    const v = deriveTimer(clock, schedule, GUN + GO_HOLD_MS + 1);
    expect(v.flashing).toBeNull();
  });

  it("reaches finished at scratch start + duration", () => {
    const v = deriveTimer(clock, schedule, GUN + schedule.finishFromFirstGunMs);
    expect(v.phase).toBe("finished");
    expect(v.toFinishMs).toBe(0);
  });
});

describe("pre-roll count-in", () => {
  // Armed with a 10s pre-roll so firstGunEpoch === GUN.
  const pre = armClock(GUN - WARN - PRE_ROLL_MS, "5-4-1", PRE_ROLL_MS);

  it("firstGunEpoch includes the pre-roll lead", () => {
    expect(firstGunEpoch(pre)).toBe(GUN);
  });

  it("is in the preroll phase during the count-in, counting to the first signal", () => {
    const v = deriveTimer(pre, schedule, GUN - WARN - PRE_ROLL_MS); // just confirmed
    expect(v.phase).toBe("preroll");
    expect(v.countdownMs).toBe(PRE_ROLL_MS); // 0:10 to first signal, not 5:10
    expect(v.msToNextHorn).toBe(PRE_ROLL_MS); // first signal is the next horn
  });

  it("transitions to warning at the first signal", () => {
    const v = deriveTimer(pre, schedule, GUN - WARN); // end of count-in
    expect(v.phase).toBe("warning");
    expect(v.countdownMs).toBe(WARN);
  });
});

describe("horn anticipation + takeover", () => {
  it("a sequence signal takes over for SIGNAL_HOLD, then resumes", () => {
    const atSignal = deriveTimer(clock, schedule, GUN - 4 * 60_000); // 4:00 signal
    expect(atSignal.signalFlashMs).toBe(4 * 60_000);
    expect(atSignal.takeoverKey).toBe("sig:240000");
    expect(atSignal.flashing).toBeNull();

    const after = deriveTimer(clock, schedule, GUN - 4 * 60_000 + 3_500);
    expect(after.signalFlashMs).toBeNull();
    expect(after.takeoverKey).toBeNull();
  });

  it("the first gun is a boat-start takeover, not a signal", () => {
    const v = deriveTimer(clock, schedule, GUN);
    expect(v.signalFlashMs).toBeNull();
    expect(v.takeoverKey).toBe("boat:1");
  });

  it("msToNextHorn targets the next signal 10s before it fires", () => {
    const v = deriveTimer(clock, schedule, GUN - 4 * 60_000 - 10_000); // 10s to 4:00 signal
    expect(v.msToNextHorn).toBe(10_000);
  });

  it("msToNextHorn targets the upcoming boat start during the race", () => {
    const scratch = schedule.starts.find((s) => s.isScratch)!;
    const v = deriveTimer(clock, schedule, GUN + scratch.startFromFirstGunMs - 8_000);
    expect(v.msToNextHorn).toBeCloseTo(8_000, 5);
  });
});

describe("postponement (pause)", () => {
  it("shifts the first gun later by the paused duration", () => {
    let c = pauseClock(clock, GUN - 100_000); // pause with 100s of warning left
    c = resumeClock(c, GUN - 100_000 + 30_000); // resume 30s later
    expect(firstGunEpoch(c)).toBe(GUN + 30_000);
    const v = deriveTimer(c, schedule, GUN - 100_000 + 30_000);
    expect(v.phase).toBe("warning");
    expect(v.countdownMs).toBe(100_000); // still 100s to go, not 70s
  });

  it("freezes the countdown while paused", () => {
    const c = pauseClock(clock, GUN - 90_000);
    const a = deriveTimer(c, schedule, GUN - 90_000);
    const b = deriveTimer(c, schedule, GUN - 10_000); // wall clock advanced
    expect(a.countdownMs).toBe(b.countdownMs); // frozen at pause instant
    expect(b.paused).toBe(true);
  });
});
