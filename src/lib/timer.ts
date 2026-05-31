import type { Schedule, ScheduledStart } from "./types";

/** How long a GO flash holds before retargeting (unless the next gun is sooner). */
export const GO_HOLD_MS = 5_000;

/** Warning milestones (ms before first gun) that get special emphasis. */
export const WARNING_MILESTONES_MS = [5 * 60_000, 3 * 60_000, 60_000, 0] as const;

export type Phase = "warning" | "race" | "finished";

/**
 * Wall-clock anchors for a running race. Every derived value is computed from
 * `Date.now()` against these anchors — never from accumulated interval ticks.
 */
export interface RaceClock {
  /** Epoch ms when Start was tapped (warning phase begins). */
  startedAtEpoch: number;
  /** Configured warning length, ms (first gun = start + warning, shifted by pauses). */
  warningMs: number;
  /** Total paused duration already absorbed, ms (postponement model). */
  accumulatedPauseMs: number;
  /** Epoch ms when paused; null while running. */
  pausedAtEpoch: number | null;
}

export interface TimerView {
  phase: Phase;
  /** ms since the (postponement-adjusted) first gun; negative during warning. */
  msSinceFirstGun: number;
  /** The next start still to fire, or null once all have fired. */
  nextStart: ScheduledStart | null;
  /** ms until the big primary countdown's target (first gun, or next start). */
  countdownMs: number;
  /** During warning, the milestone just reached (ms value) or null. */
  activeMilestoneMs: number | null;
  /** A start currently in its GO flash window, or null. */
  flashing: ScheduledStart | null;
  /** Orders already fired (started). */
  startedOrders: number[];
  /** ms remaining until the finish horn (clamped ≥ 0). */
  toFinishMs: number;
  paused: boolean;
}

/** Epoch ms of the first gun, accounting for accumulated postponement. */
export function firstGunEpoch(clock: RaceClock): number {
  return clock.startedAtEpoch + clock.warningMs + clock.accumulatedPauseMs;
}

/** The reference "now" used for arithmetic — frozen at the pause instant when paused. */
function refNow(clock: RaceClock, now: number): number {
  return clock.pausedAtEpoch ?? now;
}

/** Derive the full timer view from the clock, schedule, and current time. */
export function deriveTimer(
  clock: RaceClock,
  schedule: Schedule,
  now: number,
): TimerView {
  const gun = firstGunEpoch(clock);
  const ref = refNow(clock, now);
  const msSinceFirstGun = ref - gun;
  const paused = clock.pausedAtEpoch !== null;

  const startedOrders: number[] = [];
  let nextStart: ScheduledStart | null = null;
  for (const s of schedule.starts) {
    if (msSinceFirstGun >= s.startFromFirstGunMs) startedOrders.push(s.order);
    else if (nextStart === null) nextStart = s;
  }

  let phase: Phase;
  if (msSinceFirstGun >= schedule.finishFromFirstGunMs) phase = "finished";
  else if (msSinceFirstGun < 0) phase = "warning";
  else phase = "race";

  // Big countdown target: first gun during warning, else the next start.
  const countdownMs =
    phase === "warning"
      ? -msSinceFirstGun
      : nextStart
        ? nextStart.startFromFirstGunMs - msSinceFirstGun
        : schedule.finishFromFirstGunMs - msSinceFirstGun;

  // Warning milestone emphasis: the smallest milestone we've passed, if recent.
  let activeMilestoneMs: number | null = null;
  if (phase === "warning") {
    for (const m of WARNING_MILESTONES_MS) {
      if (countdownMs <= m) activeMilestoneMs = m;
    }
  }

  // GO flash: the most recent start fired within GO_HOLD, unless the next gun is sooner.
  let flashing: ScheduledStart | null = null;
  if (phase !== "warning") {
    for (let i = schedule.starts.length - 1; i >= 0; i--) {
      const s = schedule.starts[i]!;
      const sinceFire = msSinceFirstGun - s.startFromFirstGunMs;
      if (sinceFire >= 0 && sinceFire < GO_HOLD_MS) {
        const toNext = nextStart
          ? nextStart.startFromFirstGunMs - msSinceFirstGun
          : Infinity;
        if (sinceFire < toNext) flashing = s;
        break;
      }
    }
  }

  return {
    phase,
    msSinceFirstGun,
    nextStart,
    countdownMs: Math.max(0, countdownMs),
    activeMilestoneMs,
    flashing,
    startedOrders,
    toFinishMs: Math.max(0, schedule.finishFromFirstGunMs - msSinceFirstGun),
    paused,
  };
}

/** Begin a pause: stamp the pause instant. No-op if already paused. */
export function pauseClock(clock: RaceClock, now: number): RaceClock {
  if (clock.pausedAtEpoch !== null) return clock;
  return { ...clock, pausedAtEpoch: now };
}

/** Resume: fold the paused duration into the accumulated postponement. */
export function resumeClock(clock: RaceClock, now: number): RaceClock {
  if (clock.pausedAtEpoch === null) return clock;
  return {
    ...clock,
    accumulatedPauseMs: clock.accumulatedPauseMs + (now - clock.pausedAtEpoch),
    pausedAtEpoch: null,
  };
}

/** A fresh clock armed at `now` with the given warning length. */
export function armClock(now: number, warningMs: number): RaceClock {
  return {
    startedAtEpoch: now,
    warningMs,
    accumulatedPauseMs: 0,
    pausedAtEpoch: null,
  };
}
