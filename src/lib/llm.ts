import OpenAI from "openai";
import { z } from "zod";
import type { ApiError } from "./schemas";

// Server-side only: reads OPENROUTER_API_KEY from process.env. Import this file
// from route handlers only, never from client components.
// Never log prompts, profile text, or keys.

export const DEFAULT_MODEL = "anthropic/claude-haiku-5.5";
const BASE_URL = "https://openrouter.ai/api/v1";

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

/** The slice of the OpenAI client we use, so tests can pass a fake. */
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
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new LlmError("missing_api_key", "The server has no OpenRouter API key configured.");
  }
  return new OpenAI({ apiKey, baseURL: BASE_URL }) as unknown as ChatClient;
}

export function getModel(): string {
  return process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
}

/** Rewrites use a stronger model: in our comparison it followed formatting and source limits best at ~4s. */
export const DEFAULT_REWRITE_MODEL = "anthropic/claude-sonnet-5.5";

export function getRewriteModel(): string {
  return process.env.OPENROUTER_REWRITE_MODEL?.trim() || DEFAULT_REWRITE_MODEL;
}

/**
 * Some models (verified: anthropic/claude-haiku-5.5 on OpenRouter) have no endpoint that accepts
 * `temperature`, and with require_parameters the request then 404s. So it is opt-in:
 * set OPENROUTER_TEMPERATURE (e.g. 0.2) only for models that support it.
 */
function temperatureParam(): { temperature?: number } {
  const raw = process.env.OPENROUTER_TEMPERATURE?.trim();
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

export type StructuredCall<T> = {
  system: string;
  user: string;
  schemaName: string;
  schema: z.ZodType<T>;
  model?: string;
  client?: ChatClient;
  maxTokens?: number;
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
      const res = await client.chat.completions.create({
        model: opts.model ?? getModel(),
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
        // OpenRouter routes only to endpoints that support every parameter we send (incl. json_schema).
        provider: { require_parameters: true },
      });
      content = res.choices[0]?.message?.content ?? null;
    } catch (err) {
      throw mapUpstreamError(err); // network/auth/rate-limit errors are not retried
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
