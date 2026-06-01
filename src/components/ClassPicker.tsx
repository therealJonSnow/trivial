"use client";

import { useEffect, useState } from "react";
import { ClassBrowser } from "./ClassBrowser";

interface ClassPickerProps {
  selectedIds: number[];
  favourites: number[];
  onToggleSelected: (id: number) => void;
  onToggleFavourite: (id: number) => void;
  onClear: () => void;
  onClose: () => void;
}

/**
 * Fullscreen fleet picker. Lifted out of the home screen so setup stays
 * uncluttered: the long, searchable class list gets the full viewport, a
 * pinned search bar, and a persistent Done bar carrying the live count.
 */
export function ClassPicker({
  selectedIds,
  favourites,
  onToggleSelected,
  onToggleFavourite,
  onClear,
  onClose,
}: ClassPickerProps) {
  const [query, setQuery] = useState("");
  const count = selectedIds.length;

  // Lock body scroll while the sheet owns the viewport, and wire Escape to close.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Select fleet"
      className="animate-sheet-in fixed inset-0 z-40 flex flex-col bg-ground"
    >
      {/* Pinned header + search — stays put while the list scrolls beneath. */}
      <header className="shrink-0 border-b border-line bg-ground/95 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close fleet picker"
            className="-ml-2 flex h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold uppercase tracking-wider text-muted active:text-ink"
          >
            ‹ Back
          </button>
          <h1 className="text-sm font-bold uppercase tracking-[0.3em] text-ink">Fleet</h1>
          <button
            type="button"
            onClick={onClear}
            disabled={count === 0}
            className="flex h-11 items-center justify-end rounded-lg px-2 text-xs font-semibold uppercase tracking-wider text-muted underline-offset-2 active:text-ink disabled:opacity-40 disabled:no-underline"
            style={{ textDecorationLine: count === 0 ? "none" : "underline" }}
          >
            Clear
          </button>
        </div>
        <div className="mx-auto mt-3 max-w-md">
          <input
            type="search"
            inputMode="search"
            autoFocus
            placeholder="Search classes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 w-full rounded-lg border border-line bg-panel px-3 text-ink placeholder:text-muted focus:border-imminent focus:outline-none"
          />
        </div>
      </header>

      {/* Scrollable list region. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-40 pt-4">
        <div className="mx-auto max-w-md">
          <ClassBrowser
            selectedIds={selectedIds}
            favourites={favourites}
            onToggleSelected={onToggleSelected}
            onToggleFavourite={onToggleFavourite}
            query={query}
            onQueryChange={setQuery}
          />
        </div>
      </div>

      {/* Persistent Done bar with the live count. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-ground via-ground/95 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8">
        <button
          type="button"
          onClick={onClose}
          className="pointer-events-auto mx-auto flex h-14 w-full max-w-md items-center justify-center gap-2 rounded-2xl bg-imminent text-lg font-bold uppercase tracking-wider text-ground active:opacity-90"
        >
          Done
          <span className="font-mono text-base tabular-nums opacity-70">
            {count} {count === 1 ? "class" : "classes"}
          </span>
        </button>
      </div>
    </div>
  );
}
