import { describe, it, expect } from "vitest";
import {
  computeStartFromFirstGunMs,
  buildSchedule,
  startTime,
  frameFromSchedule,
} from "./schedule";
import { formatMmSs } from "./format";
import type { BoatClass, Category } from "./types";

let nextId = 1;
function boat(name: string, py: number, category: Category = "dinghy"): BoatClass {
  return {
    id: nextId++,
    name,
    py,
    category,
    crew: 1,
    rig: "U",
    spinnaker: false,
    change: 0,
    notes: "",
  };
}

describe("computeStartFromFirstGunMs", () => {
  it("matches the spec worked example (RS800 vs slowest Mirror) → 24:56", () => {
    const durationMs = 60 * 60_000;
    // slowest = Mirror (1364); the RS800 (797) starts this long after the first gun.
    const start = computeStartFromFirstGunMs(durationMs, 1364, 797);
    // 60min × (1 − 797/1364) = 1,496,481.…ms
    expect(start).toBeCloseTo(1_496_481.2, 0);
    expect(formatMmSs(start)).toBe("24:56");
  });

  it("is zero for the slowest boat (class PY === slowest PY) — the first gun", () => {
    expect(computeStartFromFirstGunMs(60 * 60_000, 1364, 1364)).toBe(0);
  });

  it("starts faster (lower PY) classes later", () => {
    const d = 60 * 60_000;
    // RS800 (797) starts later than the Laser (1100) in a fleet whose slowest is 1364.
    expect(computeStartFromFirstGunMs(d, 1364, 1100)).toBeLessThan(
      computeStartFromFirstGunMs(d, 1364, 797),
    );
  });

  it("is negative for a class slower than the slowest reference (already passed)", () => {
    expect(computeStartFromFirstGunMs(60 * 60_000, 1364, 1600)).toBeLessThan(0);
  });
});

describe("buildSchedule", () => {
  it("returns null for an empty fleet", () => {
    expect(buildSchedule([], 60)).toBeNull();
  });

  it("handles a single class as both scratch and slowest, starting at the first gun", () => {
    const s = buildSchedule([boat("Solo", 1142)], 60);
    expect(s).not.toBeNull();
    expect(s?.starts).toHaveLength(1);
    expect(s?.scratchPy).toBe(1142);
    expect(s?.slowestPy).toBe(1142);
    expect(s?.starts[0]?.isScratch).toBe(true);
    expect(s?.starts[0]?.startFromFirstGunMs).toBe(0);
  });

  it("auto-detects scratch (lowest PY) and slowest (highest PY)", () => {
    const s = buildSchedule(
      [boat("RS800", 797), boat("Mirror", 1364), boat("Laser", 1100)],
      60,
    );
    expect(s?.scratchPy).toBe(797);
    expect(s?.slowestPy).toBe(1364);
    const scratch = s?.starts.find((x) => x.isScratch);
    expect(scratch?.py).toBe(797);
  });

  it("orders starts earliest-first; slowest is first (T=0), scratch is last", () => {
    const s = buildSchedule(
      [boat("RS800", 797), boat("Mirror", 1364), boat("Laser", 1100)],
      60,
    );
    const order = s?.starts.map((x) => x.py);
    expect(order).toEqual([1364, 1100, 797]); // slowest → fastest
    expect(s?.starts[0]?.startFromFirstGunMs).toBe(0); // first gun = slowest
    const last = s?.starts.at(-1);
    expect(last?.isScratch).toBe(true);
    expect(s?.starts[0]?.order).toBe(1);
  });

  it("places the mid-fleet boat by the convergent formula (Laser → +11:37, not +8:25)", () => {
    const s = buildSchedule(
      [boat("RS800", 797), boat("Mirror", 1364), boat("Laser", 1100)],
      60,
    )!;
    const laser = s.starts.find((x) => x.classes[0]?.name === "Laser")!;
    expect(formatMmSs(laser.startFromFirstGunMs)).toBe("11:37");
    const scratch = s.starts.find((x) => x.isScratch)!;
    expect(formatMmSs(scratch.startFromFirstGunMs)).toBe("24:56");
  });

  it("start time from first gun ascends with order (slowest first, scratch chases last)", () => {
    const s = buildSchedule(
      [boat("RS800", 797), boat("Mirror", 1364), boat("Laser", 1100)],
      60,
    )!;
    const times = s.starts.map((x) => x.startFromFirstGunMs);
    expect(times[0]).toBe(0);
    for (let i = 1; i < times.length; i++) {
      expect(times[i]!).toBeGreaterThan(times[i - 1]!);
    }
    expect(s.starts.at(-1)?.isScratch).toBe(true);
  });

  it("finishes at first gun + duration (the slowest boat sails the full window)", () => {
    const s = buildSchedule([boat("RS800", 797), boat("Mirror", 1364)], 60);
    expect(s?.finishFromFirstGunMs).toBe(60 * 60_000);
  });

  it("converges: every boat sailing to its PY finishes together (sailTime/PY equal)", () => {
    const s = buildSchedule(
      [boat("RS800", 797), boat("Mirror", 1364), boat("Laser", 1100), boat("Solo", 1142)],
      60,
    )!;
    const ratios = s.starts.map((x) => (s.finishFromFirstGunMs - x.startFromFirstGunMs) / x.py);
    const expected = s.finishFromFirstGunMs / s.slowestPy;
    for (const r of ratios) expect(r).toBeCloseTo(expected, 6);
  });

  it("groups identical-PY classes into a single start (incl. cross-category)", () => {
    const s = buildSchedule(
      [
        boat("RS800", 797),
        boat("B14", 858, "dinghy"),
        boat("International Canoe", 858, "experimental"),
      ],
      60,
    );
    // 3 classes, 2 distinct PYs → 2 starts
    expect(s?.starts).toHaveLength(2);
    const tied = s?.starts.find((x) => x.py === 858);
    expect(tied?.classes).toHaveLength(2);
    expect(tied?.classes.map((c) => c.name)).toEqual([
      "B14",
      "International Canoe",
    ]); // alphabetised within group
  });

  it("groups a three-way PY tie into one start", () => {
    const s = buildSchedule(
      [
        boat("RS800", 797),
        boat("Flying Fifteen Silver", 1051),
        boat("Devoti D Zero - Black Rig", 1051),
        boat("Hartley Zenith", 1051),
      ],
      60,
    );
    const tied = s?.starts.find((x) => x.py === 1051);
    expect(tied?.classes).toHaveLength(3);
  });
});

