"use client";

import { useMemo, useState } from "react";
import { resolveClasses } from "@/lib/data";
import { buildSchedule, computeStartFromFirstGunMs } from "@/lib/schedule";
import {
  deriveTimer,
  firstGunEpoch,
  syncedDisplayMsToFinish,
  syncedHeroCountdownMs,
} from "@/lib/timer";
import { formatRaceStopwatch } from "@/lib/format";
import { useCustomClasses, useFavourites, useRace } from "@/store/useRaceStore";
import { useNow } from "@/hooks/useNow";
import { ScheduleList } from "./ScheduleList";
import { ClassBrowser } from "./ClassBrowser";
import { StartNowAlert } from "./StartNowAlert";

interface FleetScreenProps {
  onBack: () => void;
}

/**
 * In-race fleet editor. Add a late entrant and it slots into the queue at its
 * computed time — or, if that time has already passed, fires a START-NOW alert.
 * Already-started classes are locked (can't be removed); not-yet-started ones can.
 */
export function FleetScreen({ onBack }: FleetScreenProps) {
  const { favourites, toggleFavourite } = useFavourites();
  const { customClasses, addCustomClass, updateCustomClass, deleteCustomClass } =
    useCustomClasses();
  const { clock, frame, selectedIds, durationMinutes, toggleSelected, setSelected } = useRace();

  const [alertNames, setAlertNames] = useState<string[] | null>(null);

  const paused = clock?.pausedAtEpoch != null;
  const now = useNow(clock !== null && !paused);

  const schedule = useMemo(
    () =>
      buildSchedule(resolveClasses(selectedIds, customClasses), durationMinutes, frame ?? undefined),
    [selectedIds, durationMinutes, frame, customClasses],
  );

  const view = clock && schedule ? deriveTimer(clock, schedule, now) : null;

  const lockedIds = useMemo(() => {
    if (!schedule || !view) return [];
    return schedule.starts
      .filter((s) => view.startedOrders.includes(s.order))
      .flatMap((s) => s.classes.map((c) => c.id));
  }, [schedule, view]);

  const handleToggle = (id: number) => {
    const wasSelected = selectedIds.includes(id);
    toggleSelected(id);
    if (wasSelected || !frame || !clock) return; // removing, or pre-race guard

    // Adding mid-race: classify against the LOCKED frame.
    const cls = resolveClasses([id], customClasses)[0];
    if (!cls) return;
    const startFromGun = computeStartFromFirstGunMs(
      frame.durationMs,
      frame.slowestPy,
      cls.py,
    );
    const msSinceFirstGun = (clock.pausedAtEpoch ?? Date.now()) - firstGunEpoch(clock);
    if (startFromGun <= msSinceFirstGun) setAlertNames([cls.name]);
  };

  const handleDeleteCustom = (id: number) => {
    if (lockedIds.includes(id)) return;
    deleteCustomClass(id);
    setSelected(selectedIds.filter((x) => x !== id));
  };

  const gun = clock ? firstGunEpoch(clock) : 0;

  return (
    <div className="animate-sheet-in mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-28 pt-3">
      <header className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="-ml-2 flex h-11 items-center rounded-lg px-2 text-sm font-semibold uppercase tracking-wider text-muted"
        >
          ‹ Race
        </button>
        <h1 className="text-sm font-bold uppercase tracking-[0.3em] text-ink">Fleet</h1>
        <span className="w-16 text-right font-mono text-xs text-muted">
          {selectedIds.length} cls
        </span>
      </header>

      {/* live status so the RO never loses the race while editing */}
      {view && (
        <div className="mb-3 flex items-center justify-between rounded-xl bg-panel px-3 py-2">
          <span className="font-mono text-xs uppercase tracking-wider text-muted">
            {view.flashing
              ? "GO"
              : view.phase === "finished"
                ? "Finished"
                : view.nextStart
                  ? `Next: ${view.nextStart.classes.map((c) => c.name).join(" + ")}`
                  : "All started"}
          </span>
          <span
            className={`font-mono text-lg tabular-nums ${view.flashing ? "text-imminent" : "text-next"}`}
          >
            {view.flashing
              ? "GO"
              : formatRaceStopwatch(
                  syncedHeroCountdownMs(view, clock!, schedule!.finishFromFirstGunMs),
                )}
          </span>
        </div>
      )}

      {schedule && (
        <section className="mb-4 rounded-xl bg-panel p-3">
          <h2 className="mb-1 text-xs uppercase tracking-wider text-muted">
            Start schedule · finish{" "}
            {view && clock
              ? formatRaceStopwatch(
                  syncedDisplayMsToFinish(schedule.finishFromFirstGunMs, view.msSinceFirstGun),
                )
              : "—"}
          </h2>
          <ScheduleList schedule={schedule} view={view ?? undefined} firstGunEpoch={gun} />
        </section>
      )}

      <h2 className="mb-2 text-xs uppercase tracking-wider text-muted">Add a class</h2>
      <div className="flex-1">
        <ClassBrowser
          selectedIds={selectedIds}
          favourites={favourites}
          onToggleSelected={handleToggle}
          onToggleFavourite={toggleFavourite}
          lockedIds={lockedIds}
          customClasses={customClasses}
          onAddCustomClass={addCustomClass}
          onUpdateCustomClass={updateCustomClass}
          onDeleteCustomClass={handleDeleteCustom}
        />
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md px-4 pb-4">
        <button
          type="button"
          onClick={onBack}
          className="h-16 w-full rounded-2xl bg-next text-xl font-bold uppercase tracking-wider text-ground"
        >
          Back to race
        </button>
      </div>

      {alertNames && (
        <StartNowAlert names={alertNames} onDismiss={() => setAlertNames(null)} />
      )}
    </div>
  );
}
