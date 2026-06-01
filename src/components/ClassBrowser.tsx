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
          className="mb-3 h-11 w-full rounded-lg border border-line bg-panel px-3 text-ink placeholder:text-muted"
        />
      )}

      {favClasses.length > 0 && (
        <ClassGroup
          title="Favourites"
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
        <p className="py-10 text-center text-sm text-muted">
          No classes match “{query.trim()}”.
        </p>
      )}
    </>
  );
}

interface ClassGroupProps {
  title: string;
  classes: BoatClass[];
  selectedSet: Set<number>;
  favSet: Set<number>;
  lockedSet: Set<number>;
  onToggleSelected: (id: number) => void;
  onToggleFav: (id: number) => void;
}

function ClassGroup({
  title,
  classes,
  selectedSet,
  favSet,
  lockedSet,
  onToggleSelected,
  onToggleFav,
}: ClassGroupProps) {
  return (
    <section className="mb-4">
      <h3 className="mb-1 text-xs uppercase tracking-wider text-muted">{title}</h3>
      <ul className="divide-y divide-line overflow-hidden rounded-xl bg-panel">
        {classes.map((c) => {
          const selected = selectedSet.has(c.id);
          const locked = lockedSet.has(c.id);
          return (
            <li key={c.id} className="flex items-center">
              <button
                type="button"
                disabled={locked}
                onClick={() => onToggleSelected(c.id)}
                className="flex min-h-[44px] flex-1 items-center gap-3 px-3 py-2 text-left disabled:opacity-100"
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${
                    locked
                      ? "border-started bg-started text-ground"
                      : selected
                        ? "border-imminent bg-imminent text-ground"
                        : "border-line text-transparent"
                  }`}
                >
                  {locked ? "●" : "✓"}
                </span>
                <span
                  className={`flex-1 truncate ${selected || locked ? "text-ink" : "text-muted"}`}
                >
                  {c.name}
                  {locked && (
                    <span className="ml-2 text-[10px] uppercase text-started">started</span>
                  )}
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
