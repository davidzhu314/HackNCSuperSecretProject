import Image from "next/image";
import Link from "next/link";
import aeroSky from "@/assets/aero-sky.jpg";
import hingeNightlife from "@/assets/hinge-nightlife.jpg";
import linkedinSpeaker from "@/assets/linkedin-speaker.jpg";
import personifyLogo from "@/assets/personify-logo-v3.png";
import type { Platform } from "@/lib/schemas";

// Page chrome shared by the home page, the hub, and the studio (from the Lovable designs:
// the Aero sky, and the scenic LinkedIn speaker / Hinge nightlife "destinations"). The two scene
// photos are from Unsplash (free license): unsplash.com/photos/RfiBK6Y_upQ and /j4esZ9owgzA.

export const SCENES = {
  linkedin: {
    image: linkedinSpeaker,
    name: "LinkedIn",
    lens: "RECRUITERS · HIRING LEADS",
    caption: "A world of opportunity.",
    description: "Your experience. Your ambitions. Your next chapter.",
  },
  hinge: {
    image: hingeNightlife,
    name: "Hinge",
    lens: "POTENTIAL MATCHES · SHARED INTERESTS",
    caption: "Somewhere you belong.",
    description: "Your quirks. Your stories. Your kind of connection.",
  },
} as const;

export function Backdrop() {
  return (
    <div className="aero-backdrop" aria-hidden="true">
      <Image src={aeroSky} alt="" fill preload sizes="100vw" style={{ objectFit: "cover" }} />
    </div>
  );
}

/** The platform's photograph, fixed behind the page, with a shade so text stays readable. */
export function ScenicBackdrop({ platform }: { platform: Platform }) {
  return (
    <div className="scenic-backdrop" aria-hidden="true">
      <Image
        key={platform}
        src={SCENES[platform].image}
        alt=""
        fill
        preload
        sizes="100vw"
        placeholder="blur"
        className="scenic-photo"
        data-platform={platform}
      />
      <div className="scenic-shade" />
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

export function Wordmark({ className = "wordmark" }: { className?: string }) {
  return (
    <Link href="/" className={className}>
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
