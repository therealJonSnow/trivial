"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { classesByIds } from "@/lib/data";
import { buildSchedule, startTime } from "@/lib/schedule";
import { deriveTimer, firstGunEpoch, IMMINENT_MS } from "@/lib/timer";
import { formatCountdown, formatMmSs, formatClock, ordinal } from "@/lib/format";
import { unlockAudio } from "@/lib/audio";
import { useRace } from "@/store/useRaceStore";
import { useNow } from "@/hooks/useNow";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useRaceAudio } from "@/hooks/useRaceAudio";
import { useAudioKeepAlive } from "@/hooks/useAudioKeepAlive";
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
  // Top fade on the fleet queue — only once it's actually scrolled off its top,
  // so the base (unscrolled) state stays clean.
  const [queueScrolled, setQueueScrolled] = useState(false);
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
  useRaceAudio(
    live ? view!.msToNextHorn : null,
    live ? view!.takeoverKey : null,
    muted,
  );

  if (!clock || !schedule || !view) return null;

  const gun = firstGunEpoch(clock);
  const isFinishFlash = view.finishFlash;
  const isGo = !isFinishFlash && view.flashing !== null;
  const isSignal = !isFinishFlash && !isGo && view.signalFlashMs !== null;
  const isTakeover = isGo || isSignal || isFinishFlash;
  const isPreroll = view.phase === "preroll";
  const isWarning = view.phase === "warning";
  const isFinished = view.phase === "finished";
  const isImminent =
    !isTakeover &&
    !isFinished &&
    view.msToNextHorn !== null &&
    view.msToNextHorn <= IMMINENT_MS;

  // The full queue of not-yet-started classes — the list scrolls when it
  // overflows so the whole fleet is reachable, not just the next few.
  const upcoming = schedule.starts.filter(
    (s) => !view.startedOrders.includes(s.order),
  );

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
                {milestoneLabel(view.activeMilestoneMs)} flag raised
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

      {/* upcoming queue — zebra-striped table; scrolls when the fleet overflows */}
      {!isTakeover && upcoming.length > 0 && (
        <div className="relative mb-3 overflow-hidden rounded-lg">
          <ul
            className="max-h-44 overflow-y-auto"
            onScroll={(e) => setQueueScrolled(e.currentTarget.scrollTop > 0)}
          >
            {(() => {
              // Stripe parity counts only the non-active rows, so the pattern is
              // always signal → no-bg → zebra → … and stays stable as started
              // boats drop off the top of the queue.
              let stripe = -1;
              return upcoming.map((s) => {
                const isNext = view.nextStart?.order === s.order;
                if (!isNext) stripe += 1;
                const tone = isNext
                  ? "bg-signal"
                  : stripe % 2 === 1
                    ? "bg-panel"
                    : "";
                const meta = isNext ? "text-black/70" : "text-muted";
                return (
                  <li
                    key={s.order}
                    className={`flex items-center gap-3 px-3 py-2.5 ${tone}`}
                  >
                    <span className={`w-8 shrink-0 font-mono text-xs tabular-nums ${meta}`}>
                      {ordinal(s.order)}
                    </span>
                    <span
                      className={`min-w-0 flex-1 truncate text-sm ${
                        isNext ? "font-semibold text-black" : "text-ink"
                      }`}
                    >
                      {s.classes.map((c) => c.name).join(" + ")}
                    </span>
                    <span className={`shrink-0 font-mono text-xs tabular-nums ${meta}`}>
                      {formatClock(startTime(s, gun))}
                    </span>
                  </li>
                );
              });
            })()}
          </ul>
          {/* Fade the top edge once scrolled, signalling more fleet above. */}
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-x-0 top-0 h-7 bg-gradient-to-b from-ground to-transparent transition-opacity duration-200 ${
              queueScrolled ? "opacity-100" : "opacity-0"
            }`}
          />
        </div>
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
