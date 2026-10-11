import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RewriteResponseSchema, type GuardWarning } from "../src/lib/schemas";
import { caseConfirmedFacts, caseSegments, EvalCaseSchema } from "./schema";

// False-positive sweep: send every eval case through the REAL /api/rewrite route with honest
// input (gold facts as the confirmed facts, no adversarial goal) and count what FactCheck flags.
// On honest input every flag is a false positive or a real model invention, so both matter.
//
// Live and paid (about 20 Sonnet calls). Skipped unless asked for:
//   LIVE_SWEEP=1 npx vitest run evals/fp-sweep.test.ts
// Needs `npm run dev` running with OPENROUTER_API_KEY set. Raw results go to evals/runs/ (gitignored).

const BASE = process.env.SWEEP_URL ?? "http://localhost:3000";
const HARD: GuardWarning["kind"][] = ["unsupported_number", "unsupported_entity", "inflated_verb", "invalid_fact_id"];

function loadCases() {
  const dir = join(__dirname, "cases");
  return ["linkedin", "hinge"].flatMap((platform) =>
    readdirSync(join(dir, platform))
      .filter((f) => f.endsWith(".json"))
      .sort()
      .map((f) => EvalCaseSchema.parse(JSON.parse(readFileSync(join(dir, platform, f), "utf8")))),
  );
}

describe.skipIf(!process.env.LIVE_SWEEP)("FactCheck false-positive sweep (live)", () => {
  it("reports FactCheck flags on honest rewrites", { timeout: 20 * 60_000 }, async () => {
    const rows: string[] = [];
    const raw: unknown[] = [];
    let hardTotal = 0;
    let looseTotal = 0;

    for (const c of loadCases()) {
      const started = Date.now();
      const res = await fetch(`${BASE}/api/rewrite`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          consent: true,
          platform: c.platform,
          segments: caseSegments(c),
          facts: caseConfirmedFacts(c),
          audiences: c.audiences,
          goal: c.goal,
          tone: "balanced",
          jobDescription: c.jobDescription,
        }),
      });
      const ms = Date.now() - started;
      const json: unknown = await res.json();
      raw.push({ id: c.id, status: res.status, ms, json });
      const parsed = RewriteResponseSchema.safeParse(json);
      if (!res.ok || !parsed.success) {
        rows.push(`${c.id}  ERROR ${res.status} (${ms}ms) ${JSON.stringify(json).slice(0, 120)}`);
        continue;
      }
      for (const v of parsed.data.variations) {
        const hard = v.warnings.filter((w) => HARD.includes(w.kind));
        const loose = v.warnings.filter((w) => w.kind === "unsupported_claim");
        hardTotal += hard.length;
        looseTotal += loose.length;
        rows.push(
          `${c.id} ${v.style.padEnd(9)} ${String(ms).padStart(6)}ms  hard=${hard.length} loose=${loose.length}` +
            (hard.length || loose.length ? `  ${[...hard, ...loose].map((w) => `${w.kind}:"${w.text.slice(0, 50)}"`).join("; ")}` : ""),
        );
      }
    }

    mkdirSync(join(__dirname, "runs"), { recursive: true });
    const file = join(__dirname, "runs", `fp-sweep-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    writeFileSync(file, JSON.stringify(raw, null, 2));
    console.log([...rows, "", `hard flags: ${hardTotal}   unsupported_claim: ${looseTotal}`, `raw: ${file}`].join("\n"));
    expect(rows.length).toBeGreaterThan(0);
  });
});
