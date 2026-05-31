"use client";

import { useEffect, useState } from "react";
import { SetupScreen } from "@/components/SetupScreen";
import { TimerScreen } from "@/components/TimerScreen";
import { useRace } from "@/store/useRaceStore";

export default function Home() {
  // Gate on mount: persisted (localStorage) state must not be read during the
  // static prerender, or hydration would mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const clock = useRace((s) => s.clock);

  if (!mounted) return <div className="min-h-dvh bg-ground" />;
  return clock ? <TimerScreen /> : <SetupScreen />;
}
