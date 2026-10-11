import { checkRewrite } from "./fact-guard";
import { PLATFORM_CONFIGS } from "./rubrics";
import { checkLength, checkStyle } from "./style-check";
import {
  SAMPLE_ADVERSARIAL_REWRITE,
  SAMPLE_BIO_ADVERSARIAL_CONTENT,
  SAMPLE_HINGE_ADVERSARIAL_CONTENT,
  SAMPLE_EVALUATE,
  SAMPLE_EXTRACT,
  SAMPLE_PROFILE_EVALUATE,
  SAMPLE_REWRITE,
  SAMPLE_SECTION_REWRITES,
  SAMPLE_TINDER_ADVERSARIAL_CONTENT,
} from "./demo-data";
import { checkTinderLength, fieldFactsAsFacts } from "./tinder";
import { sectionOfSegment } from "./profile";
import {
  ApiErrorSchema,
  EvaluateResponseSchema,
  ExtractFactsResponseSchema,
  RewriteResponseSchema,
  RewriteSectionResponseSchema,
  type ApiError,
  type EvaluateRequest,
  type EvaluateResponse,
  type ExtractFactsRequest,
  type ExtractFactsResponse,
  type RewriteRequest,
  type RewriteResponse,
  type RewriteSectionRequest,
  type RewriteSectionResponse,
} from "./schemas";
import type { z } from "zod";

// Browser-side helper for the API routes. Safe to import from client components:
// it never touches the API key (that lives only in llm.ts on the server).
// Sample mode returns the labeled demo results without calling the AI.

export type ClientErrorCode = ApiError["error"]["code"] | "network_error";

export class ClientApiError extends Error {
  constructor(
    public code: ClientErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ClientApiError";
  }
}

const FRIENDLY: Record<ClientErrorCode, string> = {
  invalid_request: "Something about the input wasn't accepted. Check your text and try again.",
  consent_required: "Please agree to the consent step before we send anything to the AI.",
  missing_api_key: "The server isn't set up with an AI key yet. Use sample mode or ask the team to add it.",
  rate_limited: "The AI provider is busy. Wait a few seconds and try again.",
  invalid_model_output: "The AI gave an unusable answer. Try again.",
  upstream_error: "The AI provider request failed. Try again, or use sample mode.",
  network_error: "Couldn't reach the server. Check your connection and try again.",
};

/** Human-readable message for an error thrown by this module. */
export function errorMessage(err: unknown): string {
  if (err instanceof ClientApiError) {
    // invalid_request messages from the server are specific and safe to show
    return err.code === "invalid_request" ? err.message : FRIENDLY[err.code];
  }
  return FRIENDLY.network_error;
}

async function post<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ClientApiError("network_error", FRIENDLY.network_error);
  }
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = ApiErrorSchema.safeParse(json);
    if (parsed.success) throw new ClientApiError(parsed.data.error.code, parsed.data.error.message);
    throw new ClientApiError("upstream_error", FRIENDLY.upstream_error);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new ClientApiError("invalid_model_output", FRIENDLY.invalid_model_output);
  return parsed.data;
}

/** Short pause so sample mode still shows loading states. */
const pause = () => new Promise((r) => setTimeout(r, 400));

export async function extractFacts(req: ExtractFactsRequest, opts: { sample?: boolean } = {}): Promise<ExtractFactsResponse> {
  if (opts.sample) return pause().then(() => SAMPLE_EXTRACT);
  return post("/api/facts/extract", req, ExtractFactsResponseSchema);
}

export async function evaluateProfile(req: EvaluateRequest, opts: { sample?: boolean } = {}): Promise<EvaluateResponse> {
  if (opts.sample) {
    await pause();
    // A sectioned LinkedIn profile cites ids like "exp1-s2"; the legacy flow cites "s1".
    const sampleSet = req.segments.some((s) => sectionOfSegment(s.id)) ? SAMPLE_PROFILE_EVALUATE : SAMPLE_EVALUATE;
    return {
      ...sampleSet,
      critiques: sampleSet.critiques.filter(
        (c) => req.audiences.includes(c.audience) && req.traits.includes(c.trait),
      ),
    };
  }
  return post("/api/evaluate", req, EvaluateResponseSchema);
}

export async function rewriteProfile(
  req: RewriteRequest,
  opts: { sample?: boolean; adversarial?: boolean } = {},
): Promise<RewriteResponse> {
  if (opts.adversarial) {
    await pause();
    if (req.platform === "linkedin") return SAMPLE_ADVERSARIAL_REWRITE;
    const config = PLATFORM_CONFIGS[req.platform];
    const content =
      req.platform === "hinge"
        ? SAMPLE_HINGE_ADVERSARIAL_CONTENT
        : req.platform === "tinder"
          ? SAMPLE_TINDER_ADVERSARIAL_CONTENT
          : SAMPLE_BIO_ADVERSARIAL_CONTENT[req.platform];
    const facts = [...req.facts, ...fieldFactsAsFacts(req.fieldFacts ?? [])];
    const rewrite = {
      platform: req.platform,
      content,
      usedFactIds: [],
      changeSummary: ["Intentionally embellished test case."],
    };
    return {
      source: "sample",
      variations: [
        {
          style: "direct",
          rewrite,
          warnings: checkRewrite({ rewrite, segments: req.segments, facts }),
          styleWarnings: [
            ...checkStyle(rewrite.content),
            ...(config.input === "tinder"
              ? checkTinderLength(content.split(/\n\n+/), req.segments)
              : checkLength(config.input === "prompts" ? content.split(/\n\n+/) : [content], config.maxChars, config.label)),
          ],
        },
      ],
    };
  }
  if (opts.sample) return pause().then(() => SAMPLE_REWRITE);
  return post("/api/rewrite", req, RewriteResponseSchema);
}

/** LinkedIn: rewrite one section in one style and length. Sample mode serves the cached demo rewrite (same length only). */
export async function rewriteSection(
  req: RewriteSectionRequest,
  opts: { sample?: boolean } = {},
): Promise<RewriteSectionResponse> {
  if (opts.sample) {
    await pause();
    if (req.length && req.length !== "same") {
      throw new ClientApiError("invalid_request", "Sample results only exist at the same length. Turn off sample mode to change the length.");
    }
    const cached = SAMPLE_SECTION_REWRITES[req.section.key]?.[req.style];
    if (!cached) throw new ClientApiError("invalid_request", "There's no sample result for this section. Turn off sample mode to rewrite it live.");
    return cached;
  }
  return post("/api/rewrite-section", req, RewriteSectionResponseSchema);
}
