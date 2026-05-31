"use client";

interface StepperProps {
  label: string;
  value: number;
  unit: string;
  step: number;
  onChange: (next: number) => void;
}

/** Large +/- stepper — no keyboard, glove-friendly (spec §5 inputs). */
export function Stepper({ label, value, unit, step, onChange }: StepperProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-panel px-3 py-2">
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
        <div className="font-mono text-2xl tabular-nums text-ink">
          {value}
          <span className="ml-1 text-sm text-muted">{unit}</span>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(value - step)}
          className="h-12 w-12 rounded-lg bg-line text-2xl font-bold text-ink active:bg-line/60"
        >
          −
        </button>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(value + step)}
          className="h-12 w-12 rounded-lg bg-line text-2xl font-bold text-ink active:bg-line/60"
        >
          +
        </button>
      </div>
    </div>
  );
}
