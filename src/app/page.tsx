import { ArrowRight, Eye, Heart, ShieldCheck, Sparkles } from "lucide-react";
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
          <Button variant="glass" nativeButton={false} render={<Link href="/studio" />}>
            Profile studio <ArrowRight />
          </Button>
        </nav>
      </header>
      <main>
        <section className="home-hero">
          <div className="home-eyebrow">
            <Sparkles size={15} />
            One identity. Every platform.
          </div>
          <div className="home-title">
            <h1>Personify</h1>
          </div>
          <h2>You, in your best light.</h2>
          <p>
            Your next opportunity. Your next real connection.
            <br />A first impression that still feels like you.
          </p>
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
            <span className="eyebrow">Different worlds. Same you.</span>
            <h2>Find the words that fit.</h2>
            <p>Improve expression, not invent identity.</p>
          </div>
          <div className="home-platforms">
            <div className="home-platform">
              <span className="home-platform-icon" data-platform="linkedin">
                <BrandMark platform="linkedin" />
              </span>
              <div>
                <h3>LinkedIn</h3>
                <p>Your experience, your ambitions, your next chapter. See your profile through a professional lens.</p>
              </div>
            </div>
            <div className="home-platform">
              <span className="home-platform-icon" data-platform="hinge">
                <BrandMark platform="hinge" />
              </span>
              <div>
                <h3>Hinge</h3>
                <p>Your quirks, your favorite Sundays, your kind of connection. Give someone a little more of the real you.</p>
              </div>
            </div>
          </div>
          <div className="home-process">
            <div>
              <Sparkles />
              <h3>Start with your story</h3>
              <p>Bring your profile and the facts you choose to share.</p>
            </div>
            <div>
              <Eye />
              <h3>See another perspective</h3>
              <p>Explore simulated AI feedback through different audience lenses.</p>
            </div>
            <div>
              <ShieldCheck />
              <h3>Keep it grounded</h3>
              <p>Rewrites use only facts you confirm, and FactCheck flags unsupported claims before you share.</p>
            </div>
          </div>
        </section>
      </main>
      <WorldFooter>
        Authentically you. <Heart size={10} />
      </WorldFooter>
    </div>
  );
}
