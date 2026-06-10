"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { classesByIds } from "@/lib/data";
import { buildSchedule } from "@/lib/schedule";
import {
  deriveTimer,
  firstGunEpoch,
  IMMINENT_MS,
  rapidCluster,
  syncedDisplayMsElapsed,
  syncedDisplayMsToFinish,
  syncedDisplayMsToFirstGun,
  syncedDisplayMsToFirstSignal,
} from "@/lib/timer";
import { formatRaceStopwatch } from "@/lib/format";
import { unlockAudio } from "@/lib/audio";
import { useRace } from "@/store/useRaceStore";
import { useNow } from "@/hooks/useNow";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useRaceAudio } from "@/hooks/useRaceAudio";
import { useAudioKeepAlive } from "@/hooks/useAudioKeepAlive";
import { HoldButton } from "./HoldButton";
import { StartCard, deriveStartCardState } from "./StartCard";
import { StartConfirm } from "./StartConfirm";
import type { ScheduledStart } from "@/lib/types";
import type { TimerView } from "@/lib/timer";

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

/** Whether a start sits in the active rapid cluster (large card + live countdown). */
function isInActiveCluster(
  start: ScheduledStart,
  view: TimerView,
  starts: ScheduledStart[],
): boolean {
  const anchor = view.burst?.members[0] ?? view.flashing ?? view.nextStart;
  if (!anchor) return false;
  return rapidCluster(starts, anchor).some((s) => s.order === start.order);
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
  // Top fade on the fleet queue — only once it's actually scrolled off its top,
  // so the base (unscrolled) state stays clean.
  const [queueScrolled, setQueueScrolled] = useState(false);
  const [queueScrolledBottom, setQueueScrolledBottom] = useState(false);
  const cardScrollRef = useRef<HTMLDivElement>(null);
  // Once the race has finished and its horn has been acknowledged, freeze the
  // per-frame tick and release the wake lock — nothing changes after this point.
  const [settled, setSettled] = useState(false);

  const schedule = useMemo(
    () => buildSchedule(classesByIds(selectedIds), durationMinutes, frame ?? undefined),
    [selectedIds, durationMinutes, frame],
  );

  const paused = clock?.pausedAtEpoch != null;
  const now = useNow(clock !== null && !paused && !settled);

  const view = clock && schedule ? deriveTimer(clock, schedule, now) : null;

  // "Settled" = finished AND past the finish-horn takeover; keep ticking until
  // then so the strobe, count-in beeps, and finish horn all still fire.
  const settledNow = view?.phase === "finished" && !view.finishFlash;
  useEffect(() => {
    if (settledNow !== settled) setSettled(settledNow);
  }, [settledNow, settled]);

  useWakeLock(clock !== null && !settled);
  // Keep the AudioContext from being suspended over a long race (iOS backup).
  useAudioKeepAlive(clock !== null && !settled);

  // Only sound cues while actively counting; pausing/awaiting freezes them.
  const live = view !== null && !paused;
  // Inside a burst the horns are seconds apart, so the −5..−1 count-in beeps
  // would smear across them — suppress the beeps there (the on-screen countdown
  // carries the anticipation); the per-member horns still fire via takeoverKey.
  useRaceAudio(
    live && view!.burst === null ? view!.msToNextHorn : null,
    live ? view!.takeoverKey : null,
    muted,
  );

  const scrollTargetOrder =
    view?.burst?.pulse && view.burst.next
      ? view.burst.next.order
      : view?.burst?.pulse
        ? view.burst.justFired.order
        : view?.nextStart?.order;

  useEffect(() => {
    if (view?.phase !== "race" || scrollTargetOrder === undefined) return;
    const el = cardScrollRef.current?.querySelector(
      `[data-start-order="${scrollTargetOrder}"]`,
    );
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [view?.phase, scrollTargetOrder, view?.startedOrders.length]);

  if (!clock || !schedule || !view) return null;

  const gun = firstGunEpoch(clock);
  const msSinceFirstGun = view.msSinceFirstGun;
  const isFinishFlash = view.finishFlash;
  const isSignal = !isFinishFlash && view.signalFlashMs !== null;
  const isFullBleed = isSignal || isFinishFlash;
  const isPreroll = view.phase === "preroll";
  const isWarning = view.phase === "warning";
  const isRace = view.phase === "race";
  const isFinished = view.phase === "finished";
  const isImminent =
    !isFullBleed &&
    !isFinished &&
    view.msToNextHorn !== null &&
    view.msToNextHorn <= IMMINENT_MS;

  const primaryColour = isImminent ? "text-imminent" : isWarning ? "text-ink" : "text-next";
  const strobe = isImminent && !paused ? "motion-safe:animate-strobe" : "";
  const showCardList = (isRace || isPreroll || isWarning) && schedule.starts.length > 0;

  const handleCardScroll = () => {
    const el = cardScrollRef.current;
    if (!el) return;
    setQueueScrolled(el.scrollTop > 0);
    setQueueScrolledBottom(el.scrollTop + el.clientHeight < el.scrollHeight - 8);
  };

  return (
    <div
      className={`mx-auto flex h-dvh max-h-dvh max-w-md flex-col overflow-hidden px-4 py-3 transition-colors duration-150 ${
        isFullBleed ? "bg-imminent" : "bg-ground"
      }`}
    >
      {/* master race clock + fleet entry + mute */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onOpenFleet}
            className={`flex h-9 items-center rounded-lg border px-3 font-mono text-xs font-bold uppercase tracking-wider ${
              isFullBleed ? "border-ground/40 text-ground/80" : "border-signal text-signal"
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
              isFullBleed
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
            isFullBleed ? "text-ground/70" : "text-muted"
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
          {view.phase === "race" &&
            ` · ${formatRaceStopwatch(syncedDisplayMsElapsed(msSinceFirstGun))}`}
        </span>
        <span
          className={`shrink-0 font-mono text-xs uppercase tracking-wider ${
            isFullBleed ? "text-ground/70" : "text-muted"
          }`}
        >
          fin{" "}
          {formatRaceStopwatch(
            syncedDisplayMsToFinish(schedule.finishFromFirstGunMs, msSinceFirstGun),
          )}
        </span>
      </div>

      {/* primary display — hero timers + full-height scrolling start cards */}
      <div
        className={`flex min-h-0 flex-1 flex-col overflow-hidden ${
          isRace ? "pt-3" : showCardList ? "gap-3 pt-2" : "items-center justify-center text-center"
        }`}
      >
        {(isSignal || isFinishFlash || (isFinished && !isFinishFlash)) && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            {isSignal ? (
              <>
                <div className="text-sm font-bold uppercase tracking-[0.4em] text-ground/70">
                  Signal
                </div>
                <div className="mt-1 font-mono text-clock font-black leading-none tabular-nums text-ground">
                  {formatRaceStopwatch(view.signalFlashMs!)}
                </div>
                <div className="mt-1 text-sm font-semibold uppercase tracking-[0.3em] text-ground/70">
                  Sound the horn
                </div>
              </>
            ) : isFinishFlash ? (
              <>
                <div className="font-mono text-clock font-black leading-none text-ground">
                  FINISH
                </div>
                <div className="mt-2 text-2xl font-bold text-ground">Race complete</div>
                <div className="mt-1 text-sm font-semibold uppercase tracking-[0.3em] text-ground/70">
                  Sound the horn
                </div>
              </>
            ) : (
              <>
                <div className="font-mono text-clock-sm font-black text-started">FINISH</div>
                <div className="mt-2 text-sm uppercase tracking-widest text-muted">
                  Race complete
                </div>
              </>
            )}
          </div>
        )}

        {isPreroll ? (
          <div className="shrink-0 text-center">
            <div className="mb-3 text-sm font-bold uppercase tracking-[0.4em] text-imminent">
              Get ready
            </div>
            <div
              className={`font-mono text-clock font-black leading-none tabular-nums text-imminent ${strobe}`}
            >
              {formatRaceStopwatch(
                syncedDisplayMsToFirstSignal(msSinceFirstGun, clock.warningMs),
              )}
            </div>
            <div className="mt-2 max-w-full truncate px-2 text-xl">
              <span className="uppercase tracking-widest text-muted">to first signal</span>
              {schedule.starts[0] && (
                <>
                  <span className="text-muted"> · </span>
                  <span className="text-ink">
                    {schedule.starts[0].classes.map((c) => c.name).join(" + ")}
                  </span>
                </>
              )}
            </div>
          </div>
        ) : isWarning ? (
          <div className="shrink-0 text-center">
            {milestoneLabel(view.activeMilestoneMs) && (
              <div className="mb-3 animate-pulse rounded-full border-2 border-imminent px-4 py-1 text-base font-bold uppercase tracking-[0.2em] text-imminent">
                {milestoneLabel(view.activeMilestoneMs)} flag raised
              </div>
            )}
            <div
              className={`font-mono text-clock font-black leading-none tabular-nums ${primaryColour} ${strobe} ${
                paused ? "opacity-40" : ""
              }`}
            >
              {formatRaceStopwatch(syncedDisplayMsToFirstGun(msSinceFirstGun))}
            </div>
            <div className="mt-2 max-w-full truncate px-2 text-xl uppercase tracking-widest text-muted">
              to first gun
            </div>
          </div>
        ) : null}

        {showCardList && (
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div
              ref={cardScrollRef}
              className="flex h-full flex-col gap-2 overflow-y-auto overscroll-contain py-1 pr-0.5"
              onScroll={handleCardScroll}
            >
              {schedule.starts.map((s) => {
                const inFocus =
                  isInActiveCluster(s, view, schedule.starts) ||
                  view.nextStart?.order === s.order;
                const state = deriveStartCardState(s, view, msSinceFirstGun, inFocus);
                const large =
                  state.kind !== "away" &&
                  (state.kind === "go" || inFocus || state.kind === "countdown");
                return (
                  <div key={s.order} data-start-order={s.order}>
                    <StartCard
                      start={s}
                      state={state}
                      msSinceFirstGun={msSinceFirstGun}
                      gunEpoch={gun}
                      isNext={view.nextStart?.order === s.order}
                      large={large}
                      paused={paused}
                    />
                  </div>
                );
              })}
            </div>
            <div
              aria-hidden
              className={`pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-ground to-transparent transition-opacity duration-200 ${
                queueScrolled ? "opacity-100" : "opacity-0"
              }`}
            />
            <div
              aria-hidden
              className={`pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-ground to-transparent transition-opacity duration-200 ${
                queueScrolledBottom ? "opacity-100" : "opacity-0"
              }`}
            />
          </div>
        )}
      </div>

      {/* controls */}
      <div className="shrink-0 space-y-2 pt-2 pb-[max(0px,env(safe-area-inset-bottom))]">
        {awaitingStart ? (
          <button
            type="button"
            onClick={() => {
              if (startSequence === "GO") {
                unlockAudio();
                start();
              } else {
                setConfirming(true);
              }
            }}
            className="h-16 w-full rounded-2xl bg-imminent text-xl font-bold uppercase tracking-wider text-ground"
          >
            Start sequence
          </button>
        ) : isFinished ? (
          <button
            type="button"
            onClick={stop}
            className="h-16 w-full rounded-2xl bg-started text-xl font-bold uppercase tracking-wider text-ground"
          >
            New race
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
        {isFinished ? (
          <HoldButton label="Rerun same fleet" onComplete={reset} className="w-full" />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <HoldButton label="Reset" onComplete={reset} />
            <HoldButton label="Stop" onComplete={stop} />
          </div>
        )}
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
