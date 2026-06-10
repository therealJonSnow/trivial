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
  /** Stagger rows in on mount (setup preview only). */
  animateIn?: boolean;
  /** Horizontal gutter on the header + each row. Put padding here (not on a
   *  wrapper) so zebra row backgrounds bleed to the container's edges. */
  gutterClass?: string;
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
  animateIn = false,
  gutterClass = "px-1.5",
  className = "",
}: ScheduleListProps) {
  const showClock = firstGunEpoch !== undefined;
  const preview = !view; // setup: no live status — show the plan in full ink
  return (
    <div className={className}>
      {header && (
        <div className={`field-label flex items-center gap-3 pb-2 ${gutterClass}`}>
          <span className="w-8 shrink-0">#</span>
          <span className="min-w-0 flex-1">Class</span>
          <span className="w-12 shrink-0 text-right">PY</span>
          <span className="w-16 shrink-0 text-right">Timing</span>
          {showClock && <span className="w-20 shrink-0 text-right">Clock</span>}
        </div>
      )}
      <ul className="divide-y divide-line">
        {schedule.starts.map((s, i) => {
          const status = statusOf(s.order, view);
          // Subtle zebra only in the static setup preview — live status colours
          // own the row background once the race is running.
          const zebra = preview && i % 2 === 0 ? "bg-zebra" : "";
          return (
            <li
              key={s.order}
              style={animateIn ? { animationDelay: `${Math.min(i, 12) * 45}ms` } : undefined}
              className={`flex items-center gap-3 py-3 ${gutterClass} ${zebra} ${
                status === "starting" ? "animate-pulse" : ""
              } ${animateIn ? "animate-row-rise" : ""}`}
            >
              <span
                className={`flex h-6 w-8 shrink-0 items-center justify-start rounded-md font-mono text-[13px] font-medium tabular-nums text-muted`}
              >
                {ordinal(s.order)}
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-base ${
                  preview ? "text-ink" : STATUS_TEXT[status]
                }`}
              >
                {s.classes.map((c) => c.name).join(" + ")}
              </span>
              <span className="w-12 shrink-0 text-right font-mono text-[13px] tabular-nums text-muted">
                {s.py}
              </span>
              {/* Time after the first gun — ascends with start order (first = +0:00). */}
              <span className="w-16 shrink-0 text-right font-mono text-base font-semibold tabular-nums text-ink">
                +{formatMmSs(s.startFromFirstGunMs)}
              </span>
              {showClock && (
                <span className="w-20 shrink-0 text-right font-mono text-[13px] tabular-nums text-muted">
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
