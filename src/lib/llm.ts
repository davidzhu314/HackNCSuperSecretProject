import OpenAI from "openai";
import { z } from "zod";
import type { ApiError } from "./schemas";

// Server-side only: reads GEMINI_API_KEY (or, without it, OPENROUTER_API_KEY) from process.env.
// Import this file from route handlers only, never from client components.
// Never log prompts, profile text, or keys.

/**
 * Which AI provider the server uses. Gemini (Google's OpenAI-compatible endpoint) when
 * GEMINI_API_KEY is set; otherwise OpenRouter when OPENROUTER_API_KEY is set, so a deployment that
 * only has the OpenRouter key keeps working. Each provider has its own model and temperature vars.
 */
type Provider = {
  name: "gemini" | "openrouter";
  keyVar: string;
  baseURL: string;
  model: string;
  rewriteModel: string;
  temperatureVar: string;
  /** Extra request fields this provider needs. */
  extra: Record<string, unknown>;
};

export const DEFAULT_MODEL = "gemini-3.8-flash";
/** Rewrites can use a separately configured model when desired. */
export const DEFAULT_REWRITE_MODEL = "gemini-3.8-flash";
export const OPENROUTER_DEFAULT_MODEL = "anthropic/claude-haiku-5.5";
export const OPENROUTER_DEFAULT_REWRITE_MODEL = "anthropic/claude-sonnet-5.5";

const env = (name: string) => process.env[name]?.trim() || undefined;

export function getProvider(): Provider {
  if (!env("GEMINI_API_KEY") && env("OPENROUTER_API_KEY")) {
    return {
      name: "openrouter",
      keyVar: "OPENROUTER_API_KEY",
      baseURL: "https://openrouter.ai/api/v1",
      model: env("OPENROUTER_MODEL") ?? OPENROUTER_DEFAULT_MODEL,
      rewriteModel: env("OPENROUTER_REWRITE_MODEL") ?? OPENROUTER_DEFAULT_REWRITE_MODEL,
      temperatureVar: "OPENROUTER_TEMPERATURE",
      // Route only to endpoints that support every parameter we send (incl. json_schema).
      extra: { provider: { require_parameters: true } },
    };
  }
  return {
    name: "gemini",
    keyVar: "GEMINI_API_KEY",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    model: env("GEMINI_MODEL") ?? DEFAULT_MODEL,
    rewriteModel: env("GEMINI_REWRITE_MODEL") ?? DEFAULT_REWRITE_MODEL,
    temperatureVar: "GEMINI_TEMPERATURE",
    extra: {},
  };
}

export class LlmError extends Error {
  constructor(
    public code: ApiError["error"]["code"],
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

/** The slice of the Gemini-compatible OpenAI client we use, so callers can pass a fake. */
export type ChatClient = {
  chat: {
    completions: {
      create(params: Record<string, unknown>): Promise<{
        choices: { message: { content: string | null } }[];
      }>;
    };
  };
};

function getClient(): ChatClient {
  const provider = getProvider();
  const apiKey = env(provider.keyVar);
  if (!apiKey) {
    throw new LlmError("missing_api_key", "The server has no AI API key configured (GEMINI_API_KEY or OPENROUTER_API_KEY).");
  }
  return new OpenAI({ apiKey, baseURL: provider.baseURL }) as unknown as ChatClient;
}

export function getModel(): string {
  return getProvider().model;
}

export function getRewriteModel(): string {
  return getProvider().rewriteModel;
}

/**
 * Temperature is optional; leave it unset to use the model's default. (Some OpenRouter models, e.g.
 * anthropic/claude-haiku-5.5, have no endpoint that accepts it at all.)
 */
function temperatureParam(): { temperature?: number } {
  const raw = env(getProvider().temperatureVar);
  const t = raw ? Number(raw) : NaN;
  return Number.isFinite(t) ? { temperature: t } : {};
}

function toJsonSchema(schema: z.ZodType) {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

/** Models sometimes wrap JSON in markdown fences even in JSON mode. */
function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(trimmed);
}

function mapUpstreamError(err: unknown): LlmError {
  const status = (err as { status?: number })?.status;
  if (status === 429) return new LlmError("rate_limited", "The AI provider is rate limiting requests. Try again shortly.", 429);
  if (status === 401 || status === 403) {
    return new LlmError("upstream_error", "The AI provider rejected the server's credentials.", status);
  }
  return new LlmError("upstream_error", "The AI provider request failed.", status);
}

/** Wait before retrying a 429 once. */
export const RATE_LIMIT_RETRY_MS = 2000;

/** One request, retried once after a short pause if the provider rate-limits it (429). */
async function createWithRateRetry(client: ChatClient, params: Record<string, unknown>, retryMs: number) {
  try {
    return await client.chat.completions.create(params);
  } catch (err) {
    if ((err as { status?: number })?.status !== 429) throw err;
    await new Promise((resolve) => setTimeout(resolve, retryMs));
    return client.chat.completions.create(params);
  }
}

export type StructuredCall<T> = {
  system: string;
  user: string;
  schemaName: string;
  schema: z.ZodType<T>;
  model?: string;
  client?: ChatClient;
  maxTokens?: number;
  /** Pause before the single 429 retry (tests pass 0). */
  rateLimitRetryMs?: number;
};

/**
 * One structured-output call. Validates with zod and retries once if the output is
 * not valid JSON or fails the schema.
 */
export async function callStructured<T>(opts: StructuredCall<T>): Promise<T> {
  const client = opts.client ?? getClient();
  const jsonSchema = toJsonSchema(opts.schema);

  let lastProblem = "no attempt made";
  for (let attempt = 0; attempt < 2; attempt++) {
    const retryNote =
      attempt === 0
        ? ""
        : "\n\nYour previous reply was not valid JSON for the required schema. Reply again with only valid JSON.";

    let content: string | null;
    try {
      const res = await createWithRateRetry(client, {
        model: opts.model ?? getModel(),
        ...getProvider().extra,
        ...temperatureParam(),
        max_tokens: opts.maxTokens ?? 2000,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user + retryNote },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: opts.schemaName, strict: true, schema: jsonSchema },
        },
      }, opts.rateLimitRetryMs ?? RATE_LIMIT_RETRY_MS);
      content = res.choices[0]?.message?.content ?? null;
    } catch (err) {
      throw mapUpstreamError(err); // network/auth errors aren't retried; a 429 was retried once above
    }

    if (!content) {
      lastProblem = "empty response";
      continue;
    }
    let parsed: unknown;
    try {
      parsed = extractJson(content);
    } catch {
      lastProblem = "response was not valid JSON";
      continue;
    }
    const result = opts.schema.safeParse(parsed);
    if (result.success) return result.data;
    lastProblem = "response did not match the expected schema";
  }
  throw new LlmError("invalid_model_output", `The AI returned an unusable response (${lastProblem}). Please try again.`);
}
