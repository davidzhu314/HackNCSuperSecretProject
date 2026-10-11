"use client";

import { Droplets, Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { HUB_THEMES, readHubTheme, saveHubTheme, type HubTheme } from "@/lib/hub-theme";

// Light / dark / Aero switch for the Identity Hub only (and the FactCheck benchmark page). The theme
// lives in data-hub-theme on <html>; without it, the Hub follows the system setting (CSS
// prefers-color-scheme), light or dark.

const DARK_QUERY = "(prefers-color-scheme: dark)";

const LABEL: Record<HubTheme, string> = { light: "Light", dark: "Dark", aero: "Aero" };
const ICON: Record<HubTheme, typeof Sun> = { light: Sun, dark: Moon, aero: Droplets };

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
function current(): HubTheme {
  const set = document.documentElement.dataset.hubTheme;
  if ((HUB_THEMES as readonly string[]).includes(set ?? "")) return set as HubTheme;
  return matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

/** Show and remember a look. Outside the component: it changes the page, not React state. */
function applyTheme(next: HubTheme) {
  document.documentElement.dataset.hubTheme = next;
  saveHubTheme(next);
}

export function HubThemeToggle() {
  const theme = useSyncExternalStore(subscribe, current, () => "light" as const);

  // Apply a saved choice (no inline script does it before paint; see lib/hub-theme.ts).
  useEffect(() => {
    const saved = readHubTheme();
    if (saved) document.documentElement.dataset.hubTheme = saved;
  }, []);

  return (
    <div className="hub-theme-switch" role="group" aria-label="Hub look">
      {HUB_THEMES.map((t) => {
        const Icon = ICON[t];
        return (
          <button
            key={t}
            type="button"
            className="hub-theme-option"
            aria-pressed={theme === t}
            aria-label={`${LABEL[t]} mode`}
            title={`${LABEL[t]} mode`}
            onClick={() => applyTheme(t)}
          >
            <Icon aria-hidden="true" />
            <span className="hub-theme-label">{LABEL[t]}</span>
          </button>
        );
      })}
    </div>
  );
}
