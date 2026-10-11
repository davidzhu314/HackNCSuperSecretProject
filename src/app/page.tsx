import { ArrowUpRight, Eye, Fingerprint, ShieldCheck, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { BrandMark, SCENES, Wordmark } from "@/components/Chrome";
import { Button } from "@/components/ui/button";
import { PLATFORM_GROUPS } from "@/lib/rubrics";
import type { PlatformGroup } from "@/lib/schemas";

// Home: the Lovable "destinations", one per platform group (professional speaker, social nightlife,
// dating couple), each listing its platforms and opening the studio on the one picked, then how
// it works and the Identity Hub.

const GROUP_CAPTION: Record<PlatformGroup, string> = {
  professional: "A world of opportunity.",
  social: "A first glance that’s yours.",
  dating: "Somewhere you belong.",
};

export default function HomePage() {
  return (
    <div className="destination-home">
      <header className="tour-header tour-header-home">
        <span aria-hidden="true" />
        <Wordmark className="tour-wordmark" />
        <nav className="tour-header-actions" aria-label="Main navigation">
          <Link href="/hub" className="tour-link">
            Identity Hub
          </Link>
          <Button variant="tour" nativeButton={false} render={<Link href="/studio?platform=linkedin" />}>
            Get started <ArrowUpRight />
          </Button>
        </nav>
      </header>

      <main>
        <h1 className="sr-only">Personify: feedback and fact-checked rewrites for six platforms</h1>
        <div className="destination-split" aria-label="Choose a platform">
          {PLATFORM_GROUPS.map(({ group, label, platforms }) => {
            const scene = SCENES[platforms[0]];
            return (
              <section className="destination" data-destination={group} key={group} aria-labelledby={`dest-${group}`}>
                <Image
                  src={scene.image}
                  alt=""
                  fill
                  preload
                  placeholder="blur"
                  sizes="(max-width: 760px) 100vw, 34vw"
                  className="destination-photo"
                />
                <div className="destination-shade" />
                <div className="destination-content">
                  <h2 id={`dest-${group}`}>{label}</h2>
                  <p className="destination-caption">{GROUP_CAPTION[group]}</p>
                  <ul className="destination-platforms">
                    {platforms.map((id) => (
                      <li key={id}>
                        <Button
                          variant="tour"
                          nativeButton={false}
                          render={<Link href={`/studio?platform=${id}`} />}
                          data-brand={id}
                        >
                          <span className="destination-mark">
                            <BrandMark platform={id} />
                          </span>
                          {SCENES[id].name}
                          <ArrowUpRight />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            );
          })}
        </div>

        <section className="home-band" aria-labelledby="how">
          <div className="home-band-inner">
            <h2 id="how">How it works</h2>
            <div className="home-process">
              <div>
                <Sparkles />
                <h3>1. Add your profile</h3>
                <p>Then tick the facts about you that are true. Only those can appear in a rewrite.</p>
              </div>
              <div>
                <Eye />
                <h3>2. See it through their eyes</h3>
                <p>Pick up to 3 audiences. Each reaction points to the sentence it’s about.</p>
              </div>
              <div>
                <ShieldCheck />
                <h3>3. Rewrite and check</h3>
                <p>FactCheck flags numbers, names, and verbs it can’t trace back to you. Every sentence shows its source.</p>
              </div>
            </div>
            <Link href="/hub" className="home-hub-card">
              <Fingerprint aria-hidden="true" />
              <span>
                <strong>Identity Hub</strong>
                <span>Write once, show up everywhere: confirm your facts once, choose where each one is used, and every platform’s rewrite is checked against them.</span>
              </span>
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="destination-footer">
        <span>personify · Improve expression, not invent identity.</span>
        <span className="tour-privacy">
          <ShieldCheck size={13} />
          Nothing goes to the AI until you agree · nothing is stored
        </span>
      </footer>
    </div>
  );
}
