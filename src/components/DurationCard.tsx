"use client";

import type { BoatClass } from "@/lib/types";
import { deriveDurationMinutes } from "@/lib/schedule";
import {
  type DurationMode,
  MAX_DURATION,
  clampDuration,
} from "@/store/useRaceStore";

interface DurationCardProps {
  /** Resolved fleet — drives the reference dropdown and the derived window. */
  selected: BoatClass[];
  durationMode: DurationMode;
  durationMinutes: number;
  referenceClassId: number | null;
  referenceMinutes: number;
  onSetDuration: (minutes: number) => void;
  onSetDurationMode: (mode: DurationMode) => void;
  onSetReferenceClass: (id: number) => void;
  onSetReferenceMinutes: (minutes: number) => void;
}

const MODES: { value: DurationMode; label: string }[] = [
  { value: "fixed", label: "Fixed" },
  { value: "class", label: "By class" },
];

/** Glove-friendly − value + row, sized to match the app's 44px control rows. */
function StepRow({
  label,
  value,
  unit,
  step,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  step: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-stretch gap-2">
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        onClick={() => onChange(value - step)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-line text-2xl font-bold leading-none text-ink active:bg-signal active:text-ground"
      >
        −
      </button>
      <div className="flex flex-1 items-center justify-center gap-1 font-mono tabular-nums">
        <span className="text-[2rem] font-medium leading-none text-ink">{value}</span>
        <span className="text-sm text-muted">{unit}</span>
      </div>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        onClick={() => onChange(value + step)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-line text-2xl font-bold leading-none text-ink active:bg-signal active:text-ground"
      >
        +
      </button>
    </div>
  );
}

/**
 * Race-duration control with two modes:
 *  - Fixed: type the total race window directly (standard pursuit).
 *  - By class: pin a reference class to N minutes on the water; the total window
 *    is derived as referenceMinutes × PY_slowest / PY_reference and shown live.
 * Defaults to Fixed so a standard race is untouched.
 */
export function DurationCard({
  selected,
  durationMode,
  durationMinutes,
  referenceClassId,
  referenceMinutes,
  onSetDuration,
  onSetDurationMode,
  onSetReferenceClass,
  onSetReferenceMinutes,
}: DurationCardProps) {
  const isClass = durationMode === "class";

  // Reference picker lists the current fleet; the chosen reference is auto-added
  // to the fleet by the store, so it's always present here.
  const fleet = [...selected].sort((a, b) => a.name.localeCompare(b.name));
  const refClass = selected.find((c) => c.id === referenceClassId) ?? null;

  // Raw (uncapped) vs effective (capped) derived window — drives the readout and
  // the overflow warning.
  const rawMinutes = deriveDurationMinutes(selected, referenceClassId, referenceMinutes);
  const effectiveMinutes = clampDuration(rawMinutes);
  const overflowed = Math.round(rawMinutes) > MAX_DURATION;

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-line bg-panel p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
          Race duration
        </span>
        <div className="flex rounded-lg bg-line p-0.5" role="group" aria-label="Duration mode">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={durationMode === m.value}
              onClick={() => onSetDurationMode(m.value)}
              className={`rounded-md px-2.5 py-1 font-display text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors ${
                durationMode === m.value ? "bg-signal text-ground" : "text-muted active:text-ink"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {!isClass ? (
        <StepRow
          label="Race duration"
          value={durationMinutes}
          unit="min"
          step={5}
          onChange={onSetDuration}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="reference-class"
              className="font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-muted"
            >
              Reference class
            </label>
            <div className="relative">
              <select
                id="reference-class"
                value={referenceClassId ?? ""}
                onChange={(e) => onSetReferenceClass(Number(e.target.value))}
                className="h-11 w-full appearance-none rounded-lg bg-line px-3 pr-9 font-mono text-base font-bold text-ink"
              >
                {fleet.length === 0 && <option value="">Add a class to the fleet</option>}
                {fleet.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <span
                className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-sm text-muted"
                aria-hidden
              >
                ▾
              </span>
            </div>
            <p className="text-[10px] text-muted">
              Raced as the timing anchor — kept in the fleet.
            </p>
          </div>

          <div className="grid grid-cols-2 items-center gap-3">
            <StepRow
              label="Reference minutes"
              value={referenceMinutes}
              unit="min"
              step={5}
              onChange={onSetReferenceMinutes}
            />
            <div className="text-right">
              <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                Total race
              </div>
              <div className="font-mono text-2xl font-medium leading-tight tabular-nums text-ink">
                ≈ {effectiveMinutes} min
              </div>
              {refClass && (
                <div className="font-mono text-[11px] tabular-nums text-signal">
                  {refClass.name.split(" / ")[0]} sails {referenceMinutes} min
                </div>
              )}
            </div>
          </div>

          {overflowed && (
            <p className="rounded-lg bg-imminent/10 px-2.5 py-1.5 text-[11px] text-imminent">
              Capped at {MAX_DURATION} min (would be {Math.round(rawMinutes)} min). Raise the
              reference minutes or drop the slowest class.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
