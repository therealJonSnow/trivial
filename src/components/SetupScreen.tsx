"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { pyMeta, resolveClasses } from "@/lib/data";
import { buildSchedule } from "@/lib/schedule";
import { unlockAudio, playHorn } from "@/lib/audio";
import { formatClock } from "@/lib/format";
import { exportSchedulePdf } from "@/lib/exportPdf";
import {
  useCustomClasses,
  useFavourites,
  useRace,
  resolveDurationMinutes,
} from "@/store/useRaceStore";
import {
  SEQUENCES,
  START_SEQUENCE_OPTIONS,
  preRollForSequence,
  type StartSequence,
} from "@/lib/timer";
import { DurationCard } from "./DurationCard";
import { ScheduleList } from "./ScheduleList";
import { ThemeToggle } from "./ThemeToggle";
import { ClassPicker } from "./ClassPicker";
import { StartConfirm } from "./StartConfirm";

export function SetupScreen() {
  const { favourites, toggleFavourite } = useFavourites();
  const { customClasses, addCustomClass, updateCustomClass, deleteCustomClass } =
    useCustomClasses();
  const {
    selectedIds,
    durationMinutes,
    durationMode,
    referenceClassId,
    referenceMinutes,
    startSequence,
    toggleSelected,
    setSelected,
    setDuration,
    setDurationMode,
    setReferenceClass,
    setReferenceMinutes,
    setStartSequence,
    start,
  } = useRace();

  const [confirming, setConfirming] = useState(false);
  const [picking, setPicking] = useState(false);
  // Client-only "now" for the projected finish estimate — null on the server so
  // there's no hydration mismatch; refreshed slowly (this is a planning hint).
  const [nowTs, setNowTs] = useState<number | null>(null);

  // First use (no restored race): pre-select favourites per spec §"Favourites".
  useEffect(() => {
    if (selectedIds.length === 0 && favourites.length > 0) setSelected(favourites);
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setNowTs(Date.now());
    const id = setInterval(() => setNowTs(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const selected = useMemo(
    () => resolveClasses(selectedIds, customClasses),
    [selectedIds, customClasses],
  );

  const effectiveDuration = resolveDurationMinutes(
    { durationMode, durationMinutes, referenceClassId, referenceMinutes },
    selected,
  );

  const schedule = useMemo(
    () => buildSchedule(selected, effectiveDuration),
    [selected, effectiveDuration],
  );

  // Wall-clock finish if the race were started right now: count-in + sequence
  // lead-in + the full window. A planning hint, hence the "if you start now".
  const finishAt =
    nowTs !== null && schedule
      ? new Date(
          nowTs +
            preRollForSequence(startSequence) +
            SEQUENCES[startSequence].warningMs +
            effectiveDuration * 60_000,
        )
      : null;

  // Keep the reference class pinned in the fleet while in by-class mode (it can
  // be removed via the fleet picker) — the anchor must be a boat that's racing.
  useEffect(() => {
    if (
      durationMode === "class" &&
      referenceClassId !== null &&
      selectedIds.length > 0 &&
      !selectedIds.includes(referenceClassId)
    ) {
      toggleSelected(referenceClassId);
    }
  }, [durationMode, referenceClassId, selectedIds, toggleSelected]);

  const handleDeleteCustom = (id: number) => {
    deleteCustomClass(id);
    setSelected(selectedIds.filter((x) => x !== id));
  };

  const count = selectedIds.length;

  return (
    <div className="instrument-bg mx-auto flex min-h-dvh max-w-screen flex-col px-4 pb-40 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="min-h-full max-w-md mx-auto">

      <header className="mb-5">
        <div className="flex items-start justify-between">
          <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-[0.32em] text-ink">
            Trivial
          </h1>
          <div className="flex items-center gap-3">
            <Link
              href="/about"
              className="mt-1 font-mono text-[10px] tabular-nums text-muted underline-offset-2 active:text-ink"
            >
              About & Guide ›
            </Link>
            <ThemeToggle />
          </div>
        </div>
        <p className="mt-1.5 font-display text-[11px] font-medium uppercase tracking-[0.28em] text-signal">
          Pursuit race start timer
        </p>
      </header>

      <DurationCard
        selected={selected}
        durationMode={durationMode}
        durationMinutes={durationMinutes}
        referenceClassId={referenceClassId}
        referenceMinutes={referenceMinutes}
        onSetDuration={setDuration}
        onSetDurationMode={setDurationMode}
        onSetReferenceClass={setReferenceClass}
        onSetReferenceMinutes={setReferenceMinutes}
      />

      <div className="card mb-4 flex flex-col gap-3">
        <h2 className="card-title">Start sequence</h2>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <select
              id="start-sequence"
              value={startSequence}
              onChange={(e) => setStartSequence(e.target.value as StartSequence)}
              className="select-field tabular-nums"
            >
              {START_SEQUENCE_OPTIONS.map((seq) => (
                <option key={seq} value={seq}>
                  {seq}
                </option>
              ))}
            </select>
            <span className="select-chevron" aria-hidden>
              ▾
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              unlockAudio();
              playHorn();
            }}
            className="btn-secondary h-11"
          >
            🔊 Test horn
          </button>
        </div>
      </div>

      {/* Fleet / start order — the hero. Tap to open the fullscreen picker. */}
      {schedule ? (
        <section className="overflow-hidden rounded-xl border border-line bg-panel">
          <div className="flex w-full items-center justify-between border-b border-line p-4">
            <h2 className="card-title">Start order</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  exportSchedulePdf({
                    schedule,
                    duration:
                      durationMode === "class"
                        ? {
                            mode: "class",
                            totalMinutes: effectiveDuration,
                            referenceName:
                              selected.find((c) => c.id === referenceClassId)?.name ??
                              "reference class",
                            referenceMinutes,
                          }
                        : { mode: "fixed", totalMinutes: effectiveDuration },
                    startSequence,
                    pyMeta,
                    generatedAt: Date.now(),
                  })
                }
                className="btn-secondary"
              >
                Export PDF
              </button>
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="btn-primary"
              >
                Edit fleet ›
              </button>
            </div>
          </div>

          <div className="py-2.5">
            <ScheduleList schedule={schedule} animateIn gutterClass="px-4" />
          </div>

          <p className="hint border-t border-line px-3 py-2.5">
            Slowest away first at <span className="font-mono text-ink">+0:00</span> — fastest
            chases, all converge at the finish
            {finishAt && (
              <>
                {" "}
                <span className="font-mono tabular-nums text-ink">
                  ≈ {formatClock(finishAt)}
                </span>{" "}
                if you start now
              </>
            )}
            .
          </p>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="group flex w-full flex-col items-center rounded-xl border border-dashed border-line px-5 py-10 text-center active:border-signal"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-signal text-2xl leading-none text-signal">
            +
          </span>
          <span className="card-title mt-3">Build your fleet</span>
          <span className="hint mt-1.5 max-w-xs text-center">
            {favourites.length > 0
              ? "Add your starred classes or search the full PY list."
              : "Search and tap classes to add them. Star ★ any to save as favourites."}
          </span>
        </button>
      )}

      <p className="mt-auto pt-6 text-center font-mono text-[10px] tabular-nums text-muted">
        {pyMeta.source} v{pyMeta.version} · {pyMeta.lastUpdated}
      </p>

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md bg-gradient-to-t from-ground via-ground to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8">
        <button
          type="button"
          disabled={count === 0}
          onClick={() => {
            setConfirming(true);
          }}
          className="h-16 w-full rounded-2xl bg-imminent font-display text-2xl font-bold uppercase tracking-[0.16em] text-ground transition-opacity active:opacity-90 disabled:bg-line disabled:text-muted"
        >
          Continue
        </button>
      </div>

      {picking && (
        <ClassPicker
          selectedIds={selectedIds}
          favourites={favourites}
          onToggleSelected={toggleSelected}
          onToggleFavourite={toggleFavourite}
          onClear={() => setSelected([])}
          onClose={() => setPicking(false)}
          customClasses={customClasses}
          onAddCustomClass={addCustomClass}
          onUpdateCustomClass={updateCustomClass}
          onDeleteCustomClass={handleDeleteCustom}
        />
      )}

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
    </div>
  );
}
