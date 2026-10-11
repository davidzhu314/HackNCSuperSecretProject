import { ArrowLeft, ArrowUpRight, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Backdrop, Wordmark } from "@/components/Chrome";
import { IdentityHub } from "@/components/IdentityHub";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Identity Hub — Personify",
  description: "One set of confirmed facts for every platform, and where they show up on your LinkedIn.",
};

export default function HubPage() {
  return (
    <div className="app-root hub-root" data-theme="linkedin">
      <Backdrop />
      <header className="tour-header">
        <Button variant="tour" nativeButton={false} render={<Link href="/" />}>
          <ArrowLeft />
          Overview
        </Button>
        <Wordmark className="tour-wordmark" />
        <div className="tour-header-actions">
          <Button variant="tour" nativeButton={false} render={<Link href="/studio" />}>
            Profile studio <ArrowUpRight />
          </Button>
        </div>
      </header>
      <main className="hub-main">
        <IdentityHub />
      </main>
      <footer className="tour-footer tour-footer-static">
        <span className="tour-privacy">
          <ShieldCheck size={13} />
          This tab only · nothing sent or stored
        </span>
        <span className="tour-privacy">Improve expression, not invent identity.</span>
      </footer>
    </div>
  );
}
