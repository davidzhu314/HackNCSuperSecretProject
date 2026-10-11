import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import aeroSky from "@/assets/aero-sky.jpg";
import datingCouple from "@/assets/dating-couple.jpg";
import linkedinSpeaker from "@/assets/linkedin-speaker.jpg";
import personifyLogo from "@/assets/personify-logo-v3.png";
import socialNightlife from "@/assets/social-nightlife.jpg";
import type { Platform } from "@/lib/schemas";

// Page chrome shared by the home page, the hub, and the studio (from the Lovable designs: the Aero
// sky, and the scenic "destinations"). Each platform uses its group's scene: professional the
// speaker, social the nightlife, dating the couple. The scene photos are from Unsplash (free license):
// unsplash.com/photos/RfiBK6Y_upQ (speaker), /j4esZ9owgzA (nightlife), and /xM4wUnvbCKk (couple,
// Priscilla Du Preez).

type Scene = { image: StaticImageData; name: string; caption: string; description: string };

export const SCENES: Record<Platform, Scene> = {
  linkedin: {
    image: linkedinSpeaker,
    name: "LinkedIn",
    caption: "A world of opportunity.",
    description: "Your experience. Your ambitions. Your next chapter.",
  },
  handshake: {
    image: linkedinSpeaker,
    name: "Handshake",
    caption: "Your first big break.",
    description: "Your studies. Your projects. Your first role.",
  },
  instagram: {
    image: socialNightlife,
    name: "Instagram",
    caption: "A first glance that's yours.",
    description: "Your interests. Your voice. In one short bio.",
  },
  facebook: {
    image: socialNightlife,
    name: "Facebook",
    caption: "What you're up to now.",
    description: "Your news. Your groups. Your people.",
  },
  hinge: {
    image: datingCouple,
    name: "Hinge",
    caption: "Somewhere you belong.",
    description: "Your quirks. Your stories. Your kind of connection.",
  },
  tinder: {
    image: datingCouple,
    name: "Tinder",
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
