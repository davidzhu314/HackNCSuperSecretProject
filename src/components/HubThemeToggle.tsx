"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { HUB_THEME_KEY as KEY } from "@/lib/hub-theme";

// Light/dark switch for the Identity Hub only. The choice is a non-sensitive preference kept in
// localStorage; HUB_THEME_SCRIPT (lib/hub-theme.ts, inlined in the root layout) applies it before
// first paint so a dark Hub doesn't flash white.
// With no stored choice, the Hub follows the system setting.


// The theme lives on <html> (set by HUB_THEME_SCRIPT before React runs), so read it from there.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-hub-theme"] });
  return () => observer.disconnect();
}

export function HubThemeToggle() {
  const dark = useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.hubTheme === "dark",
    () => false,
  );

  function toggle() {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.hubTheme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Storage blocked (private mode): the switch still works for this visit.
    }
  }

  return (
    <Button variant="tour" onClick={toggle} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} aria-pressed={dark}>
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}
