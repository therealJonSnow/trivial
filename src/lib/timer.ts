import type { Schedule, ScheduledStart } from "./types";

/** How long a boat-start GO flash holds before retargeting (unless the next gun is sooner). */
export const GO_HOLD_MS = 5_000;

/** How long a sequence-signal (5/4/1) takeover holds before resuming the countdown. */
export const SIGNAL_HOLD_MS = 3_000;

/** Anticipation window: flash + count-in begins this long before any horn. */
export const IMMINENT_MS = 10_000;

/** Default lead-in between confirming Start and the first signal (the 10s count-in). */
export const PRE_ROLL_MS = 10_000;

/**
 * The two standard dinghy-racing start countdown sequences. The selected
 * sequence IS the lead-in to the first gun — there is no separate warning.
 *   "5-4-1": 5-minute sequence, signals at 5:00 / 4:00 / 1:00 / GO
 *   "3-2-1": 3-minute sequence, signals at 3:00 / 2:00 / 1:00 / GO
 */
export type StartSequence = "5-4-1" | "3-2-1";

export const SEQUENCES: Record<
  StartSequence,
  { warningMs: number; milestonesMs: readonly number[] }
> = {
  "5-4-1": { warningMs: 5 * 60_000, milestonesMs: [5 * 60_000, 4 * 60_000, 60_000, 0] },
  "3-2-1": { warningMs: 3 * 60_000, milestonesMs: [3 * 60_000, 2 * 60_000, 60_000, 0] },
};

export type Phase = "preroll" | "warning" | "race" | "finished";

/**
 * Wall-clock anchors for a running race. Every derived value is computed from
 * `Date.now()` against these anchors — never from accumulated interval ticks.
 */
export interface RaceClock {
  /** Epoch ms when Start was confirmed (the pre-roll count-in begins immediately). */
  startedAtEpoch: number;
  /** Selected start sequence. */
  sequence: StartSequence;
  /** Count-in lead before the first signal, ms (the "GET READY" 10s). */
  preRollMs: number;
  /** Sequence lead-in length, ms (first gun = start + preRoll + warning, shifted by pauses). */
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
  /** A boat start currently in its GO flash window, or null. */
  flashing: ScheduledStart | null;
  /** A sequence signal (5/4/1, in ms) currently in its takeover window, or null. */
  signalFlashMs: number | null;
  /**
   * Stable id of the active takeover (boat GO or sequence signal), or null.
   * Used to fire the long horn exactly once on each gun's rising edge.
   */
  takeoverKey: string | null;
  /**
   * ms until the next horn of ANY kind — sequence signal or boat start — or
   * null once none remain ahead. Drives the anticipation strobe + count-in beeps.
   */
  msToNextHorn: number | null;
  /** Orders already fired (started). */
  startedOrders: number[];
  /** ms remaining until the finish horn (clamped ≥ 0). */
  toFinishMs: number;
  paused: boolean;
}

/** Epoch ms of the first gun, accounting for the count-in pre-roll + postponement. */
export function firstGunEpoch(clock: RaceClock): number {
  return (
    clock.startedAtEpoch + clock.preRollMs + clock.warningMs + clock.accumulatedPauseMs
  );
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

  // Sequence signals sound at -m before the first gun (the 0-ms milestone IS the
  // first gun, which is also boat start order 1 — counted as a boat start, not here).
  const signalsMs = SEQUENCES[clock.sequence].milestonesMs.filter((m) => m > 0);

  let phase: Phase;
  if (msSinceFirstGun >= schedule.finishFromFirstGunMs) phase = "finished";
  else if (msSinceFirstGun < -clock.warningMs) phase = "preroll";
  else if (msSinceFirstGun < 0) phase = "warning";
  else phase = "race";

  // Big countdown target: first signal during pre-roll, first gun during warning,
  // else the next boat start (or the finish once all have started).
  const countdownMs =
    phase === "preroll"
      ? -msSinceFirstGun - clock.warningMs
      : phase === "warning"
        ? -msSinceFirstGun
        : nextStart
          ? nextStart.startFromFirstGunMs - msSinceFirstGun
          : schedule.finishFromFirstGunMs - msSinceFirstGun;

  // Warning milestone emphasis: the current signal segment for this sequence.
  let activeMilestoneMs: number | null = null;
  if (phase === "warning") {
    for (const m of SEQUENCES[clock.sequence].milestonesMs) {
      if (-msSinceFirstGun <= m) activeMilestoneMs = m;
    }
  }

  // Boat-start GO flash: most recent start fired within GO_HOLD, unless the next gun is sooner.
  let flashing: ScheduledStart | null = null;
  if (phase === "race" || phase === "finished") {
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

  // Sequence-signal takeover: a 5/4/1 signal fired within SIGNAL_HOLD (warning only;
  // signals are ≥ 60s apart so holds never collide).
  let signalFlashMs: number | null = null;
  if (phase === "warning") {
    for (const m of signalsMs) {
      const sinceFire = msSinceFirstGun + m;
      if (sinceFire >= 0 && sinceFire < SIGNAL_HOLD_MS) signalFlashMs = m;
    }
  }

  // Next horn of any kind: nearest upcoming sequence signal (−m) or boat start.
  let msToNextHorn: number | null = null;
  const consider = (offset: number) => {
    const dt = offset - msSinceFirstGun;
    if (dt > 0 && (msToNextHorn === null || dt < msToNextHorn)) msToNextHorn = dt;
  };
  for (const m of signalsMs) consider(-m);
  for (const s of schedule.starts) consider(s.startFromFirstGunMs);

  const takeoverKey = flashing
    ? `boat:${flashing.order}`
    : signalFlashMs !== null
      ? `sig:${signalFlashMs}`
      : null;

  return {
    phase,
    msSinceFirstGun,
    nextStart,
    countdownMs: Math.max(0, countdownMs),
    activeMilestoneMs,
    flashing,
    signalFlashMs,
    takeoverKey,
    msToNextHorn,
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

/**
 * A fresh clock armed at `now` for the given start sequence. `preRollMs` is the
 * count-in lead before the first signal (the "GET READY" window); pass 0 to begin
 * the sequence immediately.
 */
export function armClock(
  now: number,
  sequence: StartSequence,
  preRollMs = 0,
): RaceClock {
  return {
    startedAtEpoch: now,
    sequence,
    preRollMs,
    warningMs: SEQUENCES[sequence].warningMs,
    accumulatedPauseMs: 0,
    pausedAtEpoch: null,
  };
}
