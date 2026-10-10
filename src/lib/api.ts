import { NextResponse } from "next/server";
import type { z } from "zod";
import { LlmError } from "./llm";
import type { ApiError } from "./schemas";

const STATUS: Record<ApiError["error"]["code"], number> = {
  invalid_request: 400,
  consent_required: 403,
  missing_api_key: 500,
  rate_limited: 429,
  invalid_model_output: 502,
  upstream_error: 502,
};

export function errorResponse(code: ApiError["error"]["code"], message: string) {
  return NextResponse.json<ApiError>({ error: { code, message } }, { status: STATUS[code] });
}

/**
 * Shared POST wrapper: parse JSON, require consent, validate with zod, map errors.
 * Never logs request bodies (they contain profile text).
 */
export async function handlePost<S extends z.ZodType>(
  req: Request,
  schema: S,
  run: (data: z.infer<S>) => Promise<unknown>,
) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("invalid_request", "Request body must be valid JSON.");
  }
  if ((body as { consent?: unknown } | null)?.consent !== true) {
    return errorResponse("consent_required", "You must consent to sending your text to the AI provider.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return errorResponse("invalid_request", `Invalid request: ${first?.path.join(".") || "body"} ${first?.message ?? ""}`.trim());
  }
  try {
    return NextResponse.json(await run(parsed.data));
  } catch (err) {
    if (err instanceof LlmError) return errorResponse(err.code, err.message);
    console.error("route error:", err instanceof Error ? err.name : "unknown");
    return errorResponse("upstream_error", "Something went wrong on the server.");
  }
}
