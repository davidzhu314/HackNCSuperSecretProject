import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import aeroSky from "@/assets/aero-sky.jpg";
import hingeNightlife from "@/assets/hinge-nightlife.jpg";
import linkedinSpeaker from "@/assets/linkedin-speaker.jpg";
import personifyLogo from "@/assets/personify-logo-v3.png";
import type { Platform } from "@/lib/schemas";

// Page chrome shared by the home page, the hub, and the studio (from the Lovable designs:
// the Aero sky, and the scenic LinkedIn speaker / Hinge nightlife "destinations"). The two scene
// photos are from Unsplash (free license): unsplash.com/photos/RfiBK6Y_upQ and /j4esZ9owgzA.
// Other platforms reuse their group's scene: professional the speaker, dating the nightlife,
// social the Aero sky.

type Scene = { image: StaticImageData; name: string; lens: string; caption: string; description: string };

export const SCENES: Record<Platform, Scene> = {
  linkedin: {
    image: linkedinSpeaker,
    name: "LinkedIn",
    lens: "RECRUITERS · HIRING LEADS",
    caption: "A world of opportunity.",
    description: "Your experience. Your ambitions. Your next chapter.",
  },
  handshake: {
    image: linkedinSpeaker,
    name: "Handshake",
    lens: "CAMPUS RECRUITERS · HIRING MANAGERS",
    caption: "Your first big break.",
    description: "Your studies. Your projects. Your first role.",
  },
  instagram: {
    image: aeroSky,
    name: "Instagram",
    lens: "NEW VISITORS · SHARED INTERESTS",
    caption: "A first glance that's yours.",
    description: "Your interests. Your voice. In one short bio.",
  },
  facebook: {
    image: aeroSky,
    name: "Facebook",
    lens: "OLD FRIENDS · COMMUNITIES",
    caption: "What you're up to now.",
    description: "Your news. Your groups. Your people.",
  },
  twitter: {
    image: aeroSky,
    name: "X (Twitter)",
    lens: "POTENTIAL FOLLOWERS · PEERS",
    caption: "Say what you post about.",
    description: "Your topics. Your voice. In 160 characters.",
  },
  hinge: {
    image: hingeNightlife,
    name: "Hinge",
    lens: "POTENTIAL MATCHES · SHARED INTERESTS",
    caption: "Somewhere you belong.",
    description: "Your quirks. Your stories. Your kind of connection.",
  },
  tinder: {
    image: hingeNightlife,
    name: "Tinder",
    lens: "POTENTIAL MATCHES · SHARED INTERESTS",
    caption: "A first line worth replying to.",
    description: "Your quirks. Your stories. Your kind of connection.",
  },
};

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

export function WorldFooter() {
  return (
    <footer className="world-footer">
      <span>personify</span>
    </footer>
  );
}
