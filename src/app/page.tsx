"use client";

import { useState } from "react";
import { ArrowDown, ArrowRight, Check, ChevronDown, Clipboard, Command, Sparkles } from "lucide-react";

type Platform = "LinkedIn" | "Hinge";

const profiles: Record<Platform, { original: string; rewrite: string; title: string; prompt?: string }> = {
  LinkedIn: {
    title: "Product designer · making complex things feel simple",
    original: "I’m a product designer who enjoys solving problems and working with great teams. I care about thoughtful details and making useful products.",
    rewrite: "Product designer focused on making complex tools feel clear and useful. I enjoy bringing thoughtful details to collaborative teams and turning real user needs into simple product experiences.",
  },
  Hinge: {
    title: "A life goal of mine",
    prompt: "A life goal of mine",
    original: "To travel more, try new food, and spend more time outside.",
    rewrite: "Find the best little food spot in every new place—and take the scenic route getting there.",
  },
};

export default function Home() {
  const [platform, setPlatform] = useState<Platform>("LinkedIn");
  const [profile, setProfile] = useState("");
  const [consent, setConsent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSample, setShowSample] = useState(false);
  const sample = profiles[platform];

  async function copyRewrite() {
    await navigator.clipboard.writeText(sample.rewrite);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function loadDemo() {
    setProfile(sample.original);
    setShowSample(true);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Persona home"><span className="brand-mark"><Sparkles size={16} /></span>persona<span className="brand-period">.</span></a>
        <nav className="topnav" aria-label="Main navigation"><a href="#how-it-works">How it works</a><a href="#workspace">Workspace</a><span className="local-pill"><i /> Private workspace</span></nav>
        <button className="avatar" aria-label="Account menu">J</button>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow"><span className="eyebrow-line" /> YOUR VOICE, EVERYWHERE</div>
        <h1>Show up as <em>you.</em><br />Just a little clearer.</h1>
        <p className="hero-copy">A thoughtful second opinion for your online profiles.<br className="desktop-break" /> Sharpen the story. Keep what makes it yours.</p>
        <a className="scroll-link" href="#workspace"><span className="scroll-icon"><ArrowDown size={14} /></span> GET STARTED</a>
        <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
      </section>

      <section className="workspace" id="workspace">
        <div className="workspace-heading"><div><div className="section-kicker">PROFILE STUDIO <span>01 — 02</span></div><h2>Let’s work on your profile</h2></div><div className="step-indicator"><b>01</b><span /><span className="muted-step">02</span></div></div>

        <div className="studio-grid">
          <section className="panel editor-panel">
            <div className="panel-top"><div><div className="panel-label"><span className="number-badge">01</span> YOUR STARTING POINT</div><h3>Where are we polishing?</h3></div><span className="required-label">REQUIRED</span></div>
            <label className="field-label" htmlFor="platform">CHOOSE A PLATFORM</label>
            <div className="select-wrap"><select id="platform" value={platform} onChange={(event) => { setPlatform(event.target.value as Platform); setShowSample(false); }}><option>LinkedIn</option><option>Hinge</option></select><ChevronDown size={16} aria-hidden="true" /></div>
            <div className="input-label-row"><label className="field-label" htmlFor="profile">PASTE YOUR PROFILE</label><span>{platform === "LinkedIn" ? "Headline or About section" : "One prompt and your answer"}</span></div>
            {platform === "Hinge" && <input className="prompt-input" aria-label="Hinge prompt" value={sample.prompt} readOnly />}
            <textarea id="profile" value={profile} onChange={(event) => { setProfile(event.target.value); setShowSample(false); }} placeholder={platform === "LinkedIn" ? "Paste your headline, About section, or both…" : "Write your answer to this prompt…"} />
            <div className="textarea-footer"><span>{profile.length} characters</span><button className="text-button" onClick={loadDemo}>Load a sample profile <ArrowRight size={13} /></button></div>
            <div className="consent-box"><input type="checkbox" id="consent" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><label htmlFor="consent"><strong>Okay to get AI feedback</strong><span>Your profile text will be sent to our AI provider for analysis. It won’t be saved. You can try the sample without sending anything.</span></label></div>
            <button className="primary-button" onClick={() => setShowSample(true)} disabled={!profile.trim() || !consent}><Sparkles size={16} /> Review my profile <ArrowRight size={15} /></button>
            <p className="button-note">Your profile stays yours. Nothing is posted automatically.</p>
          </section>

          <section className="panel preview-panel">
            <div className="panel-top"><div><div className="panel-label"><span className="number-badge number-badge-light">02</span> A FIRST LOOK</div><h3>A clearer version of you.</h3></div><span className="sparkle-small"><Sparkles size={17} /></span></div>
            <p className="preview-intro">Small, thoughtful edits can make it easier for the right people to get your story.</p>
            <div className="preview-card">
              <div className="preview-card-top"><span className="preview-platform"><span className="platform-dot">{platform === "LinkedIn" ? "in" : "h"}</span>{platform} <span className="demo-tag">SAMPLE</span></span><span className="sample-caption">EXAMPLE REWRITE</span></div>
              <div className="profile-name">Jordan Lee <span className="sample-avatar">JL</span></div>
              {platform === "Hinge" && <div className="hinge-prompt">{sample.prompt}</div>}
              <p className="rewrite-text">{sample.rewrite}</p>
              <div className="rewrite-divider" />
              <div className="rewrite-note"><span className="note-check"><Check size={12} /></span><span><strong>Grounded in your details</strong><br />A sample rewrite to show how PERSONA works.</span></div>
              <button className="copy-button" onClick={copyRewrite}><Clipboard size={14} />{copied ? "Copied to clipboard" : "Copy sample rewrite"}{copied && <Check size={13} />}</button>
            </div>
            {showSample && <div className="sample-feedback"><Sparkles size={14} /><span><strong>Sample result</strong> · This example is illustrative feedback, not an AI analysis of your profile.</span></div>}
            <div className="privacy-foot"><span className="lock-icon">✳</span> Simulated AI feedback. No predictions, just perspective.</div>
          </section>
        </div>
        <div className="trust-strip"><span><Check size={13} /> Your words stay yours</span><i /><span><Check size={13} /> No auto-posting</span><i /><span><Check size={13} /> You choose what to change</span></div>
      </section>

      <section className="how-section" id="how-it-works"><div className="how-inner"><div><div className="section-kicker">SIMPLE BY DESIGN</div><h2>Thoughtful edits.<br /><em>Still your story.</em></h2></div><div className="how-cards"><article><span>01</span><h3>Bring your words</h3><p>Paste your LinkedIn or Hinge profile. Start with what’s already yours.</p></article><article><span>02</span><h3>Get a fresh perspective</h3><p>See how your profile might come across through simulated audience lenses.</p></article><article><span>03</span><h3>Make it your own</h3><p>Copy a rewrite, tweak it, or leave it as is. You’re always in control.</p></article></div></div></section>
      <footer><a className="brand footer-brand" href="#top">persona<span className="brand-period">.</span></a><span>One identity. Every platform. Authentically you.</span><span className="footer-right"><Command size={12} /> Made for humans, by humans.</span></footer>
    </main>
  );
}
