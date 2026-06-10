import type { Schedule, ScheduledStart } from "./types";

/** How long a boat-start GO flash holds before retargeting (unless the next gun is sooner). */
export const GO_HOLD_MS = 5_000;

/**
 * Adjacent starts whose gap is ≤ this are treated as a "burst" — one continuous
 * takeover that flashes a momentary GO per horn with a live countdown between,
 * rather than independent GO holds that would smear into each other. Sized to
 * cover the zone where a single GO's hold + count-in would overlap the next gun.
 */
export const RAPID_WINDOW_MS = 12_000;

/**
 * Maximal run of consecutive starts whose every adjacent gap is ≤ RAPID_WINDOW_MS,
 * anchored on `start`. Used to keep near-coincident boats on screen together.
 */
export function rapidCluster(
  starts: readonly ScheduledStart[],
  anchor: ScheduledStart,
): ScheduledStart[] {
  const idx = starts.findIndex((s) => s.order === anchor.order);
  if (idx === -1) return [anchor];
  let i = idx;
  while (
    i > 0 &&
    starts[i]!.startFromFirstGunMs - starts[i - 1]!.startFromFirstGunMs <= RAPID_WINDOW_MS
  ) {
    i--;
  }
  let j = idx;
  while (
    j + 1 < starts.length &&
    starts[j + 1]!.startFromFirstGunMs - starts[j]!.startFromFirstGunMs <= RAPID_WINDOW_MS
  ) {
    j++;
  }
  return starts.slice(i, j + 1);
}

/** Momentary GO flash length per horn inside a burst (clamped under tight gaps). */
export const FLASH_MS = 900;

/** How long a sequence-signal (5/4/1) takeover holds before resuming the countdown. */
export const SIGNAL_HOLD_MS = 3_000;

/** Anticipation window: flash + count-in begins this long before any horn. */
export const IMMINENT_MS = 10_000;

/** Default lead-in between confirming Start and the first signal (the 10s count-in). */
export const PRE_ROLL_MS = 10_000;

/**
 * Standard dinghy-racing start countdown sequences. The selected sequence IS
 * the lead-in to the first gun — there is no separate warning.
 *   "10-5-4-1": signals at 10:00 / 5:00 / 4:00 / 1:00 / GO
 *   "5-4-1":    signals at 5:00 / 4:00 / 1:00 / GO
 *   "3-2-1":    signals at 3:00 / 2:00 / 1:00 / GO
 *   "GO":       no signals — first gun fires immediately (testing shortcut).
 */
export type StartSequence = "10-5-4-1" | "5-4-1" | "3-2-1" | "GO";

export const START_SEQUENCE_OPTIONS: readonly StartSequence[] = [
  "10-5-4-1",
  "5-4-1",
  "3-2-1",
  "GO",
];

export const SEQUENCES: Record<
  StartSequence,
  { warningMs: number; milestonesMs: readonly number[] }
> = {
  "10-5-4-1": {
    warningMs: 10 * 60_000,
    milestonesMs: [10 * 60_000, 5 * 60_000, 4 * 60_000, 60_000, 0],
  },
  "5-4-1": { warningMs: 5 * 60_000, milestonesMs: [5 * 60_000, 4 * 60_000, 60_000, 0] },
  "3-2-1": { warningMs: 3 * 60_000, milestonesMs: [3 * 60_000, 2 * 60_000, 60_000, 0] },
  GO: { warningMs: 0, milestonesMs: [0] },
};

/** Count-in before the first signal; zero for the instant GO test sequence. */
export function preRollForSequence(sequence: StartSequence): number {
  return sequence === "GO" ? 0 : PRE_ROLL_MS;
}

export type Phase = "preroll" | "warning" | "race" | "finished";

/**
 * A rapid-start cluster currently taking over the display. Present only while a
 * run of ≥2 near-coincident starts is firing; the whole cluster reads as one
 * event — a momentary GO flash at each member's instant, a countdown to the next
 * between flashes — so every class still gets its own horn at its own second.
 */
