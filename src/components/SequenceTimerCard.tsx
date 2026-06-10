"use client";

import type { ScheduledStart } from "@/lib/types";
import type { StartSequence, TimerView } from "@/lib/timer";
import {
  GO_HOLD_MS,
  firstSequenceSignalMs,
  flagSignalLabel,
  syncedDisplayMsToFirstGun,
  syncedDisplayMsToFirstSignal,
} from "@/lib/timer";
import { formatRaceStopwatch } from "@/lib/format";

export type SequenceCardMode = "preroll" | "warning" | "signal" | "go" | "away";

interface SequenceTimerCardProps {
  mode: SequenceCardMode;
  sequence: StartSequence;
  msSinceFirstGun: number;
  warningMs: number;
  sequenceLabel: string;
  activeMilestoneMs: number | null;
  signalFlashMs: number | null;
  firstStart: ScheduledStart | null;
  imminent: boolean;
  paused: boolean;
}

/** Whether the sequence card is active (replaces 1st-class row + full-page signal overlays). */
export function deriveSequenceCardMode(
  view: TimerView,
  firstStart: ScheduledStart | null,
  msSinceFirstGun: number,
): SequenceCardMode | null {
  if (view.phase === "preroll") return "preroll";
  if (view.signalFlashMs !== null) return "signal";
  if (view.phase === "warning") return "warning";
  if (!firstStart) return null;

  // Rapid cluster — class cards own the horns from here.
  if (view.burst?.members.some((m) => m.order === firstStart.order)) return null;

  if (view.flashing?.order === firstStart.order) return "go";
  if (view.startedOrders.includes(firstStart.order)) {
    const since = msSinceFirstGun - firstStart.startFromFirstGunMs;
    if (since >= 0 && since < GO_HOLD_MS) return "away";
  }
  return null;
}

function classNames(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

function FlagIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        d="M6 3v18M6 3h11l-2.5 4L17 11H6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HornShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article
      className={classNames(
        "relative min-h-[7.5rem] overflow-hidden rounded-xl border-2 border-imminent bg-imminent p-4 motion-safe:animate-pulse",
        className,
      )}
    >
      <span className="absolute inset-y-0 left-0 w-1.5 bg-ground/50" aria-hidden />
      <div className="flex h-full flex-col gap-2 pl-2">{children}</div>
    </article>
  );
}

/**
 * Sequence + first-gun card — flags, horns, and the 1st class GO/away. The first
 * start never appears as a separate row while this card is showing.
 */
export function SequenceTimerCard({
  mode,
  sequence,
  msSinceFirstGun,
  warningMs,
  sequenceLabel,
  activeMilestoneMs,
  signalFlashMs,
  firstStart,
  imminent,
  paused,
}: SequenceTimerCardProps) {
  const firstSignalMs = firstSequenceSignalMs(sequence);
  const names = firstStart?.classes.map((c) => c.name).join(" + ");
  const strobe = imminent && !paused ? "motion-safe:animate-strobe" : "";

  if (mode === "signal" && signalFlashMs !== null) {
    return (
      <HornShell>
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-ground/70">
          Signal
        </p>
        <div className="font-mono text-clock-sm font-black tabular-nums leading-none text-ground">
          {formatRaceStopwatch(signalFlashMs)}
        </div>
        <p className="font-display text-lg font-bold uppercase tracking-wide text-ground">
          Sound the horn
        </p>
      </HornShell>
    );
  }

  if (mode === "go") {
    return (
      <HornShell>
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-ground/70">
          Sound horn
        </p>
        <div className="font-mono text-clock-sm font-black leading-none text-ground">GO</div>
        <p className="truncate font-display text-2xl font-semibold leading-tight text-ground">
          {names}
        </p>
      </HornShell>
    );
  }

  if (mode === "away") {
    return (
      <article className="relative overflow-hidden rounded-xl border border-started/40 bg-panel px-3 py-2.5">
        <span className="absolute inset-y-0 left-0 w-1.5 bg-started/60" aria-hidden />
        <div className="flex items-center justify-between gap-2 pl-1.5">
          <div className="min-w-0">
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-started">
              Away
            </p>
            <p className="truncate font-display text-sm font-semibold text-muted line-through decoration-started/50">
              {names}
            </p>
          </div>
        </div>
      </article>
    );
  }

  if (mode === "preroll") {
    const countdown = formatRaceStopwatch(
      syncedDisplayMsToFirstSignal(msSinceFirstGun, warningMs),
    );
    const raiseLabel = firstSignalMs
      ? `Raise ${flagSignalLabel(firstSignalMs)} flag`
      : "Raise first flag";

    return (
      <article className="relative overflow-hidden rounded-xl border-2 border-dashed border-imminent/70 bg-imminent/10 p-4">
        <div className="flag-strip mb-3" />
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-imminent">
            <FlagIcon className="h-5 w-5 shrink-0" />
            <p className="font-display text-sm font-bold uppercase tracking-[0.2em]">
              Count-in
            </p>
          </div>
          <span className="rounded-full border border-imminent/50 bg-imminent/15 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-imminent">
            Flag signal
          </span>
        </div>

        <div
          className={classNames(
            "mt-3 font-mono text-clock-sm font-black tabular-nums leading-none text-imminent",
            strobe,
            paused && "opacity-40",
          )}
        >
          {countdown}
        </div>

        <div className="mt-4 rounded-lg border border-imminent/40 bg-ground/40 px-3 py-2.5">
          <p className="font-display text-base font-bold uppercase tracking-wide text-imminent">
            {raiseLabel}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Sound the horn and raise the flag when the timer hits zero — no boats
            start yet.
          </p>
        </div>
      </article>
    );
  }

  // warning — flag raised, counting to first gun
  const flagMs = activeMilestoneMs ?? firstSignalMs;
  const flagTitle = flagMs ? `${flagSignalLabel(flagMs)} flag raised` : "Sequence";
  const countdown = formatRaceStopwatch(syncedDisplayMsToFirstGun(msSinceFirstGun));

  return (
    <article
      className={classNames(
        "relative overflow-hidden rounded-xl border-2 p-4 transition-colors duration-200",
        imminent ? "border-imminent bg-imminent/10" : "border-line-strong bg-panel-2",
      )}
    >
      <div className="flag-strip mb-3" />
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted">
          {sequenceLabel}
        </p>
        <FlagIcon className="h-4 w-4 shrink-0 text-imminent" />
      </div>

      <p className="mt-2 font-display text-2xl font-bold uppercase leading-tight tracking-wide text-imminent">
        {flagTitle}
      </p>
      <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        Flag period · boats not away
      </p>

      <div
        className={classNames(
          "mt-4 font-mono text-clock-sm font-black tabular-nums leading-none",
          imminent ? "text-imminent" : "text-ink",
          strobe,
          paused && "opacity-40",
        )}
      >
        {countdown}
      </div>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted">
        to first gun
      </p>

      {names && (
        <p className="mt-3 truncate border-t border-line pt-2.5 text-sm text-muted">
          <span className="uppercase tracking-wider">1st away</span>
          <span className="text-muted/70"> · </span>
          <span className="font-display font-semibold text-ink">{names}</span>
        </p>
      )}
    </article>
  );
}
