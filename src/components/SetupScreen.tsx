"use client";

import { useEffect, useMemo, useState } from "react";
import { allClasses, classesByIds, pyMeta } from "@/lib/data";
import { buildSchedule } from "@/lib/schedule";
import { useFavourites, useRace } from "@/store/useRaceStore";
import { Stepper } from "./Stepper";
import { ScheduleList } from "./ScheduleList";
import type { BoatClass, Category } from "@/lib/types";

const CATEGORY_LABEL: Record<Category, string> = {
  dinghy: "Dinghy",
  multihull: "Multihull",
  experimental: "Experimental",
};

export function SetupScreen() {
  const { favourites, toggleFavourite } = useFavourites();
  const {
    selectedIds,
    durationMinutes,
    warningMinutes,
    toggleSelected,
    setSelected,
    setDuration,
    setWarning,
    start,
  } = useRace();

  const [query, setQuery] = useState("");

  // First use (no restored race): pre-select favourites per spec §"Favourites".
  useEffect(() => {
    if (selectedIds.length === 0 && favourites.length > 0) setSelected(favourites);
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const favSet = useMemo(() => new Set(favourites), [favourites]);

  const schedule = useMemo(
    () => buildSchedule(classesByIds(selectedIds), durationMinutes),
    [selectedIds, durationMinutes],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q === ""
      ? allClasses
      : allClasses.filter((c) => c.name.toLowerCase().includes(q));
  }, [query]);

  // Favourites first, then by category.
  const favClasses = filtered.filter((c) => favSet.has(c.id));
  const byCategory = (cat: Category) =>
    filtered.filter((c) => c.category === cat && !favSet.has(c.id));

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
        <Stepper
          label="Warning"
          value={warningMinutes}
          unit="min"
          step={1}
          onChange={setWarning}
        />
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

      <input
        type="search"
        inputMode="search"
        placeholder="Search classes…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-3 h-11 w-full rounded-lg border border-line bg-panel px-3 text-ink placeholder:text-muted"
      />

      <div className="flex-1">
        {favClasses.length > 0 && (
          <ClassGroup
            title="Favourites"
            classes={favClasses}
            selectedSet={selectedSet}
            favSet={favSet}
            onToggleSelected={toggleSelected}
            onToggleFav={toggleFavourite}
          />
        )}
        {(["dinghy", "multihull", "experimental"] as Category[]).map((cat) => {
          const list = byCategory(cat);
          if (list.length === 0) return null;
          return (
            <ClassGroup
              key={cat}
              title={CATEGORY_LABEL[cat]}
              classes={list}
              selectedSet={selectedSet}
              favSet={favSet}
              onToggleSelected={toggleSelected}
              onToggleFav={toggleFavourite}
            />
          );
        })}
      </div>

      <p className="mt-4 text-center text-[10px] text-muted">
        PY {pyMeta.source} v{pyMeta.version} · {pyMeta.lastUpdated}
      </p>

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md px-4 pb-4">
        <button
          type="button"
          disabled={selectedIds.length === 0}
          onClick={start}
          className="h-16 w-full rounded-2xl bg-imminent text-xl font-bold uppercase tracking-wider text-ground disabled:bg-line disabled:text-muted"
        >
          Start Race
        </button>
      </div>
    </div>
  );
}

interface ClassGroupProps {
  title: string;
  classes: BoatClass[];
  selectedSet: Set<number>;
  favSet: Set<number>;
  onToggleSelected: (id: number) => void;
  onToggleFav: (id: number) => void;
}

function ClassGroup({
  title,
  classes,
  selectedSet,
  favSet,
  onToggleSelected,
  onToggleFav,
}: ClassGroupProps) {
  return (
    <section className="mb-4">
      <h3 className="mb-1 text-xs uppercase tracking-wider text-muted">{title}</h3>
      <ul className="divide-y divide-line overflow-hidden rounded-xl bg-panel">
        {classes.map((c) => {
          const selected = selectedSet.has(c.id);
          return (
            <li key={c.id} className="flex items-center">
              <button
                type="button"
                onClick={() => onToggleSelected(c.id)}
                className="flex min-h-[44px] flex-1 items-center gap-3 px-3 py-2 text-left"
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                    selected
                      ? "border-imminent bg-imminent text-ground"
                      : "border-line text-transparent"
                  }`}
                >
                  ✓
                </span>
                <span className={`flex-1 truncate ${selected ? "text-ink" : "text-muted"}`}>
                  {c.name}
                </span>
                <span className="font-mono text-xs text-muted">{c.py}</span>
              </button>
              <button
                type="button"
                aria-label={favSet.has(c.id) ? "Unfavourite" : "Favourite"}
                onClick={() => onToggleFav(c.id)}
                className={`flex h-11 w-11 items-center justify-center text-lg ${
                  favSet.has(c.id) ? "text-imminent" : "text-line"
                }`}
              >
                ★
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
