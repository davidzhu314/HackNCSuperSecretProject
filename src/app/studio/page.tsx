import type { Metadata } from "next";
import { PersonaFlow } from "@/components/PersonaFlow";

export const metadata: Metadata = {
  title: "Profile Studio — Personify",
  description:
    "Audience feedback and fact-checked rewrites for your LinkedIn or Hinge profile.",
};

export default function StudioPage() {
  return <PersonaFlow />;
}
