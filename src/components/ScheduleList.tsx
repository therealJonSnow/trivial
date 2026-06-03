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
  className = "",
}: ScheduleListProps) {
  const showClock = firstGunEpoch !== undefined;
  const preview = !view; // setup: no live status — show the plan in full ink
  return (
    <div className={className}>
      {header && (
        <div className="flex items-center gap-3 pb-1.5 font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-imminent">
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
          return (
            <li
              key={s.order}
              style={animateIn ? { animationDelay: `${Math.min(i, 12) * 45}ms` } : undefined}
              className={`flex items-center gap-3 py-2.5 ${
                status === "starting" ? "animate-pulse" : ""
              } ${animateIn ? "animate-row-rise" : ""}`}
            >
              <span
                className={`flex h-6 w-8 shrink-0 items-center justify-start rounded font-mono text-[11px] tabular-nums text-muted`}
              >
                {ordinal(s.order)}
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-[15px] ${
                  preview ? "text-ink" : STATUS_TEXT[status]
                }`}
              >
                {s.classes.map((c) => c.name).join(" + ")}
              </span>
              <span className="w-12 shrink-0 text-right font-mono text-xs tabular-nums text-muted">
                {s.py}
              </span>
              {/* Time after the first gun — ascends with start order (first = +0:00). */}
              <span className="w-16 shrink-0 text-right font-mono text-sm font-medium tabular-nums text-ink">
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
