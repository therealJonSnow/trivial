"use client";

import { useCallback, useState } from "react";

export type Theme = "light" | "dark";

/** localStorage key — must match the inline bootstrap script in layout.tsx. */
export const THEME_KEY = "trivial.theme";

/** Status-bar / PWA chrome colour per theme (mirrors --color-ground). */
const META_COLOR: Record<Theme, string> = { dark: "#05070a", light: "#eef3f8" };

/** Device preference, defaulting to dark when matchMedia is unavailable. */
export function systemTheme(): Theme {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function storedTheme(): Theme | null {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : null;
  } catch {
    return null;
  }
}

/** The theme the bootstrap script already applied to <html> (read from the DOM). */
function currentTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

/** Apply a theme to the document: swap the class, color-scheme, and theme-color. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.style.colorScheme = theme;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = META_COLOR[theme];
}

/**
 * Reads the active theme (set pre-hydration by the bootstrap script) and exposes
 * a toggle that persists the explicit choice. Initialising from the DOM class
 * keeps the toggle icon correct on the very first render — no flash.
 */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* private mode / storage disabled — theme still applies for this session */
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}

// Re-exported only so the bootstrap script and tests can share the resolution rule.
export const resolveInitialTheme = (): Theme => storedTheme() ?? systemTheme();
