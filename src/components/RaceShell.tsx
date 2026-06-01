"use client";

import { useState } from "react";
import { TimerScreen } from "./TimerScreen";
import { FleetScreen } from "./FleetScreen";

/** While a race is live, switch between the timer (primary) and the fleet editor. */
export function RaceShell() {
  const [view, setView] = useState<"timer" | "fleet">("timer");

  return view === "timer" ? (
    <TimerScreen onOpenFleet={() => setView("fleet")} />
  ) : (
    <FleetScreen onBack={() => setView("timer")} />
  );
}
