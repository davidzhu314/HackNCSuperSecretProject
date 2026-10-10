import { describe, expect, it } from "vitest";
import { CONSENT_KEY, readConsent, saveConsent, withdrawConsent } from "./consent";

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe("consent flag", () => {
  it("is off until saved, on after, and off again after withdrawing", () => {
    const s = fakeStorage();
    expect(readConsent(s)).toBe(false);
    saveConsent(s);
    expect(readConsent(s)).toBe(true);
    withdrawConsent(s);
    expect(readConsent(s)).toBe(false);
  });

  it("stores only a flag under one key", () => {
    const s = fakeStorage();
    saveConsent(s);
    expect([...s.data.entries()]).toEqual([[CONSENT_KEY, "yes"]]);
  });

  it("treats missing or failing storage as no consent", () => {
    expect(readConsent(null)).toBe(false);
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => {} };
    expect(readConsent(broken)).toBe(false);
    expect(() => saveConsent(broken)).not.toThrow();
  });
});
