"use client";

import { useSearchParams } from "next/navigation";
import { PersonaFlow } from "@/components/PersonaFlow";
import { useIdentitySession } from "@/lib/identity-session";

/** Reads `?platform=` so links like the Identity Hub's can open the studio on Hinge. */
export function StudioFromUrl() {
  const platform = useSearchParams().get("platform") === "hinge" ? "hinge" : "linkedin";
  const { rev } = useIdentitySession();
  // Keyed so following a link to the other platform, or changing the profile in the hub,
  // starts a fresh session on it from the hub's data.
  return <PersonaFlow key={`${platform}:${rev}`} initialPlatform={platform} />;
}
