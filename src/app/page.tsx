import { ArrowRight, Eye, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { Backdrop, BrandMark, WorldFooter, Wordmark } from "@/components/Chrome";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="app-root home-root" data-theme="linkedin">
      <Backdrop />
      <header className="site-header">
        <Wordmark />
        <nav className="header-nav" aria-label="Main navigation">
          <Link href="/hub" className="studio-link">
            Identity Hub
          </Link>
          <Button variant="glass" nativeButton={false} render={<Link href="/studio" />}>
            Profile studio <ArrowRight />
          </Button>
        </nav>
      </header>
      <main>
        <section className="home-hero">
          <div className="home-title">
            <h1>Personify</h1>
          </div>
          <h2>Feedback and rewrites for your LinkedIn and Hinge profiles.</h2>
          <p>Rewrites use only facts you confirm. FactCheck flags anything they can’t trace back to you.</p>
          <Button variant="aero" size="lg" className="home-start" nativeButton={false} render={<Link href="/studio" />}>
            Get started <ArrowRight />
          </Button>
          <span className="home-sample">
            <ShieldCheck size={14} />
            Nothing goes to the AI until you agree · nothing is stored
          </span>
        </section>
        <section className="home-overview studio-shell">
          <div className="home-section-heading">
            <h2>How it works</h2>
          </div>
          <div className="home-platforms">
            <div className="home-platform">
              <span className="home-platform-icon" data-platform="linkedin">
                <BrandMark platform="linkedin" />
              </span>
              <div>
                <h3>LinkedIn</h3>
                <p>Headline and About. Feedback from recruiter, founder, and research-lead viewpoints.</p>
              </div>
            </div>
            <div className="home-platform">
              <span className="home-platform-icon" data-platform="hinge">
                <BrandMark platform="hinge" />
              </span>
              <div>
                <h3>Hinge</h3>
                <p>Up to three prompt answers. Edits keep your own words and add nothing new.</p>
              </div>
            </div>
          </div>
          <div className="home-process">
            <div>
              <Sparkles />
              <h3>1. Paste your profile</h3>
              <p>Then tick the facts about you that are true.</p>
            </div>
            <div>
              <Eye />
              <h3>2. Get feedback</h3>
              <p>Pick up to 3 audiences. Each comment points to the sentence it’s about.</p>
            </div>
            <div>
              <ShieldCheck />
              <h3>3. Rewrite and check</h3>
              <p>Rewrites use only confirmed facts. FactCheck flags numbers, names, and verbs it can’t trace.</p>
            </div>
          </div>
        </section>
      </main>
      <WorldFooter />
    </div>
  );
}
