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
} from "@/lib/timer";
import { formatRaceStopwatch } from "@/lib/format";
import { unlockAudio } from "@/lib/audio";
import { useRace } from "@/store/useRaceStore";
import { useNow } from "@/hooks/useNow";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useRaceAudio } from "@/hooks/useRaceAudio";
import { useAudioKeepAlive } from "@/hooks/useAudioKeepAlive";
import { HoldButton } from "./HoldButton";
import { FinishTimerCard, deriveFinishCardMode } from "./FinishTimerCard";
import { SequenceTimerCard, deriveSequenceCardMode } from "./SequenceTimerCard";
import { StartCard, deriveStartCardState } from "./StartCard";
import { StartConfirm } from "./StartConfirm";
import type { ScheduledStart } from "@/lib/types";
import type { TimerView } from "@/lib/timer";

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
    reset,
    stop,
  } = useRace();

  const [confirming, setConfirming] = useState(false);

  const handleReset = () => {
    reset();
    setConfirming(true);
  };
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
  useRaceAudio(live ? view!.msToNextHorn : null, live ? view!.takeoverKey : null, muted);

  const scrollTargetOrder =
    view?.burst?.pulse && view.burst.next
      ? view.burst.next.order
      : view?.burst?.pulse
        ? view.burst.justFired.order
        : view?.nextStart?.order;

  useEffect(() => {
    if (view?.phase !== "race" || scrollTargetOrder === undefined) return;
    const container = cardScrollRef.current;
    if (!container) return;
    const el =
      container.querySelector(`[data-start-order="${scrollTargetOrder}"]`) ??
      container.querySelector("[data-sequence-timer]");
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [view?.phase, scrollTargetOrder, view?.startedOrders.length]);

  if (!clock || !schedule || !view) return null;

  const gun = firstGunEpoch(clock);
  const msSinceFirstGun = view.msSinceFirstGun;
  const isFinishFlash = view.finishFlash;
  const isPreroll = view.phase === "preroll";
  const isWarning = view.phase === "warning";
  const isRace = view.phase === "race";
  const isFinished = view.phase === "finished";
  const isImminent =
    !isFinished &&
    view.msToNextHorn !== null &&
    view.msToNextHorn <= IMMINENT_MS;

  const firstStart = schedule.starts[0] ?? null;
  const sequenceMode = deriveSequenceCardMode(view, firstStart, msSinceFirstGun);
  const fleetStarts =
    sequenceMode !== null && firstStart
      ? schedule.starts.filter((s) => s.order !== firstStart.order)
      : schedule.starts;
  const allAway = view.nextStart === null && (isRace || isFinished);
  const finishMode = deriveFinishCardMode(view.phase, allAway, isFinishFlash);
  const showCardList =
    (isRace || isPreroll || isWarning) && fleetStarts.length > 0 && !allAway && !isFinished;
  const showScrollList = showCardList || sequenceMode !== null;
  const showFinishTimer = finishMode !== null;

  const handleCardScroll = () => {
    const el = cardScrollRef.current;
    if (!el) return;
    setQueueScrolled(el.scrollTop > 0);
    setQueueScrolledBottom(el.scrollTop + el.clientHeight < el.scrollHeight - 8);
  };

  return (
    <div className="mx-auto flex h-dvh max-h-dvh max-w-md flex-col overflow-hidden instrument-bg px-4 py-3">
      {/* master race clock + fleet entry + mute */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onOpenFleet}
            className="flex h-9 items-center rounded-lg border border-signal px-3 font-mono text-xs font-bold uppercase tracking-wider text-signal"
          >
            + Class
          </button>
          <button
            type="button"
            onClick={toggleMuted}
            aria-label={muted ? "Unmute alerts" : "Mute alerts"}
            aria-pressed={muted}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
              muted ? "border-imminent/60 text-imminent/60" : "border-imminent text-imminent"
            }`}
          >
            <SpeakerIcon muted={muted} />
          </button>
        </div>
        <span
          className="min-w-0 truncate text-center font-mono text-xs uppercase tracking-wider text-muted"
        >
          {awaitingStart
            ? "Ready"
            : paused
              ? "Postponed"
              : isPreroll
                ? "Get ready"
                : isWarning
                  ? `${clock.sequence} sequence`
                  : isFinishFlash
                    ? "Finish"
                    : isFinished
                      ? "Finished"
                      : allAway
                        ? "All away"
                        : "Racing"}
          {view.phase === "race" &&
            ` · ${formatRaceStopwatch(syncedDisplayMsElapsed(msSinceFirstGun))}`}
        </span>
        <span
          className={`shrink-0 font-mono text-xs uppercase tracking-wider ${
            isFinishFlash || isFinished || (allAway && isImminent)
              ? "text-imminent"
              : "text-muted"
          }`}
        >
          fin{" "}
          {formatRaceStopwatch(
            syncedDisplayMsToFinish(schedule.finishFromFirstGunMs, msSinceFirstGun),
          )}
        </span>
      </div>

      {/* primary display — scrolling start cards (sequence timer first, then fleet) */}
      <div
        className={`flex min-h-0 flex-1 flex-col overflow-hidden ${
          showScrollList || showFinishTimer ? "pt-3" : "items-center justify-center text-center"
        }`}
      >
        {showFinishTimer && finishMode && (
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div className="flex h-full flex-col justify-center py-1">
              <FinishTimerCard
                mode={finishMode}
                msSinceFirstGun={msSinceFirstGun}
                finishFromFirstGunMs={schedule.finishFromFirstGunMs}
                imminent={isImminent}
                paused={paused}
              />
            </div>
          </div>
        )}

        {showScrollList && (
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div
              ref={cardScrollRef}
              className="flex h-full flex-col gap-2 overflow-y-auto overscroll-contain py-1 pr-0.5"
              onScroll={handleCardScroll}
            >
              {sequenceMode !== null && (
                <div data-sequence-timer>
                  <SequenceTimerCard
                    mode={sequenceMode}
                    sequence={clock.sequence}
                    msSinceFirstGun={msSinceFirstGun}
                    warningMs={clock.warningMs}
                    sequenceLabel={`${clock.sequence} sequence`}
                    activeMilestoneMs={view.activeMilestoneMs}
                    signalFlashMs={view.signalFlashMs}
                    firstStart={firstStart}
                    imminent={isImminent}
                    paused={paused}
                  />
                </div>
              )}
              {fleetStarts.map((s) => {
                const inFocus =
                  isRace &&
                  (isInActiveCluster(s, view, schedule.starts) ||
                    view.nextStart?.order === s.order);
                const state = deriveStartCardState(s, view, msSinceFirstGun, inFocus);
                const large =
                  isRace &&
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
              setConfirming(true);
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
        ) : null}
        {isFinished ? (
          <HoldButton label="Rerun same fleet" onComplete={handleReset} className="w-full" />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <HoldButton label="Reset" onComplete={handleReset} />
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
