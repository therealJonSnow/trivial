import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  armClock,
  pauseClock,
  resumeClock,
  PRE_ROLL_MS,
  type RaceClock,
  type StartSequence,
} from "@/lib/timer";
import { buildSchedule, frameFromSchedule, deriveDurationMinutes } from "@/lib/schedule";
import { resolveClasses, DEFAULT_REFERENCE_CLASS_ID } from "@/lib/data";
import type { BoatClass, CustomBoatClass, ScheduleFrame } from "@/lib/types";

/** Race-duration source: a fixed total window, or one pinned to a class's time. */
export type DurationMode = "fixed" | "class";

/** User-defined custom classes — persisted under `trivial.customClasses`. */
interface CustomClassesState {
  customClasses: CustomBoatClass[];
  addCustomClass: (name: string, py: number) => void;
  updateCustomClass: (id: number, name: string, py: number) => void;
  deleteCustomClass: (id: number) => void;
}

export const useCustomClasses = create<CustomClassesState>()(
  persist(
    (set) => ({
      customClasses: [],
      addCustomClass: (name, py) =>
        set((s) => {
          const nextId =
            s.customClasses.length === 0
              ? -1
              : Math.min(...s.customClasses.map((c) => c.id)) - 1;
          return { customClasses: [...s.customClasses, { id: nextId, name: name.trim(), py }] };
        }),
      updateCustomClass: (id, name, py) =>
        set((s) => ({
          customClasses: s.customClasses.map((c) =>
            c.id === id ? { ...c, name: name.trim(), py } : c,
          ),
        })),
      deleteCustomClass: (id) =>
        set((s) => ({ customClasses: s.customClasses.filter((c) => c.id !== id) })),
    }),
    { name: "trivial.customClasses" },
  ),
);

/** Favourites — persisted under `trivial.favourites`. */
interface FavouritesState {
  favourites: number[]; // class ids
  toggleFavourite: (id: number) => void;
  isFavourite: (id: number) => boolean;
}

export const useFavourites = create<FavouritesState>()(
  persist(
    (set, get) => ({
      favourites: [],
      toggleFavourite: (id) =>
        set((s) => ({
          favourites: s.favourites.includes(id)
            ? s.favourites.filter((f) => f !== id)
            : [...s.favourites, id],
        })),
      isFavourite: (id) => get().favourites.includes(id),
    }),
    { name: "trivial.favourites" },
  ),
);

/**
 * Race config + live clock. Config persists under `trivial.lastRace`; the
 * ephemeral clock is excluded from persistence via `partialize`.
 */
interface RaceState {
  // persisted config
  selectedIds: number[];
  durationMinutes: number;
  /** How the race window is set: a fixed total, or pinned to a reference class. */
  durationMode: DurationMode;
  /** Reference class whose on-water time is pinned in "class" mode. */
  referenceClassId: number | null;
  /** Minutes the reference class should sail in "class" mode. */
  referenceMinutes: number;
  startSequence: StartSequence;
  muted: boolean;
  // ephemeral
  clock: RaceClock | null;
  /** Locked timing reference for the running race (null when not running). */
  frame: ScheduleFrame | null;
  /** True when armed-but-not-running: a fresh reset awaiting a confirmed start. */
  awaitingStart: boolean;
  // config actions
  toggleSelected: (id: number) => void;
  setSelected: (ids: number[]) => void;
  setDuration: (minutes: number) => void;
  setDurationMode: (mode: DurationMode) => void;
  setReferenceClass: (id: number) => void;
  setReferenceMinutes: (minutes: number) => void;
  setStartSequence: (sequence: StartSequence) => void;
  toggleMuted: () => void;
  // race actions
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  stop: () => void;
}

export const MIN_DURATION = 5;
export const MAX_DURATION = 240;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Clamp an arbitrary minutes value to the app's race-window bounds. */
export const clampDuration = (minutes: number) =>
  clamp(Math.round(minutes), MIN_DURATION, MAX_DURATION);

type DurationConfig = Pick<
  RaceState,
  "durationMode" | "durationMinutes" | "referenceClassId" | "referenceMinutes"
>;

/**
 * Effective total race window (minutes) for a given config + fleet. In "fixed"
 * mode it's the typed window; in "class" mode it's the by-class derivation
 * clamped to the duration bounds. Shared by the setup preview and race start so
 * both agree on the window.
 */
