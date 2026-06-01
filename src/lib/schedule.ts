import type { BoatClass, ScheduledStart, Schedule, ScheduleFrame } from "./types";

const MS_PER_MIN = 60_000;

/**
 * Start offset behind the scratch boat, in ms, per spec §2.2:
 *   offset = duration × (1 − PY_scratch / PY_class)
 * Computed in ms throughout; never rounded here.
 */
export function computeOffsetMs(
  durationMs: number,
  scratchPy: number,
  classPy: number,
): number {
  return durationMs * (1 - scratchPy / classPy);
}

/** Group classes by identical PY (they start simultaneously — spec §2.7). */
function groupByPy(classes: BoatClass[]): Map<number, BoatClass[]> {
  const groups = new Map<number, BoatClass[]>();
  for (const c of classes) {
    const existing = groups.get(c.py);
    if (existing) existing.push(c);
    else groups.set(c.py, [c]);
  }
  // deterministic within-group ordering by name
  for (const group of groups.values()) {
    group.sort((a, b) => a.name.localeCompare(b.name));
  }
  return groups;
}

/**
 * Build the full pursuit start schedule from a selected fleet.
 *
 * - Scratch boat = lowest selected PY (offset 00:00, starts last).
 * - Classes sharing a PY are collapsed into one grouped start.
 * - Starts are ordered earliest-first.
 * - The first gun is the earliest start; all timing is relative to it.
 *
 * Pass `frame` (the snapshot taken at race start) to time against a LOCKED
 * scratch + first gun. This keeps existing starts fixed when classes are added
 * mid-race: a late entrant faster than the original scratch gets a negative
 * offset and slots in *after* the scratch; one slower than the whole fleet gets
 * a start time before the first gun (already passed). Without a frame (setup),
 * the scratch and first gun are derived from the selection.
 *
 * Returns `null` when the fleet is empty (min 1 class required to race).
 */
export function buildSchedule(
  selected: BoatClass[],
  durationMinutes: number,
  frame?: ScheduleFrame,
): Schedule | null {
  if (selected.length === 0) return null;

  const durationMs = frame ? frame.durationMs : durationMinutes * MS_PER_MIN;
  const scratchPy = frame ? frame.scratchPy : Math.min(...selected.map((c) => c.py));
  const groups = groupByPy(selected);

  const entries = [...groups.entries()].map(([py, classes]) => ({
    py,
    classes,
    offsetMs: computeOffsetMs(durationMs, scratchPy, py),
    isScratch: py === scratchPy,
  }));

  const maxOffsetMs = frame
    ? frame.maxOffsetMs
    : Math.max(...entries.map((e) => e.offsetMs));

  const starts: ScheduledStart[] = entries
    .map((e) => ({ ...e, startFromFirstGunMs: maxOffsetMs - e.offsetMs }))
    // earliest first; works for negative/over-max times from mid-race adds
    .sort((a, b) => a.startFromFirstGunMs - b.startFromFirstGunMs)
    .map((e, i) => ({
      order: i + 1,
      classes: e.classes,
      py: e.py,
      offsetMs: e.offsetMs,
      startFromFirstGunMs: e.startFromFirstGunMs,
      isScratch: e.isScratch,
    }));

  return {
    starts,
    scratchPy,
    maxOffsetMs,
    durationMs,
    finishFromFirstGunMs: maxOffsetMs + durationMs,
  };
}

/** Snapshot the locked timing reference from a freshly built schedule. */
export function frameFromSchedule(schedule: Schedule): ScheduleFrame {
  return {
    scratchPy: schedule.scratchPy,
    maxOffsetMs: schedule.maxOffsetMs,
    durationMs: schedule.durationMs,
  };
}

/** Absolute Date a start fires, given the first-gun epoch (ms). */
export function startTime(start: ScheduledStart, firstGunEpochMs: number): Date {
  return new Date(firstGunEpochMs + start.startFromFirstGunMs);
}
