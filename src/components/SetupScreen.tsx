"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { pyMeta, resolveClasses } from "@/lib/data";
import { buildSchedule } from "@/lib/schedule";
import { unlockAudio } from "@/lib/audio";
import {
  useCustomClasses,
  useFavourites,
  useRace,
  resolveDurationMinutes,
} from "@/store/useRaceStore";
import { START_SEQUENCE_OPTIONS, type StartSequence } from "@/lib/timer";
import { DurationCard } from "./DurationCard";
import { ScheduleList } from "./ScheduleList";
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

  // First use (no restored race): pre-select favourites per spec §"Favourites".
  useEffect(() => {
    if (selectedIds.length === 0 && favourites.length > 0) setSelected(favourites);
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div className="instrument-bg mx-auto flex min-h-dvh max-w-screen flex-col px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="min-h-full max-w-md mx-auto">

      <header className="mb-5">
        <div className="flex items-start justify-between">
          <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-[0.32em] text-ink">
            Trivial
          </h1>
          <Link
            href="/about"
            className="mt-1 font-mono text-[10px] tabular-nums text-muted underline-offset-2 active:text-ink"
          >
            About & Guide ›
          </Link>
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

      <div className="mb-4 flex flex-col gap-2 rounded-xl border border-line bg-panel p-3">
        <label
          htmlFor="start-sequence"
          className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-muted"
        >
          Start sequence
        </label>
        <div className="relative">
          <select
            id="start-sequence"
            value={startSequence}
            onChange={(e) => setStartSequence(e.target.value as StartSequence)}
            className="h-11 w-full appearance-none rounded-lg bg-line px-3 pr-9 font-mono text-base font-bold tabular-nums text-ink"
          >
            {START_SEQUENCE_OPTIONS.map((seq) => (
              <option key={seq} value={seq}>
                {seq}
              </option>
            ))}
          </select>
          <span
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-sm text-muted"
            aria-hidden
          >
            ▾
          </span>
        </div>
      </div>

      {/* Fleet / start order — the hero. Tap to open the fullscreen picker. */}
      {schedule ? (
        <section className="overflow-hidden rounded-xl border border-line bg-panel">
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="flex w-full items-center justify-between gap-3 border-b border-line px-3 py-3 text-left active:bg-line/40"
          >
            <h2 className="font-display text-lg font-semibold uppercase tracking-[0.22em] text-muted">
              Start order
            </h2>
            <span className="flex items-center gap-2.5">
              <span className="font-mono text-xs tabular-nums text-muted">
                {count} {count === 1 ? "class" : "classes"}
              </span>
              <span className="rounded-md bg-signal px-2 py-1 font-display text-sm font-semibold uppercase tracking-wider text-ground">
                Edit fleet ›
              </span>
            </span>
          </button>

          <div className="px-3 py-2.5">
            <ScheduleList schedule={schedule} animateIn />
          </div>

          <p className="border-t border-line px-3 py-2 text-[11px] text-muted">
            Slowest away first at <span className="font-mono text-ink">+0:00</span> — fastest
            chases, all converge at the finish.
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
          <span className="mt-3 font-display text-lg font-semibold uppercase tracking-wider text-ink">
            Build your fleet
          </span>
          <span className="mt-1.5 max-w-xs text-xs text-muted">
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
          onClick={() => setConfirming(true)}
          className="h-16 w-full rounded-2xl bg-imminent font-display text-2xl font-bold uppercase tracking-[0.16em] text-ground transition-opacity active:opacity-90 disabled:bg-line disabled:text-muted"
        >
          Start Race
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
