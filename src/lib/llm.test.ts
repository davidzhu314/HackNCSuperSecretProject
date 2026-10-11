import { afterEach, describe, expect, it } from "vitest";
import {
  callStructured,
  DEFAULT_REWRITE_MODEL,
  getModel,
  getProvider,
  getRewriteModel,
  LlmError,
  OPENROUTER_DEFAULT_MODEL,
  OPENROUTER_DEFAULT_REWRITE_MODEL,
  type ChatClient,
} from "./llm";
import { ModelExtractSchema } from "./schemas";

function fakeClient(replies: (string | Error)[]) {
  const calls: Record<string, unknown>[] = [];
  const client: ChatClient = {
    chat: {
      completions: {
        async create(params) {
          calls.push(params);
          const next = replies.shift();
          if (next instanceof Error) throw next;
          return { choices: [{ message: { content: next ?? null } }] };
        },
      },
    },
  };
  return { client, calls };
}

const base = { system: "s", user: "u", schemaName: "extract", schema: ModelExtractSchema };

const ENV_VARS = ["GEMINI_API_KEY", "GEMINI_MODEL", "GEMINI_REWRITE_MODEL", "OPENROUTER_API_KEY", "OPENROUTER_MODEL", "OPENROUTER_REWRITE_MODEL"];
const savedEnv = Object.fromEntries(ENV_VARS.map((k) => [k, process.env[k]]));
afterEach(() => {
  for (const k of ENV_VARS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});
const clearEnv = () => ENV_VARS.forEach((k) => delete process.env[k]);

describe("callStructured", () => {

  it("returns validated data and sends a strict json_schema", async () => {
    const { client, calls } = fakeClient(['{"facts":["I study CS."]}']);
    const out = await callStructured({ ...base, client });
    expect(out).toEqual({ facts: ["I study CS."] });
    const body = calls[0] as { response_format: { json_schema: { strict: boolean; schema: object } } };
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.response_format.json_schema.schema).not.toHaveProperty("$schema");
  });

  it("retries once on invalid JSON, then succeeds", async () => {
    const { client, calls } = fakeClient(["not json", '{"facts":[]}']);
    expect(await callStructured({ ...base, client })).toEqual({ facts: [] });
    expect(calls).toHaveLength(2);
  });

  it("retries once on schema mismatch, then gives invalid_model_output", async () => {
    const { client, calls } = fakeClient(['{"facts":"nope"}', '{"wrong":1}']);
    await expect(callStructured({ ...base, client })).rejects.toMatchObject({ code: "invalid_model_output" });
    expect(calls).toHaveLength(2);
  });

  it("accepts JSON wrapped in markdown fences", async () => {
    const { client } = fakeClient(['```json\n{"facts":["a"]}\n```']);
    expect(await callStructured({ ...base, client })).toEqual({ facts: ["a"] });
  });

  it("retries a 429 once after a pause, then succeeds", async () => {
    const { client, calls } = fakeClient([Object.assign(new Error("x"), { status: 429 }), '{"facts":["I study CS."]}']);
    await expect(callStructured({ ...base, client, rateLimitRetryMs: 0 })).resolves.toEqual({ facts: ["I study CS."] });
    expect(calls).toHaveLength(2);
  });

  it("maps a second 429 to rate_limited and stops", async () => {
    const limited = () => Object.assign(new Error("x"), { status: 429 });
    const { client, calls } = fakeClient([limited(), limited(), '{"facts":[]}']);
    await expect(callStructured({ ...base, client, rateLimitRetryMs: 0 })).rejects.toMatchObject({ code: "rate_limited" });
    expect(calls).toHaveLength(2);
  });

  it("doesn't retry other upstream errors", async () => {
    const { client, calls } = fakeClient([Object.assign(new Error("x"), { status: 500 }), '{"facts":[]}']);
    await expect(callStructured({ ...base, client, rateLimitRetryMs: 0 })).rejects.toMatchObject({ code: "upstream_error" });
    expect(calls).toHaveLength(1);
  });

  it("reports a missing API key when neither provider has one", async () => {
    clearEnv();
    await expect(callStructured(base)).rejects.toBeInstanceOf(LlmError);
    await expect(callStructured(base)).rejects.toMatchObject({ code: "missing_api_key" });
  });
});

describe("provider", () => {
  it("uses Gemini when its key is set, with its own model vars", () => {
    clearEnv();
    process.env.GEMINI_API_KEY = "test";
    process.env.OPENROUTER_API_KEY = "test";
    expect(getProvider().name).toBe("gemini");
    expect(getRewriteModel()).toBe(DEFAULT_REWRITE_MODEL);
    process.env.GEMINI_REWRITE_MODEL = "gemini-3.8-flash-preview";
    expect(getRewriteModel()).toBe("gemini-3.8-flash-preview");
  });

  it("falls back to OpenRouter when only its key is set, with its own models and routing", async () => {
    clearEnv();
    process.env.OPENROUTER_API_KEY = "test";
    expect(getProvider().name).toBe("openrouter");
    expect(getModel()).toBe(OPENROUTER_DEFAULT_MODEL);
    expect(getRewriteModel()).toBe(OPENROUTER_DEFAULT_REWRITE_MODEL);
    process.env.OPENROUTER_MODEL = "google/gemini-3.1-flash-lite";
    expect(getModel()).toBe("google/gemini-3.1-flash-lite");
    const { client, calls } = fakeClient(['{"facts":[]}']);
    await callStructured({ ...base, client });
    expect(calls[0]).toMatchObject({ model: "google/gemini-3.1-flash-lite", provider: { require_parameters: true } });
  });

  it("sends no OpenRouter routing field to Gemini", async () => {
    clearEnv();
    process.env.GEMINI_API_KEY = "test";
    const { client, calls } = fakeClient(['{"facts":[]}']);
    await callStructured({ ...base, client });
    expect(calls[0]).not.toHaveProperty("provider");
    expect(calls[0]).toMatchObject({ model: "gemini-3.8-flash" });
  });
});
