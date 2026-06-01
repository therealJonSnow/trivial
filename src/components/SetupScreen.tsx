"use client";

import { useEffect, useMemo, useState } from "react";
import { classesByIds, pyMeta } from "@/lib/data";
import { buildSchedule } from "@/lib/schedule";
import { unlockAudio } from "@/lib/audio";
import { useFavourites, useRace } from "@/store/useRaceStore";
import { Stepper } from "./Stepper";
import { ScheduleList } from "./ScheduleList";
import { ClassPicker } from "./ClassPicker";
import { StartConfirm } from "./StartConfirm";

export function SetupScreen() {
  const { favourites, toggleFavourite } = useFavourites();
  const {
    selectedIds,
    durationMinutes,
    startSequence,
    toggleSelected,
    setSelected,
    setDuration,
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

  const schedule = useMemo(
    () => buildSchedule(classesByIds(selectedIds), durationMinutes),
    [selectedIds, durationMinutes],
  );

  const count = selectedIds.length;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="mb-5">
        <h1 className="text-lg font-bold uppercase tracking-[0.3em] text-ink">Trivial</h1>
        <p className="text-xs text-muted">Make pursuit trivial.</p>
      </header>

      {/* Matched control pair: equal card height, shared caption + 44px control row. */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <Stepper
          label="Duration"
          value={durationMinutes}
          unit="min"
          step={5}
          onChange={setDuration}
        />
        <div className="flex flex-col gap-2 rounded-xl bg-panel p-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Sequence
          </div>
          <div
            role="radiogroup"
            aria-label="Start sequence"
            className="grid h-11 grid-cols-2 gap-1 rounded-lg bg-line p-1"
          >
            {(["5-4-1", "3-2-1"] as const).map((seq) => {
              const active = startSequence === seq;
              return (
                <button
                  key={seq}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setStartSequence(seq)}
                  className={`rounded-md font-mono text-base font-bold tabular-nums transition-colors ${
                    active ? "bg-imminent text-ground" : "text-muted active:text-ink"
                  }`}
                >
                  {seq}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fleet / schedule — the hero. Tap Edit to open the fullscreen picker. */}
      {schedule ? (
        <section className="overflow-hidden rounded-xl bg-panel">
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="flex w-full items-center justify-between gap-3 border-b border-line px-3 py-2.5 text-left active:bg-line/40"
          >
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              Start schedule
            </h2>
            <span className="flex items-center gap-2 text-sm font-semibold text-ink">
              <span className="font-mono text-xs tabular-nums text-muted">
                {count} {count === 1 ? "class" : "classes"}
              </span>
              <span className="text-imminent">Edit ›</span>
            </span>
          </button>

          <div className="px-3 py-2">
            <ScheduleList schedule={schedule} />
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="flex w-full flex-col items-center rounded-xl border border-dashed border-line px-5 py-8 text-center active:border-imminent"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-imminent text-2xl leading-none text-imminent">
            +
          </span>
          <span className="mt-3 text-base font-semibold text-ink">Build your fleet</span>
          <span className="mt-1 max-w-xs text-xs text-muted">
            {favourites.length > 0
              ? "Add your starred classes or search the full PY list."
              : "Search and tap classes to add them. Star ★ any to save as favourites."}
          </span>
        </button>
      )}

      <p className="mt-auto pt-6 text-center text-[10px] text-muted">
        PY {pyMeta.source} v{pyMeta.version} · {pyMeta.lastUpdated}
      </p>

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          disabled={count === 0}
          onClick={() => setConfirming(true)}
          className="h-16 w-full rounded-2xl bg-imminent text-xl font-bold uppercase tracking-wider text-ground active:opacity-90 disabled:bg-line disabled:text-muted"
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
  );
}
