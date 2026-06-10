"use client";

import { useMemo, useState } from "react";
import { allClasses } from "@/lib/data";
import type { BoatClass, Category, CustomBoatClass } from "@/lib/types";

const CATEGORY_LABEL: Record<Category, string> = {
  dinghy: "Dinghy",
  multihull: "Multihull",
  experimental: "Experimental",
};

/** Soft bounds for a plausible Portsmouth Yardstick — outside this we warn, not block. */
const PY_SOFT_MIN = 400;
const PY_SOFT_MAX = 2000;

interface ClassBrowserProps {
  selectedIds: number[];
  favourites: number[];
  onToggleSelected: (id: number) => void;
  onToggleFavourite: (id: number) => void;
  /** Selected classes that cannot be removed (e.g. already started mid-race). */
  lockedIds?: number[];
  /**
   * Controlled search term. When provided, ClassBrowser renders the list only --
   * the parent owns the input (e.g. a sticky search bar in the picker sheet).
   * When omitted, ClassBrowser manages its own query and renders its own input.
   */
  query?: string;
  onQueryChange?: (q: string) => void;
  /** User-defined custom classes. When provided, a Custom section renders above Favourites. */
  customClasses?: CustomBoatClass[];
  onAddCustomClass?: (name: string, py: number) => void;
  onUpdateCustomClass?: (id: number, name: string, py: number) => void;
  onDeleteCustomClass?: (id: number) => void;
}

