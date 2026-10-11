import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEMO_LINKEDIN_FACTS, DEMO_LINKEDIN_PROFILE } from "../src/lib/demo-data";
import { emptyLinkedInProfile, rewritableSections } from "../src/lib/profile";
import {
  RewriteSectionResponseSchema,
  SectionStyleSchema,
  type IdentityFact,
  type LinkedInProfile,
  type SectionStyle,
} from "../src/lib/schemas";
import { caseConfirmedFacts, EvalCaseSchema } from "./schema";

// Writing-quality baseline (HANDOFF-WRITING.md, step 1): send LinkedIn sections through the REAL
// /api/rewrite-section route in every style and write the before/after pairs side by side, so a
// person can read them and say which are worst. It measures nothing on purpose: no metric here
// says whether the writing is good. FactCheck and lint counts are shown only so a "better" rewrite
// that invents something is visible.
//
// Live and paid (about 45 Sonnet calls with the default cases, more with retries). Skipped unless asked for:
//   LIVE_BASELINE=1 npx vitest run evals/writing-baseline.test.ts
// Needs `npm run dev` running with OPENROUTER_API_KEY set. Options:
//   BASELINE_URL     server to call (default http://localhost:3000)
//   BASELINE_CASES   comma-separated: "demo" and/or eval case ids, or "all" (default: demo plus one case per tag)
//   BASELINE_STYLES  comma-separated styles (default: all three)
// Output goes to evals/runs/ (gitignored). Synthetic profiles only: never point this at a real
// person's profile and share the output.

const BASE = process.env.BASELINE_URL ?? "http://localhost:3000";
const DEFAULT_CASES = ["demo", "li-001", "li-004", "li-006", "li-008", "li-010"]; // one per tag
const PARALLEL = 2; // ~40 Sonnet calls in a few minutes has hit provider 429s

// Eval cases name audiences by label; the route takes LinkedIn lens ids.
const LENS: Record<string, string> = {
  "technical recruiter": "technical_recruiter",
  "startup founder": "startup_founder",
  "research or hiring lead": "hiring_manager",
};
const DEMO_LENSES = ["technical_recruiter", "hiring_manager"];

type Job = { caseId: string; profile: LinkedInProfile; facts: IdentityFact[]; audiences: string[]; goal?: string };

function loadJobs(): Job[] {
  const wanted = (process.env.BASELINE_CASES ?? DEFAULT_CASES.join(",")).split(",").map((s) => s.trim());
  const all = wanted.includes("all");
  const jobs: Job[] = [];
  if (all || wanted.includes("demo")) {
    jobs.push({
      caseId: "demo",
      profile: DEMO_LINKEDIN_PROFILE,
      facts: DEMO_LINKEDIN_FACTS.filter((f) => f.confirmed),
      audiences: DEMO_LENSES,
    });
  }
  const dir = join(__dirname, "cases", "linkedin");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const c = EvalCaseSchema.parse(JSON.parse(readFileSync(join(dir, f), "utf8")));
    if (!all && !wanted.includes(c.id)) continue;
    if (c.input.platform !== "linkedin") continue;
    jobs.push({
      caseId: `${c.id} (${c.tags.join(", ")})`,
      profile: { ...emptyLinkedInProfile(), headline: c.input.headline, about: c.input.about },
      facts: caseConfirmedFacts(c),
      audiences: c.audiences.map((a) => LENS[a.toLowerCase()]).filter(Boolean),
      goal: c.goal,
    });
  }
  return jobs;
}

function styles(): SectionStyle[] {
  const raw = process.env.BASELINE_STYLES;
  return raw ? raw.split(",").map((s) => SectionStyleSchema.parse(s.trim())) : SectionStyleSchema.options;
}

/** Run tasks at most `n` at a time, keeping their order. */
async function limited<T>(tasks: (() => Promise<T>)[], n: number): Promise<T[]> {
  const out: T[] = new Array(tasks.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, tasks.length) }, async () => {
      while (next < tasks.length) {
        const i = next++;
        out[i] = await tasks[i]();
      }
    }),
  );
  return out;
}

const quote = (text: string) =>
  text
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");

describe.skipIf(!process.env.LIVE_BASELINE)("Writing baseline (live)", () => {
  it("writes before/after rewrites for every style", { timeout: 30 * 60_000 }, async () => {
    const jobs = loadJobs();
    const styleList = styles();
    expect(jobs.length).toBeGreaterThan(0);

    const calls = jobs.flatMap((job) =>
      rewritableSections(job.profile).flatMap((section) =>
        styleList.map((style) => ({ job, section, style })),
      ),
    );

    const results = await limited(
      calls.map(({ job, section, style }) => async () => {
        const started = Date.now();
        const res = await fetch(`${BASE}/api/rewrite-section`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            consent: true,
            platform: "linkedin",
            section,
            profile: job.profile,
            facts: job.facts,
            style,
            length: "same",
            audiences: job.audiences,
            goal: job.goal,
          }),
        });
        const ms = Date.now() - started;
        const json: unknown = await res.json().catch(() => ({ error: "not JSON" }));
        const parsed = RewriteSectionResponseSchema.safeParse(json);
        return { job, section, style, ms, status: res.status, ok: res.ok && parsed.success, data: parsed.data, json };
      }),
      PARALLEL,
    );

    // One block per section: the original, then each style under it.
    const md: string[] = [
      "# Writing baseline: LinkedIn section rewrites",
      "",
      `Run ${new Date().toISOString()} against ${BASE}, length "same". Synthetic profiles only.`,
      "FactCheck = unsupported concrete claims flagged; Lint = AI-cliche and style warnings. Neither says whether the writing is good.",
      "",
    ];
    let failed = 0;
    let lastCase = "";
    let lastSection = "";
    for (const r of results) {
      if (r.job.caseId !== lastCase) {
        md.push(`## ${r.job.caseId}`, "");
        lastCase = r.job.caseId;
        lastSection = "";
      }
      if (r.section.key !== lastSection) {
        md.push(`### ${r.section.label}`, "", "**Original**", "", quote(r.section.text), "");
        lastSection = r.section.key;
      }
      if (!r.ok || !r.data) {
        failed++;
        md.push(`**${r.style}**: ERROR ${r.status} (${r.ms} ms) \`${JSON.stringify(r.json).slice(0, 200)}\``, "");
        continue;
      }
      const d = r.data;
      md.push(
        `**${r.style}** (${(r.ms / 1000).toFixed(1)} s, ${d.chars.original} → ${d.chars.actual} chars, FactCheck ${d.warnings.length}, Lint ${d.styleWarnings.length})`,
        "",
        quote(d.rewrite.content),
        "",
      );
      for (const w of d.warnings) md.push(`- FactCheck: ${w.kind}: "${w.text}"`);
      if (d.warnings.length) md.push("");
    }

    const out = join(__dirname, "runs");
    mkdirSync(out, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(join(out, `writing-baseline-${stamp}.md`), md.join("\n"));
    writeFileSync(
      join(out, `writing-baseline-${stamp}.json`),
      JSON.stringify(
        results.map(({ job, section, style, ms, status, json }) => ({ caseId: job.caseId, section, style, ms, status, json })),
        null,
        2,
      ),
    );
    console.log(`${calls.length} rewrites, ${failed} failed. Wrote evals/runs/writing-baseline-${stamp}.md`);
    expect(failed).toBeLessThan(calls.length);
  });
});
