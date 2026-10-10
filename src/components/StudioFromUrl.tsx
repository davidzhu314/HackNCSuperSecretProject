"use client";

import { useSearchParams } from "next/navigation";
import { PersonaFlow } from "@/components/PersonaFlow";

/** Reads `?platform=` so links like the Identity Hub's can open the studio on Hinge. */
export function StudioFromUrl() {
  const platform = useSearchParams().get("platform") === "hinge" ? "hinge" : "linkedin";
  // Keyed so following a link to the other platform starts a fresh session on it.
  return <PersonaFlow key={platform} initialPlatform={platform} />;
}
