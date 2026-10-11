"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { readHubTheme, saveHubTheme } from "@/lib/hub-theme";

// Light/dark switch for the Identity Hub only (and the FactCheck benchmark page). The theme lives in
// data-hub-theme on <html>; without it, the Hub follows the system setting (CSS prefers-color-scheme).

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-hub-theme"] });
  const media = matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", onChange);
  };
}

/** What the Hub shows now: an explicit choice, else the system setting. */
function isDark() {
  const set = document.documentElement.dataset.hubTheme;
  return set ? set === "dark" : matchMedia(DARK_QUERY).matches;
}

export function HubThemeToggle() {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);

  // Apply a saved choice (no inline script does it before paint; see lib/hub-theme.ts).
  useEffect(() => {
    const saved = readHubTheme();
    if (saved) document.documentElement.dataset.hubTheme = saved;
  }, []);

  function toggle() {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.hubTheme = next;
    saveHubTheme(next);
  }

  return (
    <Button variant="tour" onClick={toggle} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} aria-pressed={dark}>
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}
