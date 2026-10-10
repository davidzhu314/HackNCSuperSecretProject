"use client";

import { ArrowRight, Check, Clipboard, Fingerprint } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Platform } from "@/lib/schemas";

// The end of the studio: where to go next instead of a dead end. Copy the updated profile
// (LinkedIn), see the result in the Identity Hub, or take the same confirmed facts to the
// other platform.

const NAME: Record<Platform, string> = { linkedin: "LinkedIn", hinge: "Hinge" };

export function StudioFinish(props: {
  platform: Platform;
  /** LinkedIn: sections that use a rewrite, and how many could. */
  used?: { count: number; total: number };
  confirmedFacts: number;
  onCopyProfile?: () => Promise<boolean>;
  onOtherPlatform: () => void;
}) {
  const { platform, used, confirmedFacts, onCopyProfile, onOtherPlatform } = props;
  const [copied, setCopied] = useState(false);
  const other: Platform = platform === "linkedin" ? "hinge" : "linkedin";

  return (
    <section className="studio-finish" aria-labelledby="finish-h">
      <div>
        <h3 id="finish-h" className="section-heading">
          <Check />
          Done with {NAME[platform]}?
        </h3>
        <p className="empty-note">
          {used
            ? used.count
              ? `${used.count} of ${used.total} sections now use a rewrite. Your Identity Hub shows which of your facts they added.`
              : "Use the rewrites you like (“Use this version”), then copy your updated profile."
            : "Copy the version you like above, then take your facts to the next platform."}
        </p>
      </div>
      <div className="studio-finish-actions">
        {onCopyProfile && (
          <Button
            variant="glass"
            disabled={!used?.count}
            onClick={async () => setCopied(await onCopyProfile())}
            title={used?.count ? undefined : "Use at least one rewrite first"}
          >
            {copied ? <Check /> : <Clipboard />}
            {copied ? "Copied" : "Copy updated profile"}
          </Button>
        )}
        <Button variant="glass" nativeButton={false} render={<Link href="/hub" />}>
          <Fingerprint />
          See it in your Identity Hub
        </Button>
        <Button variant="aero" onClick={onOtherPlatform}>
          {NAME[other]} next{confirmedFacts ? ` with your ${confirmedFacts} ${confirmedFacts === 1 ? "fact" : "facts"}` : ""}
          <ArrowRight />
        </Button>
      </div>
    </section>
  );
}
