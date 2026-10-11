import { beforeEach, describe, expect, it } from "vitest";
import { clearSession, getSession, setPhotoFile, updateSession } from "./identity-session";
import { emptyLinkedInProfile } from "./profile";

describe("identity session", () => {
  beforeEach(() => clearSession());

  it("keeps studio edits without restarting the studio", () => {
    const rev = getSession().rev;
    const profile = { ...emptyLinkedInProfile(), headline: "Data science student" };
    updateSession({ linkedin: profile });
    expect(getSession().linkedin).toBe(profile);
    expect(getSession().rev).toBe(rev);
  });

  it("bumps the revision for changes made outside the studio", () => {
    const rev = getSession().rev;
    updateSession({ jobDescription: "Data analyst" }, { external: true });
    expect(getSession().rev).toBe(rev + 1);
  });

  it("clearing empties everything and restarts the studio", () => {
    updateSession({
      jobDescription: "x",
      facts: [{ id: "f1", text: "I study statistics.", confirmed: true, source: "user" }],
    });
    const rev = getSession().rev;
    clearSession();
    expect(getSession()).toMatchObject({ linkedin: null, hinge: null, facts: [], jobDescription: "", photo: null });
    expect(getSession().rev).toBe(rev + 1);
  });

  it("only accepts JPG, PNG, or WEBP photos under 10 MB", () => {
    expect(setPhotoFile(new File(["x"], "notes.txt", { type: "text/plain" }))).toMatch(/JPG, PNG, or WEBP/);
    expect(getSession().photo).toBeNull();
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.png", { type: "image/png" });
    expect(setPhotoFile(big)).toMatch(/under 10 MB/);
    expect(setPhotoFile(new File(["x"], "me.png", { type: "image/png" }))).toBeNull();
    expect(getSession().photo?.name).toBe("me.png");
  });
});
