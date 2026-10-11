"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage, verifyFact } from "./api-client";
import type { AiFactCheck } from "./fact-claims";
import type { VerifyFactRequest } from "./schemas";

/**
 * Lie Checker AI results per fact id. Each result remembers the fact text and the profile
 * (`basis`) it was checked against, so an edit or a profile change makes it stale on its own.
 * Lives in the studio (not the facts step) so results survive moving between steps.
 */
export function useFactChecks() {
  const [checks, setChecks] = useState<Record<string, AiFactCheck>>({});
  const latest = useRef(checks);
  const inFlight = useRef(new Map<string, AbortController>());

  useEffect(() => {
    const controllers = inFlight.current;
    return () => controllers.forEach((c) => c.abort());
  }, []);

  const put = useCallback((id: string, check: AiFactCheck) => {
    latest.current = { ...latest.current, [id]: check };
    setChecks(latest.current);
  }, []);

  /** Check a fact. Skips if this exact text and profile were already checked, unless `force` (Re-check). */
  const run = useCallback(
    (req: Omit<VerifyFactRequest, "consent">, basis: string, opts: { force?: boolean } = {}) => {
      const id = req.fact.id;
      const text = req.fact.text.trim();
      if (!text) return;
      const prev = latest.current[id];
      if (!opts.force && prev && prev.text === text && prev.basis === basis && prev.state !== "error") return;

      inFlight.current.get(id)?.abort();
      const controller = new AbortController();
      inFlight.current.set(id, controller);
      put(id, { text, basis, state: "pending" });

      verifyFact({ ...req, fact: { id, text }, consent: true }, { signal: controller.signal })
        .then((result) => {
          if (!controller.signal.aborted) put(id, { text, basis, state: "done", result });
        })
        .catch((err) => {
          if (!controller.signal.aborted) put(id, { text, basis, state: "error", message: errorMessage(err) });
        })
        .finally(() => {
          if (inFlight.current.get(id) === controller) inFlight.current.delete(id);
        });
    },
    [put],
  );

  return { checks, run };
}

export type FactChecks = ReturnType<typeof useFactChecks>;
