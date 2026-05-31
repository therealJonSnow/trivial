"use client";

import type { Schedule } from "@/lib/types";
import type { TimerView } from "@/lib/timer";
import { formatMmSs, formatClock, ordinal } from "@/lib/format";
import { startTime } from "@/lib/schedule";

interface ScheduleListProps {
  schedule: Schedule;
  /** When running, drives per-row status. */
  view?: TimerView;
  /** When running, enables absolute wall-clock start times. */
  firstGunEpoch?: number;
  /** Show the column header row (default true). */
  header?: boolean;
  className?: string;
}

type RowStatus = "started" | "starting" | "next" | "upcoming";

function statusOf(order: number, view?: TimerView): RowStatus {
  if (!view) return "upcoming";
  if (view.flashing?.order === order) return "starting";
  if (view.startedOrders.includes(order)) return "started";
  if (view.nextStart?.order === order) return "next";
  return "upcoming";
}

const STATUS_TEXT: Record<RowStatus, string> = {
  started: "text-started",
  starting: "text-imminent",
  next: "text-next",
  upcoming: "text-muted",
};

export function ScheduleList({
  schedule,
  view,
  firstGunEpoch,
  header = true,
  className = "",
}: ScheduleListProps) {
  const showClock = firstGunEpoch !== undefined;
  return (
    <div className={className}>
      {header && (
        <div className="flex items-center gap-3 pb-1 text-[10px] uppercase tracking-wider text-muted">
          <span className="w-10 shrink-0">#</span>
          <span className="min-w-0 flex-1">Class</span>
          <span className="w-12 shrink-0 text-right">PY</span>
          <span className="w-16 shrink-0 text-right">Start</span>
          {showClock && <span className="w-20 shrink-0 text-right">Clock</span>}
        </div>
      )}
      <ul className="divide-y divide-line">
        {schedule.starts.map((s) => {
          const status = statusOf(s.order, view);
          return (
            <li
              key={s.order}
              className={`flex items-center gap-3 py-2 ${status === "starting" ? "animate-pulse" : ""}`}
            >
              <span className="w-10 shrink-0 font-mono text-xs text-muted">
                {ordinal(s.order)}
              </span>
              <span className={`min-w-0 flex-1 truncate text-sm ${STATUS_TEXT[status]}`}>
                {s.classes.map((c) => c.name).join(" + ")}
                {s.isScratch && (
                  <span className="ml-1 text-[10px] uppercase text-muted">scratch</span>
                )}
              </span>
              <span className="w-12 shrink-0 text-right font-mono text-xs text-muted">
                {s.py}
              </span>
              {/* Time after the first gun — ascends with start order (first = +0:00). */}
              <span className="w-16 shrink-0 text-right font-mono text-sm tabular-nums text-ink">
                +{formatMmSs(s.startFromFirstGunMs)}
              </span>
              {showClock && (
                <span className="w-20 shrink-0 text-right font-mono text-xs tabular-nums text-muted">
                  {formatClock(startTime(s, firstGunEpoch))}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
