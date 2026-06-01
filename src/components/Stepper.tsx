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
    <div className="flex flex-col gap-2 rounded-xl bg-panel p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
        {label}
      </div>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(value - step)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-line text-2xl font-bold leading-none text-ink active:bg-line/60"
        >
          −
        </button>
        <div className="flex flex-1 items-baseline justify-center gap-1 font-mono tabular-nums">
          <span className="text-3xl leading-none text-ink">{value}</span>
          <span className="text-sm text-muted">{unit}</span>
        </div>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(value + step)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-line text-2xl font-bold leading-none text-ink active:bg-line/60"
        >
          +
        </button>
      </div>
    </div>
  );
}
