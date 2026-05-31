import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  armClock,
  pauseClock,
  resumeClock,
  type RaceClock,
  type StartSequence,
} from "@/lib/timer";

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
  // ephemeral
  clock: RaceClock | null;
  // config actions
  toggleSelected: (id: number) => void;
  setSelected: (ids: number[]) => void;
  setDuration: (minutes: number) => void;
  setStartSequence: (sequence: StartSequence) => void;
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
      startSequence: "5-3-1",
      clock: null,

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

      // Tapping Start immediately begins the selected start sequence.
      start: () => {
        if (get().selectedIds.length === 0) return;
        set({ clock: armClock(Date.now(), get().startSequence) });
      },
      pause: () => {
        const c = get().clock;
        if (c) set({ clock: pauseClock(c, Date.now()) });
      },
      resume: () => {
        const c = get().clock;
        if (c) set({ clock: resumeClock(c, Date.now()) });
      },
      // Re-arm to the start of the sequence, paused, awaiting a fresh resume.
      reset: () => {
        const now = Date.now();
        set({ clock: pauseClock(armClock(now, get().startSequence), now) });
      },
      stop: () => set({ clock: null }),
    }),
    {
      name: "trivial.lastRace",
      partialize: (s) => ({
        selectedIds: s.selectedIds,
        durationMinutes: s.durationMinutes,
        startSequence: s.startSequence,
      }),
    },
  ),
);
