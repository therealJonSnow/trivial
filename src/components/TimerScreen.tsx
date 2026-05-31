"use client";

import { useMemo } from "react";
import { classesByIds } from "@/lib/data";
import { buildSchedule, startTime } from "@/lib/schedule";
import { deriveTimer, firstGunEpoch } from "@/lib/timer";
import { formatCountdown, formatMmSs, formatClock, ordinal } from "@/lib/format";
import { useRace } from "@/store/useRaceStore";
import { useNow } from "@/hooks/useNow";
import { useWakeLock } from "@/hooks/useWakeLock";
import { HoldButton } from "./HoldButton";

/** Anticipation cue: go amber in the final seconds before any gun. */
const IMMINENT_MS = 10_000;

function milestoneLabel(ms: number | null): string | null {
  if (ms === null) return null;
  if (ms === 5 * 60_000) return "5 MINUTES";
  if (ms === 3 * 60_000) return "3 MINUTES";
  if (ms === 60_000) return "1 MINUTE";
  return null;
}

export function TimerScreen() {
  const { clock, selectedIds, durationMinutes, pause, resume, reset, stop } = useRace();

  const schedule = useMemo(
    () => buildSchedule(classesByIds(selectedIds), durationMinutes),
    [selectedIds, durationMinutes],
  );

  const paused = clock?.pausedAtEpoch != null;
  useWakeLock(clock !== null);
  const now = useNow(clock !== null && !paused);

  if (!clock || !schedule) return null;

  const view = deriveTimer(clock, schedule, now);
  const gun = firstGunEpoch(clock);
  const isWarning = view.phase === "warning";
  const isFinished = view.phase === "finished";
  const isGo = view.flashing !== null;
  const isImminent = !isGo && !isFinished && view.countdownMs <= IMMINENT_MS;

  const upcoming = schedule.starts
    .filter((s) => !view.startedOrders.includes(s.order))
    .slice(0, 4);

  const primaryColour = isImminent ? "text-imminent" : isWarning ? "text-ink" : "text-next";

  return (
    <div
      className={`mx-auto flex min-h-dvh max-w-md flex-col px-4 py-3 transition-colors duration-150 ${
        isGo ? "bg-imminent" : "bg-ground"
      }`}
    >
      {/* master race clock */}
      <div
        className={`flex items-center justify-between font-mono text-xs uppercase tracking-wider ${
          isGo ? "text-ground/70" : "text-muted"
        }`}
      >
        <span>
          {paused
            ? "Postponed"
            : isWarning
              ? "Warning"
              : isFinished
                ? "Finished"
                : "Racing"}
          {!isWarning && ` · ${formatMmSs(Math.max(0, view.msSinceFirstGun))} elapsed`}
        </span>
        <span>finish {formatMmSs(view.toFinishMs)}</span>
      </div>

      {/* primary display */}
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        {isGo ? (
          <>
            <div className="font-mono text-clock font-black leading-none text-ground">
              GO
            </div>
            <div className="mt-2 max-w-full truncate px-2 text-2xl font-bold text-ground">
              {view.flashing!.classes.map((c) => c.name).join(" + ")}
            </div>
            <div className="mt-1 text-sm font-semibold uppercase tracking-[0.3em] text-ground/70">
              Sound the horn
            </div>
          </>
        ) : isFinished ? (
          <>
            <div className="font-mono text-clock-sm font-black text-started">FINISH</div>
            <div className="mt-2 text-sm uppercase tracking-widest text-muted">
              Race complete
            </div>
          </>
        ) : (
          <>
            {isWarning && milestoneLabel(view.activeMilestoneMs) && (
              <div className="mb-3 animate-pulse rounded-full border-2 border-imminent px-4 py-1 text-base font-bold uppercase tracking-[0.2em] text-imminent">
                {milestoneLabel(view.activeMilestoneMs)}
              </div>
            )}
            <div
              className={`font-mono text-clock font-black leading-none tabular-nums ${primaryColour} ${
                paused ? "opacity-40" : ""
              }`}
            >
              {formatCountdown(view.countdownMs)}
            </div>
            <div className="mt-2 max-w-full truncate px-2 text-xl">
              {isWarning ? (
                <span className="uppercase tracking-widest text-muted">to first gun</span>
              ) : view.nextStart ? (
                <span className={isImminent ? "text-imminent" : "text-ink"}>
                  next&nbsp;·&nbsp;
                  {view.nextStart.classes.map((c) => c.name).join(" + ")}
                </span>
              ) : (
                <span className="uppercase tracking-widest text-muted">all started</span>
              )}
            </div>
          </>
        )}
      </div>

      {/* upcoming queue */}
      {!isGo && upcoming.length > 0 && (
        <ul className="mb-3 max-h-44 space-y-1 overflow-y-auto">
          {upcoming.map((s) => {
            const isNext = view.nextStart?.order === s.order;
            return (
              <li
                key={s.order}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                  isNext ? "bg-panel" : "bg-panel/40"
                }`}
              >
                <span className="w-8 shrink-0 font-mono text-xs text-muted">
                  {ordinal(s.order)}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate text-sm ${isNext ? "text-next" : "text-muted"}`}
                >
                  {s.classes.map((c) => c.name).join(" + ")}
                  {s.isScratch && (
                    <span className="ml-1 text-[10px] uppercase text-muted">scratch</span>
                  )}
                </span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-muted">
                  {formatClock(startTime(s, gun))}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* controls */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={paused ? resume : pause}
          className={`h-16 w-full rounded-2xl text-xl font-bold uppercase tracking-wider ${
            paused ? "bg-started text-ground" : "border border-line bg-panel text-ink"
          }`}
        >
          {paused ? "Resume" : "Pause"}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <HoldButton label="Reset" onComplete={reset} />
          <HoldButton label="Stop" onComplete={stop} />
        </div>
      </div>
    </div>
  );
}
