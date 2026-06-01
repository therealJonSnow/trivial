import type { BoatClass, ScheduledStart, Schedule, ScheduleFrame } from "./types";

const MS_PER_MIN = 60_000;

/**
 * Start time after the first gun, in ms, per spec §2.2 — the official pursuit
 * formula, anchored on the *slowest* boat:
 *   startFromFirstGun = duration × (1 − PY_class / PY_slowest)
 * The slowest boat (PY = PY_slowest) starts at 0 and sails the full window; the
 * scratch (lowest PY) boat starts latest and sails the least. Every boat sailing
 * exactly to its PY then finishes together at `duration`. Computed in ms; never
 * rounded here. Negative when classPy > slowestPy (a mid-race entrant slower than
 * the locked fleet — its start has already passed).
 */
export function computeStartFromFirstGunMs(
  durationMs: number,
  slowestPy: number,
  classPy: number,
): number {
  return durationMs * (1 - classPy / slowestPy);
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
 * - The slowest boat (highest PY) is the timing anchor: it starts at the first
 *   gun (T=0) and sails the full `duration`.
 * - Scratch boat = lowest selected PY: starts last, sails the least.
 * - Each class starts at `duration × (1 − PY_class / PY_slowest)` after the first
 *   gun, so boats sailing exactly to their PY all finish together at `duration`.
 * - Classes sharing a PY are collapsed into one grouped start.
 * - Starts are ordered earliest-first.
 *
 * Pass `frame` (the snapshot taken at race start) to time against a LOCKED
 * slowest boat + window. This keeps existing starts fixed when classes are added
 * mid-race: a late entrant faster than the scratch slots in *after* the scratch
 * (starts last and chases); one slower than the locked slowest boat gets a
 * negative start time (already passed). Without a frame (setup), the slowest boat
 * and window are derived from the selection.
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
  const slowestPy = frame ? frame.slowestPy : Math.max(...selected.map((c) => c.py));
  const scratchPy = Math.min(...selected.map((c) => c.py));
  const groups = groupByPy(selected);

  const starts: ScheduledStart[] = [...groups.entries()]
    .map(([py, classes]) => ({
      py,
      classes,
      startFromFirstGunMs: computeStartFromFirstGunMs(durationMs, slowestPy, py),
      isScratch: py === scratchPy,
    }))
    // earliest first; works for negative times from mid-race adds slower than the locked fleet
    .sort((a, b) => a.startFromFirstGunMs - b.startFromFirstGunMs)
    .map((e, i) => ({
      order: i + 1,
      classes: e.classes,
      py: e.py,
      startFromFirstGunMs: e.startFromFirstGunMs,
      isScratch: e.isScratch,
    }));

  return {
    starts,
    scratchPy,
    slowestPy,
    durationMs,
    finishFromFirstGunMs: durationMs,
  };
}

/** Snapshot the locked timing reference from a freshly built schedule. */
export function frameFromSchedule(schedule: Schedule): ScheduleFrame {
  return {
    slowestPy: schedule.slowestPy,
    durationMs: schedule.durationMs,
  };
}

/** Absolute Date a start fires, given the first-gun epoch (ms). */
export function startTime(start: ScheduledStart, firstGunEpochMs: number): Date {
  return new Date(firstGunEpochMs + start.startFromFirstGunMs);
}