export function resolveDurationMinutes(
  config: DurationConfig,
  selected: BoatClass[],
): number {
  if (config.durationMode !== "class") return config.durationMinutes;
  return clampDuration(
    deriveDurationMinutes(selected, config.referenceClassId, config.referenceMinutes),
  );
}

export const useRace = create<RaceState>()(
  persist(
    (set, get) => ({
      selectedIds: [],
      durationMinutes: 60,
      durationMode: "fixed",
      referenceClassId: DEFAULT_REFERENCE_CLASS_ID,
      referenceMinutes: 45,
      startSequence: "5-4-1",
      muted: false,
      clock: null,
      frame: null,
      awaitingStart: false,

      toggleSelected: (id) =>
        set((s) => ({
          selectedIds: s.selectedIds.includes(id)
            ? s.selectedIds.filter((x) => x !== id)
            : [...s.selectedIds, id],
        })),
      setSelected: (ids) => set({ selectedIds: ids }),
      setDuration: (minutes) => set({ durationMinutes: clampDuration(minutes) }),
      // Switching to class mode pins a reference (defaulting to ILCA 7, else the
      // first selected class) and auto-adds it to the fleet so the anchor always
      // races.
      setDurationMode: (mode) =>
        set((s) => {
          if (mode !== "class") return { durationMode: mode };
          const ref = s.referenceClassId ?? s.selectedIds[0] ?? null;
          return {
            durationMode: mode,
            referenceClassId: ref,
            selectedIds:
              ref !== null && !s.selectedIds.includes(ref)
                ? [...s.selectedIds, ref]
                : s.selectedIds,
          };
        }),
      // Choosing a reference auto-adds it to the fleet (decision: the anchor is
      // always a boat that's actually racing).
      setReferenceClass: (id) =>
        set((s) => ({
          referenceClassId: id,
          selectedIds: s.selectedIds.includes(id) ? s.selectedIds : [...s.selectedIds, id],
        })),
      setReferenceMinutes: (minutes) => set({ referenceMinutes: clampDuration(minutes) }),
      setStartSequence: (sequence) => set({ startSequence: sequence }),
      toggleMuted: () => set((s) => ({ muted: !s.muted })),

      // Confirming Start begins a 10s count-in to the first signal and locks the
      // timing frame so mid-race additions never reshuffle existing starts.
      start: () => {
        const s = get();
        const { customClasses } = useCustomClasses.getState();
        const selected = resolveClasses(s.selectedIds, customClasses);
        const base = buildSchedule(selected, resolveDurationMinutes(s, selected));
        if (!base) return;
        set({
          frame: frameFromSchedule(base),
          clock: armClock(Date.now(), s.startSequence, PRE_ROLL_MS),
          awaitingStart: false,
        });
      },
      pause: () => {
        const c = get().clock;
        if (c) set({ clock: pauseClock(c, Date.now()) });
      },
      resume: () => {
        const c = get().clock;
        if (c) set({ clock: resumeClock(c, Date.now()) });
      },
      // Re-arm to the start of the sequence, paused and awaiting a confirmed
      // restart (so the count-in + confirm gate apply again, not an instant go).
      // Re-lock the frame against the current fleet (which may have grown).
      reset: () => {
        const now = Date.now();
        const s = get();
        const { startSequence } = s;
        const { customClasses } = useCustomClasses.getState();
        const selected = resolveClasses(s.selectedIds, customClasses);
        const base = buildSchedule(selected, resolveDurationMinutes(s, selected));
        if (!base) return;
        set({
          frame: frameFromSchedule(base),
          clock: pauseClock(armClock(now, startSequence), now),
          awaitingStart: true,
        });
      },
      stop: () => set({ clock: null, frame: null, awaitingStart: false }),
    }),
    {
      name: "trivial.lastRace",
      partialize: (s) => ({
        selectedIds: s.selectedIds,
        durationMinutes: s.durationMinutes,
        durationMode: s.durationMode,
        referenceClassId: s.referenceClassId,
        referenceMinutes: s.referenceMinutes,
        startSequence: s.startSequence,
        muted: s.muted,
      }),
    },
  ),
);
