import type { Metadata } from "next";
import { PersonaFlow } from "@/components/PersonaFlow";

export const metadata: Metadata = {
  title: "Profile Studio — Personify",
  description:
    "Improve expression, not invent identity. Simulated audience feedback, confirmed Identity DNA, and fact-checked rewrites.",
};

export default function StudioPage() {
  return <PersonaFlow />;
}
