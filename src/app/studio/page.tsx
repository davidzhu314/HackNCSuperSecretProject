import type { Metadata } from "next";
import { Suspense } from "react";
import { PersonaFlow } from "@/components/PersonaFlow";
import { StudioFromUrl } from "@/components/StudioFromUrl";

export const metadata: Metadata = {
  title: "Profile Studio — Personify",
  description:
    "Audience feedback and fact-checked rewrites for your LinkedIn or Hinge profile.",
};

// The page is prerendered; the platform in the URL is read on the client, inside Suspense
// (Next 16 requires this for useSearchParams on a static page). The fallback is the LinkedIn studio.
export default function StudioPage() {
  return (
    <Suspense fallback={<PersonaFlow />}>
      <StudioFromUrl />
    </Suspense>
  );
}
