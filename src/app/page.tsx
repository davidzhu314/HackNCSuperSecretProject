import { ArrowDown, ArrowUpRight, Eye, Fingerprint, ShieldCheck, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { BrandMark, SCENES, Wordmark } from "@/components/Chrome";
import { Button } from "@/components/ui/button";

// Home: the Lovable "destinations" (LinkedIn city, Hinge town), each opening the studio on
// that platform, then how it works and the Identity Hub.

export default function HomePage() {
  return (
    <div className="destination-home">
      <header className="tour-header tour-header-home">
        <span className="tour-header-note">ONE IDENTITY. EVERY PLATFORM.</span>
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
        <h1 className="sr-only">Personify: feedback and fact-checked rewrites for LinkedIn and Hinge</h1>
        <div className="destination-split" aria-label="Choose a platform">
          {(["linkedin", "hinge"] as const).map((id, index) => {
            const scene = SCENES[id];
            return (
              <section className="destination" data-destination={id} key={id} aria-labelledby={`dest-${id}`}>
                <Image
                  src={scene.image}
                  alt=""
                  fill
                  preload
                  placeholder="blur"
                  sizes="(max-width: 760px) 100vw, 50vw"
                  className="destination-photo"
                />
                <div className="destination-shade" />
                <div className="destination-content">
                  <span className="destination-index">
                    0{index + 1} <span aria-hidden="true" /> {scene.lens}
                  </span>
                  <span className="destination-platform">
                    <span className="destination-mark">
                      <BrandMark platform={id} />
                    </span>
                    THROUGH THEIR EYES
                  </span>
                  <h2 id={`dest-${id}`}>{scene.name}</h2>
                  <p className="destination-caption">{scene.caption}</p>
                  <Button variant="tour" nativeButton={false} render={<Link href={`/studio?platform=${id}`} />}>
                    <ArrowUpRight />
                    Open {scene.name}
                  </Button>
                </div>
                <div className="destination-bottom">
                  <p>
                    {id === "linkedin"
                      ? "Your profile by section, or import LinkedIn’s PDF. Feedback from up to 3 of 8 audiences."
                      : "Up to three prompt answers. Edits keep your own words and add nothing new."}
                  </p>
                  <ArrowDown size={16} aria-hidden="true" />
                </div>
              </section>
            );
          })}
        </div>

        <section className="home-band" aria-labelledby="how">
          <div className="home-band-inner">
            <span className="tour-kicker tour-kicker-dark">
              IMPROVE EXPRESSION, NOT INVENT IDENTITY <span className="tour-line" aria-hidden="true" />
            </span>
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
                <span>One set of confirmed facts for every platform. Add your LinkedIn PDF and photo once.</span>
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