describe("mid-race additions (locked frame)", () => {
  const base = buildSchedule(
    [boat("RS800", 797), boat("Mirror", 1364), boat("Laser", 1100)],
    60,
  )!;
  const frame = frameFromSchedule(base);

  function startFor(schedule: ReturnType<typeof buildSchedule>, name: string) {
    return schedule!.starts.find((s) => s.classes.some((c) => c.name === name));
  }

  it("snapshots the locked slowest-boat / window reference", () => {
    expect(frame.slowestPy).toBe(1364);
    expect(frame.durationMs).toBe(60 * 60_000);
  });

  it("does not move existing starts when a class is added", () => {
    const withAdd = buildSchedule(
      [boat("RS800", 797), boat("Mirror", 1364), boat("Laser", 1100), boat("Solo", 1142)],
      60,
      frame,
    );
    for (const name of ["RS800", "Mirror", "Laser"]) {
      expect(startFor(withAdd, name)?.startFromFirstGunMs).toBe(
        startFor(base, name)?.startFromFirstGunMs,
      );
    }
  });

  it("slots a late entrant FASTER than the scratch at the back (starts last)", () => {
    const withAdd = buildSchedule(
      [boat("RS800", 797), boat("Mirror", 1364), boat("Foiler", 700)],
      60,
      frame,
    )!;
    const foiler = startFor(withAdd, "Foiler")!;
    const scratch = startFor(withAdd, "RS800")!;
    expect(foiler.startFromFirstGunMs).toBeGreaterThan(scratch.startFromFirstGunMs);
    expect(withAdd.starts.at(-1)?.classes[0]?.name).toBe("Foiler");
  });

  it("times a late entrant SLOWER than the locked slowest boat before the first gun (already passed)", () => {
    const withAdd = buildSchedule(
      [boat("RS800", 797), boat("Mirror", 1364), boat("Heavy", 1600)],
      60,
      frame,
    )!;
    // start time is negative → before the first gun → classified 'already started'
    expect(startFor(withAdd, "Heavy")!.startFromFirstGunMs).toBeLessThan(0);
  });
});

describe("startTime", () => {
  it("returns absolute Dates offset from the first gun", () => {
    const s = buildSchedule([boat("RS800", 797), boat("Mirror", 1364)], 60);
    const firstGun = 1_700_000_000_000;
    const first = s!.starts[0]!;
    const scratch = s!.starts.find((x) => x.isScratch)!;
    expect(startTime(first, firstGun).getTime()).toBe(firstGun);
    // Date is integer-ms; offsets are sub-ms fractional, so compare against floor.
    expect(startTime(scratch, firstGun).getTime()).toBe(
      Math.floor(firstGun + scratch.startFromFirstGunMs),
    );
  });
});
