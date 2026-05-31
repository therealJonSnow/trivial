import { describe, it, expect } from "vitest";
import { computeOffsetMs, buildSchedule, startTime } from "./schedule";
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

describe("computeOffsetMs", () => {
  it("matches the spec worked example (RS800 scratch, Mirror) → 24:56", () => {
    const durationMs = 60 * 60_000;
    const offset = computeOffsetMs(durationMs, 797, 1364);
    // 60min × (1 − 797/1364) = 1,496,481.…ms
    expect(offset).toBeCloseTo(1_496_481.2, 0);
    expect(formatMmSs(offset)).toBe("24:56");
  });

  it("is zero for the scratch boat (class PY === scratch PY)", () => {
    expect(computeOffsetMs(60 * 60_000, 797, 797)).toBe(0);
  });

  it("increases with slower (higher PY) classes", () => {
    const d = 60 * 60_000;
    expect(computeOffsetMs(d, 797, 1000)).toBeLessThan(computeOffsetMs(d, 797, 1364));
  });
});

describe("buildSchedule", () => {
  it("returns null for an empty fleet", () => {
    expect(buildSchedule([], 60)).toBeNull();
  });

  it("handles a single class as its own scratch start", () => {
    const s = buildSchedule([boat("Solo", 1142)], 60);
    expect(s).not.toBeNull();
    expect(s?.starts).toHaveLength(1);
    expect(s?.scratchPy).toBe(1142);
    expect(s?.starts[0]?.offsetMs).toBe(0);
    expect(s?.starts[0]?.isScratch).toBe(true);
    expect(s?.starts[0]?.startFromFirstGunMs).toBe(0);
  });

  it("auto-detects the scratch boat as the lowest PY", () => {
    const s = buildSchedule(
      [boat("RS800", 797), boat("Mirror", 1364), boat("Laser", 1100)],
      60,
    );
    expect(s?.scratchPy).toBe(797);
    const scratch = s?.starts.find((x) => x.isScratch);
    expect(scratch?.py).toBe(797);
  });

  it("orders starts earliest-first; scratch is last with offset 0", () => {
    const s = buildSchedule(
      [boat("RS800", 797), boat("Mirror", 1364), boat("Laser", 1100)],
      60,
    );
    const order = s?.starts.map((x) => x.py);
    expect(order).toEqual([1364, 1100, 797]); // slowest → fastest
    const last = s?.starts.at(-1);
    expect(last?.isScratch).toBe(true);
    expect(last?.offsetMs).toBe(0);
    expect(s?.starts[0]?.order).toBe(1);
  });

  it("anchors timing to the first gun (earliest start at T=0, scratch at maxOffset)", () => {
    const s = buildSchedule([boat("RS800", 797), boat("Mirror", 1364)], 60);
    expect(s?.starts[0]?.startFromFirstGunMs).toBe(0); // first gun
    const scratch = s?.starts.find((x) => x.isScratch);
    expect(scratch?.startFromFirstGunMs).toBe(s?.maxOffsetMs);
  });

  it("start time from first gun ascends with order (slowest first, scratch chases last)", () => {
    const s = buildSchedule(
      [boat("RS800", 797), boat("Mirror", 1364), boat("Laser", 1100)],
      60,
    )!;
    const times = s.starts.map((x) => x.startFromFirstGunMs);
    // first start is the slowest at +0; each subsequent start is later
    expect(times[0]).toBe(0);
    for (let i = 1; i < times.length; i++) {
      expect(times[i]!).toBeGreaterThan(times[i - 1]!);
    }
    // the last (largest) start time belongs to the scratch boat
    expect(s.starts.at(-1)?.isScratch).toBe(true);
  });

  it("computes finish as scratch start + duration (maxOffset + duration)", () => {
    const s = buildSchedule([boat("RS800", 797), boat("Mirror", 1364)], 60);
    expect(s?.finishFromFirstGunMs).toBe((s?.maxOffsetMs ?? 0) + 60 * 60_000);
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

describe("startTime", () => {
  it("returns absolute Dates offset from the first gun", () => {
    const s = buildSchedule([boat("RS800", 797), boat("Mirror", 1364)], 60);
    const firstGun = 1_700_000_000_000;
    const first = s!.starts[0]!;
    const scratch = s!.starts.find((x) => x.isScratch)!;
    expect(startTime(first, firstGun).getTime()).toBe(firstGun);
    // Date is integer-ms; offsets are sub-ms fractional, so compare against floor.
    expect(startTime(scratch, firstGun).getTime()).toBe(
      Math.floor(firstGun + s!.maxOffsetMs),
    );
  });
});
