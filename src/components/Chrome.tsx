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

/** Letter marks instead of brand logos: "in" for LinkedIn, a serif "H" for Hinge. */
export function BrandMark({ platform }: { platform: Platform }) {
  return (
    <span className="brand-mark" data-platform={platform} aria-hidden="true">
      {platform === "linkedin" ? "in" : "H"}
    </span>
  );
}

export function WorldFooter() {
  return (
    <footer className="world-footer">
      <span>personify</span>
    </footer>
  );
}
