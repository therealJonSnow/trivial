"use client";

import { useMemo } from "react";
import { classesByIds } from "@/lib/data";
import { buildSchedule } from "@/lib/schedule";
import { deriveTimer, firstGunEpoch } from "@/lib/timer";
import { formatCountdown, formatMmSs } from "@/lib/format";
import { useRace } from "@/store/useRaceStore";
import { useNow } from "@/hooks/useNow";
import { useWakeLock } from "@/hooks/useWakeLock";
import { ScheduleList } from "./ScheduleList";
import { HoldButton } from "./HoldButton";

function milestoneLabel(ms: number | null): string | null {
  if (ms === null) return null;
  if (ms === 5 * 60_000) return "5 MIN";
  if (ms === 3 * 60_000) return "3 MIN";
  if (ms === 60_000) return "1 MIN";
  return null;
}

export function TimerScreen() {
  const {
    clock,
    selectedIds,
    durationMinutes,
    pause,
    resume,
    reset,
    stop,
  } = useRace();

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

  const upcoming = schedule.starts
    .filter((s) => !view.startedOrders.includes(s.order))
    .slice(0, 4);

  const primaryColour = view.flashing
    ? "text-imminent"
    : isWarning
      ? "text-ink"
      : "text-next";

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-3">
      {/* master race clock */}
      <div className="flex items-center justify-between font-mono text-xs uppercase tracking-wider text-muted">
        <span>
          {isWarning ? "Warning" : isFinished ? "Finished" : "Race"} ·{" "}
          {formatMmSs(Math.max(0, view.msSinceFirstGun))} elapsed
        </span>
        <span>finish in {formatMmSs(view.toFinishMs)}</span>
      </div>

      {/* primary display */}
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        {view.flashing ? (
          <>
            <div className="font-mono text-clock font-bold text-imminent">GO</div>
            <div className="mt-1 max-w-full truncate px-2 text-2xl font-semibold text-imminent">
              {view.flashing.classes.map((c) => c.name).join(" + ")}
            </div>
          </>
        ) : isFinished ? (
          <div className="font-mono text-clock-sm font-bold text-started">FINISH</div>
        ) : (
          <>
            {isWarning && milestoneLabel(view.activeMilestoneMs) && (
              <div className="mb-2 rounded-full border border-imminent px-3 py-1 text-sm font-bold uppercase tracking-widest text-imminent">
                {milestoneLabel(view.activeMilestoneMs)}
              </div>
            )}
            <div
              className={`font-mono text-clock font-bold tabular-nums ${primaryColour}`}
            >
              {formatCountdown(view.countdownMs)}
            </div>
            <div className="mt-1 max-w-full truncate px-2 text-xl text-muted">
              {isWarning
                ? "to first gun"
                : view.nextStart
                  ? `next: ${view.nextStart.classes.map((c) => c.name).join(" + ")}`
                  : "all started"}
            </div>
          </>
        )}
      </div>

      {/* upcoming queue */}
      {upcoming.length > 0 && (
        <div className="mb-3 max-h-40 overflow-y-auto rounded-xl bg-panel px-3">
          <ScheduleList schedule={{ ...schedule, starts: upcoming }} view={view} firstGunEpoch={gun} />
        </div>
      )}

      {/* controls */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={paused ? resume : pause}
          className={`h-16 w-full rounded-2xl text-xl font-bold uppercase tracking-wider ${
            paused ? "bg-started text-ground" : "bg-panel text-ink"
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
