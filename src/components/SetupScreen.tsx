"use client";

import { useEffect, useMemo, useState } from "react";
import { classesByIds, pyMeta } from "@/lib/data";
import { buildSchedule } from "@/lib/schedule";
import { unlockAudio } from "@/lib/audio";
import { useFavourites, useRace } from "@/store/useRaceStore";
import { Stepper } from "./Stepper";
import { ScheduleList } from "./ScheduleList";
import { ClassBrowser } from "./ClassBrowser";
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

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-28 pt-4">
      <header className="mb-4">
        <h1 className="text-lg font-bold uppercase tracking-[0.3em] text-ink">Trivial</h1>
        <p className="text-xs text-muted">Make pursuit trivial.</p>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <Stepper
          label="Duration"
          value={durationMinutes}
          unit="min"
          step={5}
          onChange={setDuration}
        />
        <div className="flex flex-col justify-between rounded-xl bg-panel px-3 py-2">
          <div className="text-xs uppercase tracking-wider text-muted">Start sequence</div>
          <div
            role="radiogroup"
            aria-label="Start sequence"
            className="mt-1 flex gap-1 rounded-lg bg-line p-1"
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
                  className={`h-9 flex-1 rounded-md font-mono text-sm font-bold tabular-nums ${
                    active ? "bg-imminent text-ground" : "text-muted"
                  }`}
                >
                  {seq}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {schedule ? (
        <section className="mb-4 rounded-xl bg-panel p-3">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-wider text-muted">
              Start schedule · {selectedIds.length} class
              {selectedIds.length === 1 ? "" : "es"}
            </h2>
            <button
              type="button"
              onClick={() => setSelected([])}
              className="text-xs text-muted underline"
            >
              Clear
            </button>
          </div>
          <ScheduleList schedule={schedule} />
        </section>
      ) : (
        <section className="mb-4 rounded-xl border border-dashed border-line p-5 text-center">
          <p className="text-sm text-ink">No classes selected</p>
          <p className="mt-1 text-xs text-muted">
            {favourites.length > 0
              ? "Tap your favourites below, or search the full list."
              : "Search and tap classes to build your fleet. Star ★ any to save as favourites."}
          </p>
        </section>
      )}

      <div className="flex-1">
        <ClassBrowser
          selectedIds={selectedIds}
          favourites={favourites}
          onToggleSelected={toggleSelected}
          onToggleFavourite={toggleFavourite}
        />
      </div>

      <p className="mt-4 text-center text-[10px] text-muted">
        PY {pyMeta.source} v{pyMeta.version} · {pyMeta.lastUpdated}
      </p>

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md px-4 pb-4">
        <button
          type="button"
          disabled={selectedIds.length === 0}
          onClick={() => setConfirming(true)}
          className="h-16 w-full rounded-2xl bg-imminent text-xl font-bold uppercase tracking-wider text-ground disabled:bg-line disabled:text-muted"
        >
          Start Race
        </button>
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