export interface BurstView {
  /** All starts in the cluster, in fire order (length ≥ 2). */
  members: ScheduledStart[];
  /** The most recently fired member — sound this horn now / show it on the flash. */
  justFired: ScheduledStart;
  /** True within the momentary flash window after `justFired`'s instant. */
  pulse: boolean;
  /** The next member still to fire, or null once the last has fired. */
  next: ScheduledStart | null;
  /** ms until `next` fires, or null when none remain. */
  msToNext: number | null;
  /** The member after `next`, for the "then ·" preview, or null. */
  afterNext: ScheduledStart | null;
}

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
  /** A boat start currently in its GO flash window, or null. Null during a burst. */
  flashing: ScheduledStart | null;
  /** The active rapid-start cluster, or null when starts are firing independently. */
  burst: BurstView | null;
  /** A sequence signal (5/4/1, in ms) currently in its takeover window, or null. */
  signalFlashMs: number | null;
  /** True while the finish gun is in its takeover window (fires once at time expiry). */
  finishFlash: boolean;
  /**
   * Stable id of the active takeover (boat GO, sequence signal, or finish), or
   * null. Used to fire the long horn exactly once on each gun's rising edge.
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
export function raceRefNow(clock: RaceClock, now: number): number {
  return clock.pausedAtEpoch ?? now;
}

/** Wall-clock instant at which a scheduled start's horn fires. */
export function hornEpochForStart(clock: RaceClock, start: ScheduledStart): number {
  return firstGunEpoch(clock) + start.startFromFirstGunMs;
}

/** ms until a horn from the shared race clock — all cards derive from the same refNow. */
export function msToHorn(hornEpochMs: number, refNowMs: number): number {
  return Math.max(0, hornEpochMs - refNowMs);
}

/** ms until a start from the race timeline (live — for horns, imminent, audio). */
export function msToStart(startFromFirstGunMs: number, msSinceFirstGun: number): number {
  return Math.max(0, startFromFirstGunMs - msSinceFirstGun);
}

/**
 * Snap the stopwatch position to the shared whole-second grid. Works before the
 * gun (negative) and during the race so every readout ticks in lockstep.
 */
export function snapRaceTimeline(msSinceFirstGun: number): number {
  return Math.floor(msSinceFirstGun / 1000) * 1000;
}

/** Live ms until a marker on the race timeline (horns, signals, finish). */
export function msToMarker(markerMsSinceFirstGun: number, msSinceFirstGun: number): number {
  return Math.max(0, markerMsSinceFirstGun - msSinceFirstGun);
}

/** Snapped remaining ms to a timeline marker — pair with `formatRaceStopwatch`. */
export function syncedDisplayMsToMarker(
  markerMsSinceFirstGun: number,
  msSinceFirstGun: number,
): number {
  return msToMarker(markerMsSinceFirstGun, snapRaceTimeline(msSinceFirstGun));
}

/** Elapsed time on the stopwatch (clamped at zero before the gun). */
export function syncedDisplayMsElapsed(msSinceFirstGun: number): number {
  return Math.max(0, snapRaceTimeline(msSinceFirstGun));
}

/** Countdown to the first gun — the warning-phase hero readout. */
export function syncedDisplayMsToFirstGun(msSinceFirstGun: number): number {
  return syncedDisplayMsToMarker(0, msSinceFirstGun);
}

/** Countdown to the first sequence signal — the pre-roll hero readout. */
export function syncedDisplayMsToFirstSignal(
  msSinceFirstGun: number,
  warningMs: number,
): number {
  return syncedDisplayMsToMarker(-warningMs, msSinceFirstGun);
}

/** Countdown to a class start horn. */
export function syncedDisplayMsToStart(
  startFromFirstGunMs: number,
  msSinceFirstGun: number,
): number {
  return syncedDisplayMsToMarker(startFromFirstGunMs, msSinceFirstGun);
}

/** Countdown to the finish gun. */
export function syncedDisplayMsToFinish(
  finishFromFirstGunMs: number,
  msSinceFirstGun: number,
): number {
  return syncedDisplayMsToMarker(finishFromFirstGunMs, msSinceFirstGun);
}

/** Primary countdown for the current phase — one stopwatch, one readout. */
export function syncedHeroCountdownMs(
  view: Pick<TimerView, "phase" | "msSinceFirstGun" | "nextStart">,
  clock: RaceClock,
  finishFromFirstGunMs: number,
): number {
  switch (view.phase) {
    case "preroll":
      return syncedDisplayMsToFirstSignal(view.msSinceFirstGun, clock.warningMs);
    case "warning":
      return syncedDisplayMsToFirstGun(view.msSinceFirstGun);
    case "race":
      return view.nextStart
        ? syncedDisplayMsToStart(view.nextStart.startFromFirstGunMs, view.msSinceFirstGun)
        : syncedDisplayMsToFinish(finishFromFirstGunMs, view.msSinceFirstGun);
    case "finished":
      return syncedDisplayMsToFinish(finishFromFirstGunMs, view.msSinceFirstGun);
  }
}

