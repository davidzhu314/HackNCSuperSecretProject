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

/**
 * Platform logos as single-color glyphs on a 24×24 grid, colored by CSS (`currentColor`), so each
 * sits on its brand-colored tile. Handshake, Instagram, Facebook and Tinder are from Simple Icons
 * (CC0, simpleicons.org, v16.34.0). Simple Icons has no LinkedIn or Hinge: LinkedIn's "in" is drawn
 * here, and Hinge keeps a serif "H" like its wordmark.
 */
const BRAND_PATHS: Partial<Record<Platform, string>> = {
  linkedin:
    "M4.2 9.5h3.3V20H4.2zM5.85 4.1a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8M10 9.5h3.2V11c.5-.9 1.7-1.8 3.5-1.8 3.3 0 3.9 2.2 3.9 5V20h-3.3v-5.1c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V20H10z",
  handshake: "M20.728 0 16.49 24h-4.583l1.87-10.532-4.743 3.893L7.856 24H3.272L7.51 0h4.582L9.806 13.012l4.729-3.862L16.145 0h4.583z",
  instagram: "M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077",
  facebook: "M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z",
  tinder: "M9.317 9.451c.045.073.123.12.212.12.06 0 .116-.021.158-.057l.015-.012c.39-.325.741-.66 1.071-1.017 3.209-3.483 1.335-7.759 1.32-7.799-.09-.21-.03-.459.15-.594.195-.135.435-.12.615.033 10.875 10.114 7.995 17.818 7.785 18.337-.87 3.141-4.335 5.414-8.444 5.53-.138.008-.242.008-.363.008-4.852 0-8.977-2.989-8.977-6.807v-.06c0-5.297 4.795-10.522 5.009-10.744.136-.149.345-.195.525-.105.18.076.297.255.291.451-.043 1.036.167 1.935.631 2.7v.015l.002.001z",
};

export function BrandMark({ platform }: { platform: Platform }) {
  const d = BRAND_PATHS[platform];
  return (
    <span className="brand-mark" data-platform={platform} aria-hidden="true">
      {d ? (
        <svg viewBox="0 0 24 24" fill="currentColor" focusable="false">
          <path d={d} />
        </svg>
      ) : (
        "H"
      )}
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
