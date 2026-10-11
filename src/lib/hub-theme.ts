// The Identity Hub's look: light, dark, or Frutiger Aero. A non-sensitive choice kept in localStorage.
// No inline <script> applies it (React warns about script tags it renders on the client): with no
// saved choice, CSS follows the system setting (prefers-color-scheme), so there is no flash; a saved
// choice is applied by HubThemeToggle once the page loads.

export const HUB_THEME_KEY = "personify-hub-theme";

export const HUB_THEMES = ["light", "dark", "aero"] as const;
export type HubTheme = (typeof HUB_THEMES)[number];

export function readHubTheme(): HubTheme | null {
  try {
    const t = localStorage.getItem(HUB_THEME_KEY);
    return (HUB_THEMES as readonly string[]).includes(t ?? "") ? (t as HubTheme) : null;
  } catch {
    return null; // storage blocked (private mode)
  }
}

export function saveHubTheme(theme: HubTheme) {
  try {
    localStorage.setItem(HUB_THEME_KEY, theme);
  } catch {
    // Storage blocked: the switch still works for this visit.
  }
}
