import { describe, expect, it } from "vitest";
import { EXPECTED_MS, PROGRESS_CAP, expectedBatchMs, pacedProgress } from "./progress";

describe("pacedProgress", () => {
  const expected = 10_000;

  it("starts at zero", () => {
    expect(pacedProgress(0, expected)).toBe(0);
    expect(pacedProgress(-5, expected)).toBe(0);
    expect(pacedProgress(NaN, expected)).toBe(0);
  });

  it("moves quickly at first, then slows", () => {
    const firstQuarter = pacedProgress(2_500, expected);
    const lastQuarter = pacedProgress(10_000, expected) - pacedProgress(7_500, expected);
    expect(firstQuarter).toBeGreaterThan(40);
    expect(lastQuarter).toBeLessThan(firstQuarter / 3);
  });

  it("passes 70% before the expected time and sits around 85% at it", () => {
    expect(pacedProgress(0.6 * expected, expected)).toBeGreaterThan(70);
    expect(pacedProgress(expected, expected)).toBeGreaterThan(80);
    expect(pacedProgress(expected, expected)).toBeLessThan(90);
  });

  it("never passes the cap, however long the wait", () => {
    for (const ms of [20_000, 60_000, 10 ** 9]) {
      expect(pacedProgress(ms, expected)).toBeLessThanOrEqual(PROGRESS_CAP);
    }
    expect(pacedProgress(60_000, expected)).toBeGreaterThan(94);
  });

  it("only ever increases", () => {
    let last = 0;
    for (let ms = 0; ms <= 30_000; ms += 200) {
      const p = pacedProgress(ms, expected);
      expect(p).toBeGreaterThanOrEqual(last);
      last = p;
    }
  });

  it("survives a zero expected time", () => {
    expect(pacedProgress(100, 0)).toBeLessThanOrEqual(PROGRESS_CAP);
  });
});

describe("expectedBatchMs", () => {
  it("counts one section per parallel batch", () => {
    expect(expectedBatchMs(1, 3)).toBe(EXPECTED_MS.section);
    expect(expectedBatchMs(3, 3)).toBe(EXPECTED_MS.section);
    expect(expectedBatchMs(7, 3)).toBe(3 * EXPECTED_MS.section);
  });

  it("never returns zero", () => {
    expect(expectedBatchMs(0, 3)).toBe(EXPECTED_MS.section);
    expect(expectedBatchMs(4, 0)).toBe(4 * EXPECTED_MS.section);
  });
});
