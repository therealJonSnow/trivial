"use client";

interface StepperProps {
  label: string;
  value: number;
  unit: string;
  step: number;
  onChange: (next: number) => void;
}

/**
 * Glove-friendly stepper, laid out as a labelled instrument tile: caption on
 * top, then a − value + control row sized to match the segmented selector beside
 * it (equal card height, equal 44px control row). No keyboard (spec §5 inputs).
 */
export function Stepper({ label, value, unit, step, onChange }: StepperProps) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-panel p-3">
      <div className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
        {label}
      </div>
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
    </div>
  );
}
