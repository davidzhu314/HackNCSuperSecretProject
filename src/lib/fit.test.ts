import { describe, expect, it } from "vitest";
import { fieldLimit, fitAcross, fitText } from "./fit";

describe("fitText", () => {
  it("uses each platform's real limit", () => {
    expect(fieldLimit("facebook").limit).toBe(101);
    expect(fieldLimit("instagram").limit).toBe(150);
    expect(fieldLimit("handshake").limit).toBe(300);
    expect(fieldLimit("tinder").limit).toBe(500);
    expect(fieldLimit("linkedin")).toEqual({ field: "About", limit: 2600 });
  });

  it("fits short text everywhere", () => {
    expect(fitAcross("CS senior. I build things in React.").every((f) => f.fits)).toBe(true);
  });

  it("cuts at the last whole word under the limit", () => {
    const text = "word ".repeat(30).trim(); // 149 characters
    const fb = fitText(text, "facebook");
    expect(fb.fits).toBe(false);
    expect([...(fb.kept ?? "")].length).toBeLessThanOrEqual(101);
    expect(fb.kept?.endsWith("word")).toBe(true);
    expect(`${fb.kept} ${fb.cut}`).toBe(text);
    expect(fitText(text, "instagram").fits).toBe(true);
  });

  it("counts emoji as one character", () => {
    expect(fitText("🌮".repeat(101), "facebook").fits).toBe(true);
    expect(fitText("🌮".repeat(102), "facebook").fits).toBe(false);
  });
});
