"use client";

import type { Phase } from "@/lib/timer";
import { syncedDisplayMsToFinish } from "@/lib/timer";
import { formatRaceStopwatch } from "@/lib/format";

export type FinishCardMode = "countdown" | "horn" | "complete";

export function deriveFinishCardMode(
  phase: Phase,
  allAway: boolean,
  finishFlash: boolean,
): FinishCardMode | null {
  if (!allAway && phase !== "finished") return null;
  if (finishFlash) return "horn";
  if (phase === "finished") return "complete";
  return "countdown";
}

interface FinishTimerCardProps {
  mode: FinishCardMode;
  msSinceFirstGun: number;
  finishFromFirstGunMs: number;
  imminent: boolean;
  paused: boolean;
}

function classNames(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Finish countdown, horn flash at 0:00, then the settled race-complete card.
 * Inline in the card list — no full-screen takeover.
 */
export function FinishTimerCard({
  mode,
  msSinceFirstGun,
  finishFromFirstGunMs,
  imminent,
  paused,
}: FinishTimerCardProps) {
  const countdown = formatRaceStopwatch(
    syncedDisplayMsToFinish(finishFromFirstGunMs, msSinceFirstGun),
  );
  const strobe = imminent && !paused ? "motion-safe:animate-strobe" : "";

  if (mode === "horn") {
    return (
      <article className="relative min-h-[7.5rem] overflow-hidden rounded-xl border-2 border-imminent bg-imminent p-4 motion-safe:animate-pulse">
        <span className="absolute inset-y-0 left-0 w-1.5 bg-ground/50" aria-hidden />
        <div className="flex h-full flex-col items-center justify-center gap-2 pl-2 text-center">
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-ground/70">
            Finish
          </p>
          <div
            className={classNames(
              "font-mono text-clock-sm font-black tabular-nums leading-none text-ground",
              !paused && "motion-safe:animate-strobe",
            )}
          >
            00:00
          </div>
          <p className="font-display text-lg font-bold uppercase tracking-wide text-ground">
            Sound the horn
          </p>
        </div>
      </article>
    );
  }

  if (mode === "complete") {
    return (
      <article className="relative overflow-hidden rounded-xl border border-started/40 bg-panel p-4 text-center">
        <span className="absolute inset-y-0 left-0 w-1.5 bg-started/60" aria-hidden />
        <div className="pl-1.5">
          <div className="font-mono text-clock-sm font-black leading-none text-started">FINISH</div>
          <p className="mt-2 text-sm font-semibold uppercase tracking-widest text-muted">
            Race complete
          </p>
        </div>
      </article>
    );
  }

  // countdown — all boats away, ticking to finish
  return (
    <article
      className={classNames(
        "relative min-h-[7.5rem] overflow-hidden rounded-xl border-2 p-4 transition-colors duration-200",
        imminent ? "border-imminent bg-imminent/10" : "border-line-strong bg-panel-2",
      )}
    >
      {imminent && (
        <span className="absolute inset-y-0 left-0 w-1.5 bg-imminent" aria-hidden />
      )}
      <div className={classNames("flex h-full flex-col justify-center", imminent && "pl-2")}>
        <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-started">
          All boats away
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
          to finish
        </p>
      </div>
    </article>
  );
}
