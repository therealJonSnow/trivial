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
import { buildSchedule, frameFromSchedule } from "@/lib/schedule";
import { resolveClasses } from "@/lib/data";
import type { CustomBoatClass, ScheduleFrame } from "@/lib/types";

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
  setStartSequence: (sequence: StartSequence) => void;
  toggleMuted: () => void;
  // race actions
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  stop: () => void;
}

const MIN_DURATION = 5;
const MAX_DURATION = 240;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const useRace = create<RaceState>()(
  persist(
    (set, get) => ({
      selectedIds: [],
      durationMinutes: 60,
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
      setDuration: (minutes) =>
        set({ durationMinutes: clamp(Math.round(minutes), MIN_DURATION, MAX_DURATION) }),
      setStartSequence: (sequence) => set({ startSequence: sequence }),
      toggleMuted: () => set((s) => ({ muted: !s.muted })),

      // Confirming Start begins a 10s count-in to the first signal and locks the
      // timing frame so mid-race additions never reshuffle existing starts.
      start: () => {
        const { selectedIds, durationMinutes, startSequence } = get();
        const { customClasses } = useCustomClasses.getState();
        const base = buildSchedule(resolveClasses(selectedIds, customClasses), durationMinutes);
        if (!base) return;
        set({
          frame: frameFromSchedule(base),
          clock: armClock(Date.now(), startSequence, PRE_ROLL_MS),
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
        const { selectedIds, durationMinutes, startSequence } = get();
        const { customClasses } = useCustomClasses.getState();
        const base = buildSchedule(resolveClasses(selectedIds, customClasses), durationMinutes);
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
        startSequence: s.startSequence,
        muted: s.muted,
      }),
    },
  ),
);