export function ClassBrowser({
  selectedIds,
  favourites,
  onToggleSelected,
  onToggleFavourite,
  lockedIds = [],
  query: controlledQuery,
  onQueryChange,
  customClasses,
  onAddCustomClass,
  onUpdateCustomClass,
  onDeleteCustomClass,
}: ClassBrowserProps) {
  const [internalQuery, setInternalQuery] = useState("");
  const controlled = controlledQuery !== undefined;
  const query = controlled ? controlledQuery : internalQuery;
  const setQuery = controlled ? onQueryChange! : setInternalQuery;

  const [editingCustomId, setEditingCustomId] = useState<number | null>(null);
  const [addingCustom, setAddingCustom] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPy, setFormPy] = useState("");

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const favSet = useMemo(() => new Set(favourites), [favourites]);
  const lockedSet = useMemo(() => new Set(lockedIds), [lockedIds]);

  const q = query.trim().toLowerCase();

  const filtered = useMemo(
    () => (q === "" ? allClasses : allClasses.filter((c) => c.name.toLowerCase().includes(q))),
    [q],
  );

  const filteredCustom = useMemo(() => {
    if (!customClasses) return [];
    return q === "" ? customClasses : customClasses.filter((c) => c.name.toLowerCase().includes(q));
  }, [customClasses, q]);

  const favClasses = filtered.filter((c) => favSet.has(c.id));
  const byCategory = (cat: Category) =>
    filtered.filter((c) => c.category === cat && !favSet.has(c.id));

  const showCustomSection =
    customClasses !== undefined &&
    (filteredCustom.length > 0 || q === "" || addingCustom || editingCustomId !== null);

  const startAdd = () => {
    setEditingCustomId(null);
    setAddingCustom(true);
    setFormName("");
    setFormPy("");
  };

  const startEdit = (c: CustomBoatClass) => {
    setAddingCustom(false);
    setEditingCustomId(c.id);
    setFormName(c.name);
    setFormPy(String(c.py));
  };

  const cancelForm = () => {
    setAddingCustom(false);
    setEditingCustomId(null);
    setFormName("");
    setFormPy("");
  };

  const saveForm = () => {
    const name = formName.trim();
    const py = Math.round(Number(formPy));
    if (!name || isNaN(py) || py <= 0) return;
    if (editingCustomId !== null) {
      onUpdateCustomClass?.(editingCustomId, name, py);
    } else if (addingCustom) {
      onAddCustomClass?.(name, py);
    }
    cancelForm();
  };

  const noResults = filtered.length === 0 && filteredCustom.length === 0 && !addingCustom;

  return (
    <>
      {!controlled && (
        <input
          type="search"
          inputMode="search"
          placeholder="Search classes..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mb-3 h-11 w-full rounded-lg border border-line bg-panel px-3 text-ink placeholder:text-muted focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal/60"
        />
      )}

      {showCustomSection && (
        <section className="mb-5">
          <h3 className="mb-1.5 flex items-center gap-1.5 px-1 font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
            <span>Custom</span>
            <span className="font-mono text-[10px] font-medium tabular-nums text-line">
              {customClasses?.length ?? 0}
            </span>
          </h3>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
            {filteredCustom.map((c) => {
              const selected = selectedSet.has(c.id);
              const locked = lockedSet.has(c.id);
              if (editingCustomId === c.id) {
                return (
                  <CustomFormRow
                    key={c.id}
                    name={formName}
                    py={formPy}
                    onNameChange={setFormName}
                    onPyChange={setFormPy}
                    onSave={saveForm}
                    onCancel={cancelForm}
                  />
                );
              }
              return (
                <li
                  key={c.id}
                  className={`relative flex items-center transition-colors ${
                    selected && !locked ? "bg-signal/[0.06]" : ""
                  }`}
                >
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
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs leading-none transition-colors ${
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
                    </span>
                    <span
                      className={`rounded-md px-1.5 py-0.5 font-mono text-xs tabular-nums ${
                        selected || locked ? "text-ink" : "text-muted"
                      }`}
                    >
                      {c.py}
                    </span>
                  </button>
                  {!locked && (
                    <>
                      <button
                        type="button"
                        aria-label={`Edit ${c.name}`}
                        onClick={() => startEdit(c)}
                        className="flex h-12 w-10 items-center justify-center text-base text-muted active:text-ink"
                      >
                        {"✏"}
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${c.name}`}
                        onClick={() => onDeleteCustomClass?.(c.id)}
                        className="flex h-12 w-10 items-center justify-center text-base text-muted active:text-danger"
                      >
                        {"✕"}
                      </button>
                    </>
                  )}
                </li>
              );
            })}
            {addingCustom ? (
              <CustomFormRow
                name={formName}
                py={formPy}
                onNameChange={setFormName}
                onPyChange={setFormPy}
                onSave={saveForm}
                onCancel={cancelForm}
              />
            ) : (
              <li>
                <button
                  type="button"
                  onClick={startAdd}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left active:bg-line/40"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-dashed border-signal text-xs leading-none text-signal">
                    +
                  </span>
                  <span className="text-[15px] text-signal">Add custom class</span>
                </button>
              </li>
            )}
          </ul>
        </section>
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
      {noResults && q !== "" && (
        <p className="py-12 text-center text-sm text-muted">
          No classes match &ldquo;{query.trim()}&rdquo;.
        </p>
      )}
    </>
  );
}

interface CustomFormRowProps {
  name: string;
  py: string;
  onNameChange: (v: string) => void;
  onPyChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

function CustomFormRow({
  name,
  py,
  onNameChange,
  onPyChange,
  onSave,
  onCancel,
}: CustomFormRowProps) {
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onSave();
    if (e.key === "Escape") onCancel();
  };
  const pyVal = Math.round(Number(py));
  const hasPy = py.trim() !== "" && !isNaN(pyVal);
  const isValid = name.trim() !== "" && hasPy && pyVal > 0;
  // Soft sanity range — most RYA handicaps sit here. Outside it we warn (likely a
  // typo) but never block: legitimately extreme classes still save.
  const outOfRange = hasPy && pyVal > 0 && (pyVal < PY_SOFT_MIN || pyVal > PY_SOFT_MAX);

  return (
    <li className="px-3 py-2">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          type="text"
          placeholder="Class name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={handleKey}
          className="h-9 min-w-0 flex-1 rounded-lg border border-signal/60 bg-ground px-2 text-sm text-ink placeholder:text-muted focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal/60"
        />
        <input
          type="text"
          inputMode="decimal"
          placeholder="PY"
          value={py}
          onChange={(e) => onPyChange(e.target.value)}
          onKeyDown={handleKey}
          className="h-9 w-16 rounded-lg border border-signal/60 bg-ground px-2 text-center font-mono text-sm text-ink placeholder:text-muted focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal/60"
        />
        <button
          type="button"
          onClick={onSave}
          disabled={!isValid}
          aria-label="Save"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-signal text-sm text-ground disabled:opacity-40"
        >
          {"✓"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-sm text-muted active:text-ink"
        >
          {"✕"}
        </button>
      </div>
      {outOfRange && (
        <p className="mt-1.5 text-[10px] text-imminent">
          PY {pyVal} looks unusual — handicaps are typically {PY_SOFT_MIN}–{PY_SOFT_MAX}. Saved
          as entered.
        </p>
      )}
    </li>
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
        {star && <span className="text-imminent">{"★"}</span>}
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
              {/* Selection rail -- a confident left edge on chosen rows. */}
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
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs leading-none transition-colors ${
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
                  className={`rounded-md px-1.5 py-0.5 font-mono text-xs tabular-nums ${
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
                {"★"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
