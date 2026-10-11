import { describe, expect, it } from "vitest";
import { fieldLimit, fitAcross, fitText } from "./fit";

describe("fitText", () => {
  it("uses each platform's real limit", () => {
    expect(fieldLimit("github").limit).toBe(160);
    expect(fieldLimit("instagram").limit).toBe(150);
    expect(fieldLimit("handshake").limit).toBe(300);
    expect(fieldLimit("tinder").limit).toBe(500);
    expect(fieldLimit("linkedin")).toEqual({ field: "About", limit: 2600 });
  });

  it("fits short text everywhere", () => {
    expect(fitAcross("CS senior. I build things in React.").every((f) => f.fits)).toBe(true);
  });

  it("cuts at the last whole word under the limit", () => {
    const text = "word ".repeat(34).trim(); // 169 characters
    const gh = fitText(text, "github");
    expect(gh.fits).toBe(false);
    expect([...(gh.kept ?? "")].length).toBeLessThanOrEqual(160);
    expect(gh.kept?.endsWith("word")).toBe(true);
    expect(`${gh.kept} ${gh.cut}`).toBe(text);
    expect(fitText(text, "handshake").fits).toBe(true);
  });

  it("counts emoji as one character", () => {
    expect(fitText("🌮".repeat(160), "github").fits).toBe(true);
    expect(fitText("🌮".repeat(161), "github").fits).toBe(false);
  });
});
