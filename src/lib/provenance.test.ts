import { describe, expect, it } from "vitest";
import {
  DEMO_HINGE_FACTS,
  DEMO_HINGE_SEGMENTS,
  DEMO_LINKEDIN_FACTS,
  DEMO_LINKEDIN_SEGMENTS,
  SAMPLE_REWRITE,
} from "./demo-data";
import { traceSentences } from "./provenance";

const trace = (content: string, facts = DEMO_LINKEDIN_FACTS) => traceSentences(content, DEMO_LINKEDIN_SEGMENTS, facts);

describe("traceSentences", () => {
  it("traces a sentence to the confirmed fact it paraphrases", () => {
    const [r] = trace("I built a course-planning web app with Python and React.");
    expect(r.status).toBe("traced");
    expect(r.sources[0]).toMatchObject({ kind: "fact", id: "f4" });
  });

  it("traces a sentence to an original segment", () => {
    const [r] = trace("I love learning new things.");
    expect(r.status).toBe("traced");
    expect(r.sources.some((s) => s.kind === "segment")).toBe(true);
  });

  it("combines sources when one sentence draws on two facts", () => {
    const [r] = trace("Computer science senior and teaching assistant for an introductory programming course.");
    expect(r.status).toBe("traced");
    expect(r.sources.map((s) => s.id)).toEqual(expect.arrayContaining(["f1", "f3"]));
  });

  it("marks an invented sentence untraced or weak, never traced", () => {
    const [r] = trace("Won a national chess championship in Vienna.");
    expect(r.status).not.toBe("traced");
  });

  it("never uses unconfirmed facts as sources", () => {
    const unconfirmed = DEMO_LINKEDIN_FACTS.map((f) => ({ ...f, confirmed: false }));
    const [r] = trace("I built a course-planning web app with Python and React.", unconfirmed);
    expect(r.sources.every((s) => s.kind !== "fact")).toBe(true);
    expect(r.status).not.toBe("traced");
  });

  it("splits lines and bullets, and skips fragments with nothing to trace", () => {
    const rs = trace("Hi!\n\n- Built a course-planning web app with Python and React\n- Teaching assistant for an introductory programming course");
    expect(rs.map((r) => r.text)).toEqual([
      "Built a course-planning web app with Python and React",
      "Teaching assistant for an introductory programming course",
    ]);
  });

  it("counts Hinge prompt questions as source text", () => {
    const [r] = traceSentences("Perfect Sunday: pancakes and a long walk.", DEMO_HINGE_SEGMENTS, DEMO_HINGE_FACTS);
    expect(r.status).toBe("traced");
  });

  it("traces every sentence of the sample rewrite", () => {
    for (const v of SAMPLE_REWRITE.variations) {
      const untraced = trace(v.rewrite.content).filter((r) => r.status === "untraced");
      expect(untraced).toEqual([]);
    }
  });
});
