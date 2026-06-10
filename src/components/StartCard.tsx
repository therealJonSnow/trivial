"use client";

import type { ScheduledStart } from "@/lib/types";
import { IMMINENT_MS, msToStart, syncedDisplayMsToStart } from "@/lib/timer";
import { formatClock, formatRaceStopwatch, ordinal } from "@/lib/format";
import { startTime } from "@/lib/schedule";

export type StartCardState =
  | { kind: "go" }
  | { kind: "away" }
  | { kind: "countdown"; imminent: boolean }
  | { kind: "upcoming" };

export function deriveStartCardState(
  start: ScheduledStart,
  view: {
    startedOrders: number[];
    flashing: ScheduledStart | null;
    burst: {
      justFired: ScheduledStart;
      pulse: boolean;
    } | null;
  },
  msSinceFirstGun: number,
  inFocus = false,
): StartCardState {
  const order = start.order;

  if (view.burst?.pulse && view.burst.justFired.order === order) {
    return { kind: "go" };
  }
  if (view.flashing?.order === order) {
    return { kind: "go" };
  }
  if (view.startedOrders.includes(order)) {
    return { kind: "away" };
  }

  const ms = msToStart(start.startFromFirstGunMs, msSinceFirstGun);
  if (ms > 0) {
    const imminent = ms <= IMMINENT_MS;
    if (inFocus || imminent) {
      return { kind: "countdown", imminent };
    }
  }

  return { kind: "upcoming" };
}

interface StartCardProps {
  start: ScheduledStart;
  state: StartCardState;
  /** Shared race timeline position — every card snaps to the same second grid. */
  msSinceFirstGun: number;
  gunEpoch: number;
  /** True when this start is the fleet's next horn (drives the label). */
  isNext?: boolean;
  /** Large cards for the active window — readable at arm's length on deck. */
  large?: boolean;
  paused?: boolean;
}

function classNames(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function StartCard({
  start,
  state,
  msSinceFirstGun,
  gunEpoch,
  isNext = false,
  large = false,
  paused = false,
}: StartCardProps) {
  const names = start.classes.map((c) => c.name).join(" + ");
  const clock = formatClock(startTime(start, gunEpoch));
  const countdown = formatRaceStopwatch(
    syncedDisplayMsToStart(start.startFromFirstGunMs, msSinceFirstGun),
  );

  const isGo = state.kind === "go";
  const isAway = state.kind === "away";
  const isCountdown = state.kind === "countdown";
  const isImminent = isCountdown && state.imminent;
  const strobe =
    isImminent && !paused && !isGo ? "motion-safe:animate-strobe" : "";

  const shell = classNames(
    "relative overflow-hidden rounded-xl border transition-[colors,min-height,padding] duration-200",
    large ? "min-h-[7.5rem] p-4" : "px-3 py-2.5",
    isGo && "border-imminent bg-imminent text-ground",
    isAway && "border-started/40 bg-panel",
    isImminent && !isGo && "border-imminent bg-imminent/10 bg-panel",
    isCountdown && !isImminent && !isGo && "border-signal/40 bg-panel border-signal",
    !isGo && !isAway && !isCountdown && "border-line bg-panel",
    isGo && "motion-safe:animate-pulse",
  );

  const accent =
    isGo ? (
      <span className="absolute inset-y-0 left-0 w-1.5 bg-ground/50" aria-hidden />
    ) : isImminent ? (
      <span className="absolute inset-y-0 left-0 w-1.5 bg-imminent" aria-hidden />
    ) : isCountdown ? (
      <span className="absolute inset-y-0 left-0 w-1.5 bg-signal/60" aria-hidden />
    ) : null;

  const statusLabel = isGo
    ? "Sound horn"
    : isAway
      ? "Away"
      : isImminent
        ? isNext
          ? "Next start"
          : ""
        : isCountdown
          ? ""
          : "";

  return (
    <article className={shell}>
      {accent}
      <div className={classNames("flex h-full flex-col", large ? "gap-2 pl-2" : "gap-1 pl-1.5")}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p
              className={classNames(
                "font-mono text-xs font-bold uppercase tracking-wider",
                isGo ? "text-ground/70" : isAway ? "text-started" : isCountdown ? "text-signal" : "text-muted",
              )}
            >
              {statusLabel}
            </p>
            <h3
              className={classNames(
                "truncate font-display font-semibold leading-tight",
                large ? "text-2xl" : "text-sm",
                isGo ? "text-ground" : isAway ? "text-muted line-through decoration-started/50" : "text-ink",
              )}
            >
              {names}
            </h3>
          </div>
          {!isGo && (
            <span
              className={classNames(
                "shrink-0 font-mono tabular-nums",
                large ? "text-sm" : "text-xs",
                isAway ? "text-muted" : "text-muted",
              )}
            >
              {clock}
            </span>
          )}
        </div>

        {isGo && (
          <div
            className={classNames(
              "flex flex-1 flex-col items-center justify-center text-center",
              large ? "py-1" : "py-0.5",
            )}
          >
            <div
              className={classNames(
                "font-mono font-black leading-none text-ground",
                large ? "text-clock-sm" : "text-3xl",
              )}
            >
              GO
            </div>
          </div>
        )}

        {isCountdown && (
          <div className={classNames(large && "mt-1")}>
            <div
              className={classNames(
                "font-mono font-black tabular-nums leading-none",
                large ? "text-clock-sm" : "text-2xl",
                isImminent ? "text-imminent" : "text-ink",
                strobe,
                paused && "opacity-40",
              )}
            >
              {countdown}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
