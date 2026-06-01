"use client";

import { useMemo, useState } from "react";
import { classesByIds } from "@/lib/data";
import { buildSchedule, startTime } from "@/lib/schedule";
import { deriveTimer, firstGunEpoch, IMMINENT_MS } from "@/lib/timer";
import { formatCountdown, formatMmSs, formatClock, ordinal } from "@/lib/format";
import { unlockAudio } from "@/lib/audio";
import { useRace } from "@/store/useRaceStore";
import { useNow } from "@/hooks/useNow";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useRaceAudio } from "@/hooks/useRaceAudio";
import { HoldButton } from "./HoldButton";
import { StartConfirm } from "./StartConfirm";

function milestoneLabel(ms: number | null): string | null {
  if (ms === null || ms <= 0) return null;
  const minutes = Math.round(ms / 60_000);
  return `${minutes} MINUTE${minutes === 1 ? "" : "S"}`;
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M4 9v6h4l5 4V5L8 9H4z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {muted ? (
        <path d="M17 9l4 6M21 9l-4 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      ) : (
        <path
          d="M16.5 8.5a5 5 0 010 7M18.5 6.5a8 8 0 010 11"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

interface TimerScreenProps {
  onOpenFleet: () => void;
}

export function TimerScreen({ onOpenFleet }: TimerScreenProps) {
  const {
    clock,
    frame,
    selectedIds,
    durationMinutes,
    startSequence,
    muted,
    awaitingStart,
    toggleMuted,
    start,
    pause,
    resume,
    reset,
    stop,
  } = useRace();

  const [confirming, setConfirming] = useState(false);

  const schedule = useMemo(
    () => buildSchedule(classesByIds(selectedIds), durationMinutes, frame ?? undefined),
    [selectedIds, durationMinutes, frame],
  );

  const paused = clock?.pausedAtEpoch != null;
  useWakeLock(clock !== null);
  const now = useNow(clock !== null && !paused);

  const view = clock && schedule ? deriveTimer(clock, schedule, now) : null;

  // Only sound cues while actively counting; pausing/awaiting freezes them.
  const live = view !== null && !paused;
  useRaceAudio(
    live ? view!.msToNextHorn : null,
    live ? view!.takeoverKey : null,
    muted,
  );

  if (!clock || !schedule || !view) return null;

  const gun = firstGunEpoch(clock);
  const isGo = view.flashing !== null;
  const isSignal = !isGo && view.signalFlashMs !== null;
  const isTakeover = isGo || isSignal;
  const isPreroll = view.phase === "preroll";
  const isWarning = view.phase === "warning";
  const isFinished = view.phase === "finished";
  const isImminent =
    !isTakeover &&
    !isFinished &&
    view.msToNextHorn !== null &&
    view.msToNextHorn <= IMMINENT_MS;

  const upcoming = schedule.starts
    .filter((s) => !view.startedOrders.includes(s.order))
    .slice(0, 4);

  const primaryColour = isImminent ? "text-imminent" : isWarning ? "text-ink" : "text-next";
  const strobe = isImminent && !paused ? "motion-safe:animate-strobe" : "";

  return (
    <div
      className={`mx-auto flex min-h-dvh max-w-md flex-col px-4 py-3 transition-colors duration-150 ${
        isTakeover ? "bg-imminent" : "bg-ground"
      }`}
    >
      {/* master race clock + fleet entry + mute */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onOpenFleet}
            className={`flex h-9 items-center rounded-lg border px-3 font-mono text-xs font-bold uppercase tracking-wider ${
              isTakeover ? "border-ground/40 text-ground/80" : "border-signal text-signal"
            }`}
          >
            + Class
          </button>
          <button
            type="button"
            onClick={toggleMuted}
            aria-label={muted ? "Unmute alerts" : "Mute alerts"}
            aria-pressed={muted}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
              isTakeover
                ? "border-ground/40 text-ground/80"
                : muted
                  ? "border-imminent/60 text-imminent/60"
                  : "border-imminent text-imminent"
            }`}
          >
            <SpeakerIcon muted={muted} />
          </button>
        </div>
        <span
          className={`min-w-0 truncate text-center font-mono text-xs uppercase tracking-wider ${
            isTakeover ? "text-ground/70" : "text-muted"
          }`}
        >
          {awaitingStart
            ? "Ready"
            : paused
              ? "Postponed"
              : isPreroll
                ? "Get ready"
                : isWarning
                  ? `${clock.sequence} sequence`
                  : isFinished
                    ? "Finished"
                    : "Racing"}
          {view.phase === "race" && ` · ${formatMmSs(Math.max(0, view.msSinceFirstGun))}`}
        </span>
        <span
          className={`shrink-0 font-mono text-xs uppercase tracking-wider ${
            isTakeover ? "text-ground/70" : "text-muted"
          }`}
        >
          fin {formatMmSs(view.toFinishMs)}
        </span>
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
        ) : isSignal ? (
          <>
            <div className="text-sm font-bold uppercase tracking-[0.4em] text-ground/70">
              Signal
            </div>
            <div className="mt-1 font-mono text-clock font-black leading-none tabular-nums text-ground">
              {formatMmSs(view.signalFlashMs!)}
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
        ) : isPreroll ? (
          <>
            <div className="mb-3 text-sm font-bold uppercase tracking-[0.4em] text-imminent">
              Get ready
            </div>
            <div
              className={`font-mono text-clock font-black leading-none tabular-nums text-imminent ${strobe}`}
            >
              {formatCountdown(view.countdownMs)}
            </div>
            <div className="mt-2 text-xl uppercase tracking-widest text-muted">
              to first signal
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
              className={`font-mono text-clock font-black leading-none tabular-nums ${primaryColour} ${strobe} ${
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
      {!isTakeover && upcoming.length > 0 && (
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
        {awaitingStart ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="h-16 w-full rounded-2xl bg-imminent text-xl font-bold uppercase tracking-wider text-ground"
          >
            Start sequence
          </button>
        ) : (
          <button
            type="button"
            onClick={paused ? resume : pause}
            className={`h-16 w-full rounded-2xl text-xl font-bold uppercase tracking-wider ${
              paused ? "bg-started text-ground" : "border border-line bg-panel text-ink"
            }`}
          >
            {paused ? "Resume" : "Pause"}
          </button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <HoldButton label="Reset" onComplete={reset} />
          <HoldButton label="Stop" onComplete={stop} />
        </div>
      </div>

      {confirming && (
        <StartConfirm
          sequence={startSequence}
          onConfirm={() => {
            unlockAudio();
            setConfirming(false);
            start();
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
