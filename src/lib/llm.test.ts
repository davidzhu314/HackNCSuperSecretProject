import { afterEach, describe, expect, it } from "vitest";
import { callStructured, DEFAULT_REWRITE_MODEL, getRewriteModel, LlmError, type ChatClient } from "./llm";
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

describe("callStructured", () => {
  const savedKey = process.env.OPENROUTER_API_KEY;
  afterEach(() => {
    if (savedKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = savedKey;
  });

  it("returns validated data and sends a strict json_schema with require_parameters", async () => {
    const { client, calls } = fakeClient(['{"facts":["I study CS."]}']);
    const out = await callStructured({ ...base, client });
    expect(out).toEqual({ facts: ["I study CS."] });
    const body = calls[0] as { response_format: { json_schema: { strict: boolean; schema: object } }; provider: object };
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.response_format.json_schema.schema).not.toHaveProperty("$schema");
    expect(body.provider).toEqual({ require_parameters: true });
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

  it("reports a missing API key", async () => {
    delete process.env.OPENROUTER_API_KEY;
    await expect(callStructured(base)).rejects.toBeInstanceOf(LlmError);
    await expect(callStructured(base)).rejects.toMatchObject({ code: "missing_api_key" });
  });
});

describe("getRewriteModel", () => {
  it("defaults to sonnet and can be overridden by env", () => {
    const saved = process.env.OPENROUTER_REWRITE_MODEL;
    delete process.env.OPENROUTER_REWRITE_MODEL;
    expect(getRewriteModel()).toBe(DEFAULT_REWRITE_MODEL);
    expect(DEFAULT_REWRITE_MODEL).toBe("anthropic/claude-sonnet-5.5");
    process.env.OPENROUTER_REWRITE_MODEL = "google/gemini-3.8-flash";
    expect(getRewriteModel()).toBe("google/gemini-3.8-flash");
    if (saved === undefined) delete process.env.OPENROUTER_REWRITE_MODEL;
    else process.env.OPENROUTER_REWRITE_MODEL = saved;
  });
});