/**
 * Find the rapid-start cluster active at `msSinceFirstGun`, if any.
 *
 * A cluster is a maximal run of consecutive starts whose every adjacent gap is
 * ≤ RAPID_WINDOW_MS; only runs of two or more qualify (a lone start uses the
 * ordinary single-GO takeover). The cluster is "active" from its first member's
 * instant until GO_HOLD_MS past its last — the same tail a single GO holds — so
 * the closing flash and "all away" beat have room before the queue resumes.
 */
function findActiveBurst(
  starts: ScheduledStart[],
  msSinceFirstGun: number,
): BurstView | null {
  let i = 0;
  while (i < starts.length) {
    // Extend the run while each successive gap stays within the rapid window.
    let j = i;
    while (
      j + 1 < starts.length &&
      starts[j + 1]!.startFromFirstGunMs - starts[j]!.startFromFirstGunMs <=
        RAPID_WINDOW_MS
    ) {
      j++;
    }
    if (j > i) {
      const members = starts.slice(i, j + 1);
      const first = members[0]!.startFromFirstGunMs;
      const last = members[members.length - 1]!.startFromFirstGunMs;
      if (msSinceFirstGun >= first && msSinceFirstGun < last + GO_HOLD_MS) {
        let justFired = members[0]!;
        let next: ScheduledStart | null = null;
        let afterNext: ScheduledStart | null = null;
        for (let k = 0; k < members.length; k++) {
          const m = members[k]!;
          if (m.startFromFirstGunMs <= msSinceFirstGun) {
            justFired = m;
          } else {
            next = m;
            afterNext = members[k + 1] ?? null;
            break;
          }
        }
        // Don't let the flash eat the whole gap before the next horn — always
        // leave at least half the gap for the countdown (full FLASH_MS on the
        // last member, which has no successor).
        const gap = next
          ? next.startFromFirstGunMs - justFired.startFromFirstGunMs
          : Infinity;
        const flashMs = Math.min(FLASH_MS, gap * 0.5);
        return {
          members,
          justFired,
          pulse: msSinceFirstGun - justFired.startFromFirstGunMs < flashMs,
          next,
          msToNext: next ? next.startFromFirstGunMs - msSinceFirstGun : null,
          afterNext,
        };
      }
    }
    i = j + 1;
  }
  return null;
}

/** Derive the full timer view from the clock, schedule, and current time. */
export function deriveTimer(
  clock: RaceClock,
  schedule: Schedule,
  now: number,
): TimerView {
  const gun = firstGunEpoch(clock);
  const ref = raceRefNow(clock, now);
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

  // Rapid-cluster "burst" takeover: when consecutive starts fall within
  // RAPID_WINDOW of each other, the single-GO hold of one would smear into the
  // next instant. Instead the whole cluster is one continuous takeover — a
  // momentary flash per horn, a countdown between — and the per-member flash
  // replaces the single `flashing` GO so they never double-render.
  const burst =
    phase === "race" || phase === "finished"
      ? findActiveBurst(schedule.starts, msSinceFirstGun)
      : null;
  if (burst) flashing = null;

  // Sequence-signal takeover: a 5/4/1 signal fired within SIGNAL_HOLD (warning only;
  // signals are ≥ 60s apart so holds never collide).
  let signalFlashMs: number | null = null;
  if (phase === "warning") {
    for (const m of signalsMs) {
      const sinceFire = msSinceFirstGun + m;
      if (sinceFire >= 0 && sinceFire < SIGNAL_HOLD_MS) signalFlashMs = m;
    }
  }

  // Finish-gun takeover: the finish horn fires once at time expiry and holds
  // briefly before settling to the static "race complete" state. Takes priority
  // over a boat GO that started within the last GO_HOLD before the finish.
  const finishFlash =
    phase === "finished" &&
    msSinceFirstGun - schedule.finishFromFirstGunMs < GO_HOLD_MS;

  // Next horn of any kind: nearest upcoming sequence signal (−m), boat start, or
  // the finish gun. Drives the anticipation strobe + count-in beeps for all three.
  let msToNextHorn: number | null = null;
  const consider = (offset: number) => {
    const dt = offset - msSinceFirstGun;
    if (dt > 0 && (msToNextHorn === null || dt < msToNextHorn)) msToNextHorn = dt;
  };
  for (const m of signalsMs) consider(-m);
  for (const s of schedule.starts) consider(s.startFromFirstGunMs);
  consider(schedule.finishFromFirstGunMs);

  // One horn per gun. In a burst the key flips to each member as it fires, so the
  // rising-edge horn logic sounds every class's gun on its own second.
  const takeoverKey = finishFlash
    ? "finish"
    : burst
      ? `boat:${burst.justFired.order}`
      : flashing
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
    burst,
    signalFlashMs,
    finishFlash,
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
