import { useSyncExternalStore } from "react";

// Consent is asked once per browser and remembered as a single flag in localStorage.
// Only the flag is stored, never profile text. The API still requires `consent: true` on
// every request; this only decides whether the consent screen needs to be shown again.

export const CONSENT_KEY = "persona.consent.v1";
const CHANGE_EVENT = "persona-consent-change";

type FlagStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): FlagStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null; // blocked storage (some private modes): consent is simply asked again
  }
}

export function readConsent(storage: FlagStorage | null = browserStorage()): boolean {
  try {
    return storage?.getItem(CONSENT_KEY) === "yes";
  } catch {
    return false;
  }
}

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function saveConsent(storage: FlagStorage | null = browserStorage()) {
  try {
    storage?.setItem(CONSENT_KEY, "yes");
  } catch {
    // Not remembered; the user will be asked again next time.
  }
  notify();
}

export function withdrawConsent(storage: FlagStorage | null = browserStorage()) {
  try {
    storage?.removeItem(CONSENT_KEY);
  } catch {
    // Nothing stored to remove.
  }
  notify();
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange); // other tabs
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The remembered consent flag. False during server rendering, so nothing is ever sent before it's read. */
export function useStoredConsent(): boolean {
  return useSyncExternalStore(subscribe, () => readConsent(), () => false);
}
