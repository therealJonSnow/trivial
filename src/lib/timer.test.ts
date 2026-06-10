import { describe, it, expect } from "vitest";
import {
  armClock,
  deriveTimer,
  pauseClock,
  resumeClock,
  firstGunEpoch,
  GO_HOLD_MS,
  PRE_ROLL_MS,
  RAPID_WINDOW_MS,
  FLASH_MS,
  rapidCluster,
  IMMINENT_MS,
  snapRaceTimeline,
  syncedDisplayMsToFirstGun,
  syncedDisplayMsToStart,
} from "./timer";
import { formatRaceStopwatch } from "./format";
import { deriveStartCardState } from "@/components/StartCard";
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

  it("GO sequence has no lead-in and enters race immediately", () => {
    const c = armClock(GUN, "GO", 0);
    expect(c.warningMs).toBe(0);
    expect(firstGunEpoch(c)).toBe(GUN);
    const v = deriveTimer(c, schedule, GUN);
    expect(v.phase).toBe("race");
    expect(v.flashing?.classes[0]?.name).toBe("Mirror");
    expect(v.signalFlashMs).toBeNull();
  });

  it("10-5-4-1 sequence is a 10-minute lead-in with 10/5/4/1 milestones", () => {
    const c = armClock(0, "10-5-4-1");
    expect(c.warningMs).toBe(10 * 60_000);
    const v = deriveTimer(c, schedule, 2 * 60_000); // 8:00 to go
    expect(v.phase).toBe("warning");
    expect(v.activeMilestoneMs).toBe(10 * 60_000);
    const v2 = deriveTimer(c, schedule, 5 * 60_000); // 5:00 to go
    expect(v2.activeMilestoneMs).toBe(5 * 60_000);
    const v3 = deriveTimer(c, schedule, 6 * 60_000); // 4:00 to go
    expect(v3.activeMilestoneMs).toBe(4 * 60_000);
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

  it("reaches finished at first gun + duration", () => {
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

  it("counts the finish gun in as the next horn once all boats have started", () => {
    const v = deriveTimer(clock, schedule, GUN + schedule.finishFromFirstGunMs - 8_000);
    expect(v.nextStart).toBeNull(); // every boat already away
    expect(v.msToNextHorn).toBeCloseTo(8_000, 5);
  });

  it("the finish gun takes over for GO_HOLD, then settles silently", () => {
    const atFinish = deriveTimer(clock, schedule, GUN + schedule.finishFromFirstGunMs);
    expect(atFinish.phase).toBe("finished");
    expect(atFinish.finishFlash).toBe(true);
    expect(atFinish.takeoverKey).toBe("finish");

    const settled = deriveTimer(clock, schedule, GUN + schedule.finishFromFirstGunMs + GO_HOLD_MS);
    expect(settled.finishFlash).toBe(false);
    expect(settled.takeoverKey).toBeNull();
    expect(settled.msToNextHorn).toBeNull(); // nothing left to signal
  });
});

describe("rapid-start burst", () => {
  // Anchor at the first gun, then three near-coincident starts 6s apart at
  // +10:00 / +10:06 / +10:12 — a 3-member cluster well within RAPID_WINDOW.
  const burstSchedule = buildSchedule(
    [boat("Anchor", 1200), boat("Alpha", 1000), boat("Bravo", 998), boat("Charlie", 996)],
    60,
  )!;
  const ALPHA = 600_000; // +10:00
  const BRAVO = 606_000; // +10:06
  const CHARLIE = 612_000; // +10:12

  it("computed start times are untouched by burst handling", () => {
    // Raw (unrounded) ms — burst is purely a view concern and never mutates them.
    expect(burstSchedule.starts.map((s) => Math.round(s.startFromFirstGunMs))).toEqual([
      0,
      ALPHA,
      BRAVO,
      CHARLIE,
    ]);
    expect(RAPID_WINDOW_MS).toBeGreaterThanOrEqual(BRAVO - ALPHA);
  });

  it("collapses the near-coincident run into one burst, suppressing the single GO", () => {
    const v = deriveTimer(clock, burstSchedule, GUN + ALPHA);
    expect(v.flashing).toBeNull(); // the per-member flash replaces it
    expect(v.burst).not.toBeNull();
    expect(v.burst!.members.map((m) => m.order)).toEqual([2, 3, 4]); // Anchor (gun) excluded
    expect(v.burst!.justFired.order).toBe(2);
    expect(v.burst!.pulse).toBe(true);
    expect(v.burst!.next?.order).toBe(3);
    expect(v.burst!.afterNext?.order).toBe(4);
    expect(v.burst!.msToNext).toBe(BRAVO - ALPHA);
    expect(v.takeoverKey).toBe("boat:2"); // Alpha's own horn
  });

  it("flash is momentary, then a live countdown to the next horn", () => {
    const v = deriveTimer(clock, burstSchedule, GUN + ALPHA + FLASH_MS);
    expect(v.burst!.pulse).toBe(false);
    expect(v.burst!.msToNext).toBe(BRAVO - ALPHA - FLASH_MS);
  });

  it("each member fires its own horn on its own second", () => {
    const v = deriveTimer(clock, burstSchedule, GUN + BRAVO);
    expect(v.burst!.justFired.order).toBe(3);
    expect(v.burst!.pulse).toBe(true);
    expect(v.takeoverKey).toBe("boat:3"); // key flipped → a fresh horn for Bravo
    expect(v.burst!.next?.order).toBe(4);
    expect(v.burst!.afterNext).toBeNull();
  });

  it("holds an 'all away' tail after the last member, then clears", () => {
    const tail = deriveTimer(clock, burstSchedule, GUN + CHARLIE + 2_000);
    expect(tail.burst!.justFired.order).toBe(4);
    expect(tail.burst!.next).toBeNull();
    expect(tail.burst!.msToNext).toBeNull();
    expect(tail.burst!.pulse).toBe(false);

    // One GO_HOLD past the last member, the cluster has cleared.
    const cleared = deriveTimer(clock, burstSchedule, GUN + CHARLIE + GO_HOLD_MS + 1_000);
    expect(cleared.burst).toBeNull();
  });

  it("bursts within the rapid window, but not beyond it", () => {
    // ΔPY 3 → starts 9,000ms apart, comfortably inside RAPID_WINDOW.
    const tight = buildSchedule(
      [boat("Anchor", 1200), boat("T1", 1000), boat("T2", 997)],
      60,
    )!;
    const atTight = deriveTimer(clock, tight, GUN + ALPHA);
    expect(atTight.burst).not.toBeNull();
    expect(atTight.burst!.members).toHaveLength(2);

    // ΔPY 5 → 15,000ms apart (> window): independent single GOs, no burst.
    const wide = buildSchedule(
      [boat("Anchor", 1200), boat("W1", 1000), boat("W2", 995)],
      60,
    )!;
    const atWide = deriveTimer(clock, wide, GUN + ALPHA);
    expect(atWide.burst).toBeNull();
    expect(atWide.flashing?.order).toBe(2);
    expect(atWide.takeoverKey).toBe("boat:2");
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

describe("rapidCluster", () => {
  it("groups adjacent starts within the rapid window", () => {
    const starts = buildSchedule(
      [boat("A", 1200), boat("B", 1000), boat("C", 997)],
      60,
    )!.starts;
    expect(rapidCluster(starts, starts[1]!)).toHaveLength(2);
    expect(rapidCluster(starts, starts[0]!)).toHaveLength(1);
  });
});

describe("deriveStartCardState", () => {
  const three = buildSchedule(
    [boat("A", 1200), boat("B", 1000), boat("C", 997)],
    60,
  )!;

  it("gives each focused boat its own countdown and imminent threshold", () => {
    const msSince = three.starts[1]!.startFromFirstGunMs - IMMINENT_MS; // B at 10s
    const view = deriveTimer(clock, three, GUN + msSince);
    const b = three.starts[1]!;
    const c = three.starts[2]!;

    const bState = deriveStartCardState(b, view, view.msSinceFirstGun, true);
    const cState = deriveStartCardState(c, view, view.msSinceFirstGun, true);

    expect(bState).toEqual({ kind: "countdown", imminent: true });
    expect(cState).toEqual({ kind: "countdown", imminent: false });
  });

  it("shows imminent countdown in the queue when a boat enters its own window", () => {
    const two = buildSchedule([boat("A", 1200), boat("B", 1100)], 60)!;
    const view = deriveTimer(clock, two, GUN + two.starts[1]!.startFromFirstGunMs - 5_000);
    const state = deriveStartCardState(two.starts[1]!, view, view.msSinceFirstGun, false);
    expect(state).toEqual({ kind: "countdown", imminent: true });
  });

  it("ticks every card display on the same race-second boundary", () => {
    const starts = three.starts;
    const b = starts[1]!;
    const c = starts[2]!;
    const snap = 9_000;
    const display = (ms: number) => ({
      b: formatRaceStopwatch(syncedDisplayMsToStart(b.startFromFirstGunMs, ms)),
      c: formatRaceStopwatch(syncedDisplayMsToStart(c.startFromFirstGunMs, ms)),
    });
    const atSnap = display(snap + 999);
    const stillSnap = display(snap + 500);
    const nextSnap = display(snap + 1000);
    expect(atSnap).toEqual(stillSnap);
    expect(nextSnap.b).not.toBe(atSnap.b);
    expect(nextSnap.c).not.toBe(atSnap.c);
    expect(snapRaceTimeline(snap + 1000)).toBe(snapRaceTimeline(snap) + 1000);
  });

  it("counts down to first gun on the same stopwatch grid", () => {
    const msSince = -5_500;
    const before = formatRaceStopwatch(syncedDisplayMsToFirstGun(msSince));
    const after = formatRaceStopwatch(syncedDisplayMsToFirstGun(msSince + 1000));
    expect(before).toBe("0:06");
    expect(after).toBe("0:05");
  });
});
