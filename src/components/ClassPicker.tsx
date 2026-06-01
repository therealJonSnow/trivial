"use client";

import { useEffect, useMemo, useState } from "react";
import { classesByIds } from "@/lib/data";
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
 * Full-height fleet picker. Two zones, never mixed:
 *   1. a pinned header — search + a sticky "YOUR FLEET" tray of removable chips,
 *      so the officer always sees the fleet they've built while picking;
 *   2. the scrollable catalog (favourites + categories) beneath.
 * Done returns to the setup screen and its ready-to-go start order.
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

  // Chips follow selection order so the most recent additions trail the row.
  const fleet = useMemo(() => classesByIds(selectedIds), [selectedIds]);

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
      className="animate-sheet-in instrument-bg fixed inset-0 z-40 flex flex-col"
    >
      {/* Pinned header: title, search, and the live fleet tray. */}
      <header className="shrink-0 border-b border-line bg-ground/85 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close fleet picker"
            className="-ml-2 flex h-11 items-center gap-1 rounded-lg px-2 font-display text-sm font-semibold uppercase tracking-[0.18em] text-muted active:text-ink"
          >
            ‹ Back
          </button>
          <h1 className="font-display text-base font-bold uppercase tracking-[0.42em] text-ink">
            Fleet
          </h1>
          <button
            type="button"
            onClick={onClear}
            disabled={count === 0}
            className="flex h-11 items-center justify-end rounded-lg px-2 font-display text-xs font-semibold uppercase tracking-[0.18em] text-muted active:text-danger disabled:opacity-30"
          >
            Clear
          </button>
        </div>

        <div className="mx-auto mt-1 max-w-md">
          <div className="flag-strip" />
        </div>

        <div className="mx-auto mt-3 max-w-md">
          <div className="relative">
            <span
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            >
              ⌕
            </span>
            <input
              type="search"
              inputMode="search"
              autoFocus
              placeholder="Search the PY list…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-11 w-full rounded-lg border border-line bg-panel pl-9 pr-3 text-ink placeholder:text-muted focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal/60"
            />
          </div>
        </div>

        {/* Sticky fleet tray — the boats you've built so far. */}
        <div className="mx-auto max-w-md py-3">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
              Your fleet
            </span>
            <span className="font-mono text-xs font-medium tabular-nums text-signal">
              {count} {count === 1 ? "class" : "classes"}
            </span>
          </div>
          {count === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-3 py-2 text-xs text-muted">
              Tap classes below to build your fleet.
            </p>
          ) : (
            <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {fleet.map((c) => (
                <li key={c.id} className="animate-chip-in shrink-0">
                  <button
                    type="button"
                    onClick={() => onToggleSelected(c.id)}
                    aria-label={`Remove ${c.name} from fleet`}
                    className="flex items-center gap-2 rounded-full border border-signal/40 bg-signal/10 py-1.5 pl-3 pr-2 text-sm text-ink active:bg-signal/20"
                  >
                    <span className="max-w-[10rem] truncate">{c.name}</span>
                    <span className="font-mono text-[10px] tabular-nums text-signal/70">
                      {c.py}
                    </span>
                    <span
                      aria-hidden
                      className="flex h-4 w-4 items-center justify-center rounded-full bg-signal/25 text-[10px] leading-none text-ink"
                    >
                      ✕
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>

      {/* Scrollable catalog. */}
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

      {/* Persistent Done bar. Cyan, not amber — amber is reserved for the gun. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-ground via-ground/95 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8">
        <button
          type="button"
          onClick={onClose}
          className="pointer-events-auto mx-auto flex h-14 w-full max-w-md items-center justify-center gap-2 rounded-2xl bg-signal font-display text-lg font-bold uppercase tracking-[0.14em] text-ground active:opacity-90"
        >
          Done
          <span className="font-mono text-base font-medium tabular-nums opacity-70">
            {count} {count === 1 ? "class" : "classes"}
          </span>
        </button>
      </div>
    </div>
  );
}
