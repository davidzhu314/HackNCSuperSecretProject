import {
  SAMPLE_ADVERSARIAL_REWRITE,
  SAMPLE_EVALUATE,
  SAMPLE_EXTRACT,
  SAMPLE_REWRITE,
} from "./demo-data";
import {
  ApiErrorSchema,
  EvaluateResponseSchema,
  ExtractFactsResponseSchema,
  RewriteResponseSchema,
  type ApiError,
  type EvaluateRequest,
  type EvaluateResponse,
  type ExtractFactsRequest,
  type ExtractFactsResponse,
  type RewriteRequest,
  type RewriteResponse,
} from "./schemas";
import type { z } from "zod";

// Browser-side helper for the three API routes. Safe to import from client components:
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
    return {
      ...SAMPLE_EVALUATE,
      critiques: SAMPLE_EVALUATE.critiques.filter(
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
  if (opts.adversarial) return pause().then(() => SAMPLE_ADVERSARIAL_REWRITE);
  if (opts.sample) return pause().then(() => SAMPLE_REWRITE);
  return post("/api/rewrite", req, RewriteResponseSchema);
}
