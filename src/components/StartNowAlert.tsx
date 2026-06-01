"use client";

interface StartNowAlertProps {
  /** Names of the just-added class(es) whose start has already passed. */
  names: string[];
  onDismiss: () => void;
}

/**
 * Full-screen amber takeover (same visual language as the GO flash) for a late
 * entrant whose start time has already passed — the RO must send them now.
 */
export function StartNowAlert({ names, onDismiss }: StartNowAlertProps) {
  return (
    <div className="animate-pop-in fixed inset-0 z-50 flex flex-col items-center justify-center bg-imminent px-6 text-center">
      <div className="text-sm font-bold uppercase tracking-[0.4em] text-ground/70">
        Already away
      </div>
      <div className="mt-3 font-mono text-clock-sm font-black leading-none text-ground">
        START NOW
      </div>
      <div className="mt-3 max-w-full text-2xl font-bold text-ground">
        {names.join(" + ")}
      </div>
      <p className="mt-3 max-w-xs text-sm text-ground/80">
        This start has already passed — send them across the line immediately.
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-8 h-14 rounded-2xl border-2 border-ground px-10 text-lg font-bold uppercase tracking-wider text-ground active:bg-ground/10"
      >
        Sent — got it
      </button>
    </div>
  );
}
