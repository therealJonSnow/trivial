import type { BoatClass, ScheduledStart, Schedule } from "./types";

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
 * - Starts are ordered earliest-first (largest offset first).
 * - The first gun is the earliest start; all timing is relative to it.
 *
 * Returns `null` when the fleet is empty (min 1 class required to race).
 */
export function buildSchedule(
  selected: BoatClass[],
  durationMinutes: number,
): Schedule | null {
  if (selected.length === 0) return null;

  const durationMs = durationMinutes * MS_PER_MIN;
  const scratchPy = Math.min(...selected.map((c) => c.py));
  const groups = groupByPy(selected);

  const unordered = [...groups.entries()].map(([py, classes]) => ({
    py,
    classes,
    offsetMs: computeOffsetMs(durationMs, scratchPy, py),
    isScratch: py === scratchPy,
  }));

  // earliest first = largest offset first
  unordered.sort((a, b) => b.offsetMs - a.offsetMs);

  const maxOffsetMs = unordered.length > 0 ? (unordered[0]?.offsetMs ?? 0) : 0;

  const starts: ScheduledStart[] = unordered.map((g, i) => ({
    order: i + 1,
    classes: g.classes,
    py: g.py,
    offsetMs: g.offsetMs,
    startFromFirstGunMs: maxOffsetMs - g.offsetMs,
    isScratch: g.isScratch,
  }));

  return {
    starts,
    scratchPy,
    maxOffsetMs,
    durationMs,
    finishFromFirstGunMs: maxOffsetMs + durationMs,
  };
}

/** Absolute Date a start fires, given the first-gun epoch (ms). */
export function startTime(start: ScheduledStart, firstGunEpochMs: number): Date {
  return new Date(firstGunEpochMs + start.startFromFirstGunMs);
}
