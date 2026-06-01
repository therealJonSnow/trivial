"use client";

import { useMemo, useState } from "react";
import { allClasses } from "@/lib/data";
import type { BoatClass, Category } from "@/lib/types";

const CATEGORY_LABEL: Record<Category, string> = {
  dinghy: "Dinghy",
  multihull: "Multihull",
  experimental: "Experimental",
};

interface ClassBrowserProps {
  selectedIds: number[];
  favourites: number[];
  onToggleSelected: (id: number) => void;
  onToggleFavourite: (id: number) => void;
  /** Selected classes that cannot be removed (e.g. already started mid-race). */
  lockedIds?: number[];
  /**
   * Controlled search term. When provided, ClassBrowser renders the list only —
   * the parent owns the input (e.g. a sticky search bar in the picker sheet).
   * When omitted, ClassBrowser manages its own query and renders its own input.
   */
  query?: string;
  onQueryChange?: (q: string) => void;
}

export function ClassBrowser({
  selectedIds,
  favourites,
  onToggleSelected,
  onToggleFavourite,
  lockedIds = [],
  query: controlledQuery,
  onQueryChange,
}: ClassBrowserProps) {
  const [internalQuery, setInternalQuery] = useState("");
  const controlled = controlledQuery !== undefined;
  const query = controlled ? controlledQuery : internalQuery;
  const setQuery = controlled ? onQueryChange! : setInternalQuery;

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const favSet = useMemo(() => new Set(favourites), [favourites]);
  const lockedSet = useMemo(() => new Set(lockedIds), [lockedIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q === ""
      ? allClasses
      : allClasses.filter((c) => c.name.toLowerCase().includes(q));
  }, [query]);

  const favClasses = filtered.filter((c) => favSet.has(c.id));
  const byCategory = (cat: Category) =>
    filtered.filter((c) => c.category === cat && !favSet.has(c.id));

  return (
    <>
      {!controlled && (
        <input
          type="search"
          inputMode="search"
          placeholder="Search classes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mb-3 h-11 w-full rounded-lg border border-line bg-panel px-3 text-ink placeholder:text-muted focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal/60"
        />
      )}

      {favClasses.length > 0 && (
        <ClassGroup
          title="Favourites"
          star
          classes={favClasses}
          selectedSet={selectedSet}
          favSet={favSet}
          lockedSet={lockedSet}
          onToggleSelected={onToggleSelected}
          onToggleFav={onToggleFavourite}
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
            lockedSet={lockedSet}
            onToggleSelected={onToggleSelected}
            onToggleFav={onToggleFavourite}
          />
        );
      })}
      {filtered.length === 0 && (
        <p className="py-12 text-center text-sm text-muted">
          No classes match “{query.trim()}”.
        </p>
      )}
    </>
  );
}

interface ClassGroupProps {
  title: string;
  /** Mark the group heading with a star (favourites). */
  star?: boolean;
  classes: BoatClass[];
  selectedSet: Set<number>;
  favSet: Set<number>;
  lockedSet: Set<number>;
  onToggleSelected: (id: number) => void;
  onToggleFav: (id: number) => void;
}

function ClassGroup({
  title,
  star = false,
  classes,
  selectedSet,
  favSet,
  lockedSet,
  onToggleSelected,
  onToggleFav,
}: ClassGroupProps) {
  return (
    <section className="mb-5">
      <h3 className="mb-1.5 flex items-center gap-1.5 px-1 font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
        {star && <span className="text-imminent">★</span>}
        <span>{title}</span>
        <span className="font-mono text-[10px] font-medium tabular-nums text-line">
          {classes.length}
        </span>
      </h3>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
        {classes.map((c) => {
          const selected = selectedSet.has(c.id);
          const locked = lockedSet.has(c.id);
          const isFav = favSet.has(c.id);
          return (
            <li
              key={c.id}
              className={`relative flex items-center transition-colors ${
                selected && !locked ? "bg-signal/[0.06]" : ""
              }`}
            >
              {/* Selection rail — a confident left edge on chosen rows. */}
              <span
                aria-hidden
                className={`absolute inset-y-0 left-0 w-[3px] ${
                  locked ? "bg-started" : selected ? "bg-signal" : "bg-transparent"
                }`}
              />
              <button
                type="button"
                disabled={locked}
                onClick={() => onToggleSelected(c.id)}
                className="flex min-h-[48px] flex-1 items-center gap-3 px-3 py-2 text-left disabled:opacity-100"
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border text-xs leading-none transition-colors ${
                    locked
                      ? "border-started bg-started text-ground"
                      : selected
                        ? "border-signal bg-signal text-ground"
                        : "border-line text-transparent"
                  }`}
                >
                  {locked ? "●" : "✓"}
                </span>
                <span
                  className={`flex-1 truncate text-[15px] ${
                    selected || locked ? "text-ink" : "text-muted"
                  }`}
                >
                  {c.name}
                  {locked && (
                    <span className="ml-2 align-middle font-display text-[10px] uppercase tracking-wider text-started">
                      started
                    </span>
                  )}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-xs tabular-nums ${
                    selected || locked ? "text-ink" : "text-muted"
                  }`}
                >
                  {c.py}
                </span>
              </button>
              <button
                type="button"
                aria-label={isFav ? "Unfavourite" : "Favourite"}
                onClick={() => onToggleFav(c.id)}
                className={`flex h-12 w-12 items-center justify-center text-lg transition-colors ${
                  isFav ? "text-imminent" : "text-line active:text-muted"
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
