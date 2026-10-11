import Image from "next/image";
import Link from "next/link";
import aeroSky from "@/assets/aero-sky.jpg";
import personifyLogo from "@/assets/personify-logo-v3.png";
import type { Platform } from "@/lib/schemas";

// Page chrome shared by the home page and the studio (from the Lovable design).

export function Backdrop() {
  return (
    <div className="aero-backdrop" aria-hidden="true">
      <Image src={aeroSky} alt="" fill preload sizes="100vw" style={{ objectFit: "cover" }} />
    </div>
  );
}

export function PersonifyLogo() {
  return (
    <span className="personify-logo">
      <Image
        src={personifyLogo}
        alt="Personify logo: faceless silhouette diagonally split between suit and sweater"
        width={44}
        height={44}
      />
    </span>
  );
}

export function Wordmark() {
  return (
    <Link href="/" className="wordmark">
      <PersonifyLogo />
      personify
    </Link>
  );
}

/** Letter marks instead of brand logos, e.g. "in" for LinkedIn and a serif "H" for Hinge. */
const BRAND_LETTERS: Record<Platform, string> = {
  linkedin: "in",
  handshake: "hs",
  instagram: "ig",
  facebook: "f",
  twitter: "X",
  hinge: "H",
  tinder: "t",
};

export function BrandMark({ platform }: { platform: Platform }) {
  return (
    <span className="brand-mark" data-platform={platform} aria-hidden="true">
      {BRAND_LETTERS[platform]}
    </span>
  );
}

export function WorldFooter({ children }: { children: React.ReactNode }) {
  return (
    <footer className="world-footer">
      <span>personify · a brighter kind of first impression</span>
      <span className="flex items-center gap-1">{children}</span>
    </footer>
  );
}
