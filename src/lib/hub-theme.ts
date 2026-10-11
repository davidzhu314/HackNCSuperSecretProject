// The Identity Hub's light/dark preference: a non-sensitive choice kept in localStorage.
// No inline <script> applies it (React warns about script tags it renders on the client): with no
// saved choice, CSS follows the system setting (prefers-color-scheme), so there is no flash; a saved
// choice is applied by HubThemeToggle once the page loads.

export const HUB_THEME_KEY = "personify-hub-theme";

export type HubTheme = "light" | "dark";

export function readHubTheme(): HubTheme | null {
  try {
    const t = localStorage.getItem(HUB_THEME_KEY);
    return t === "light" || t === "dark" ? t : null;
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
