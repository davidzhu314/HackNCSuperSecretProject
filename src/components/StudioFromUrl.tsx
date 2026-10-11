"use client";

import { useSearchParams } from "next/navigation";
import { PersonaFlow } from "@/components/PersonaFlow";
import { useIdentitySession } from "@/lib/identity-session";
import { PlatformSchema } from "@/lib/schemas";

/** Reads `?platform=` so links like the Identity Hub's can open the studio on any platform (LinkedIn by default). */
export function StudioFromUrl() {
  const parsed = PlatformSchema.safeParse(useSearchParams().get("platform"));
  const platform = parsed.success ? parsed.data : "linkedin";
  const { rev } = useIdentitySession();
  // Keyed so following a link to the other platform, or changing the profile in the hub,
  // starts a fresh session on it from the hub's data.
  return <PersonaFlow key={`${platform}:${rev}`} initialPlatform={platform} />;
}
