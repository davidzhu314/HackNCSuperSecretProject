"use client";

import { ArrowRight, FileText, FolderUp, LockKeyhole, Plus, Sparkles, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { HINGE_PROMPTS, MAX_HINGE_ANSWER, type HingePair } from "@/lib/persona-ui";
import { PLATFORM_CONFIGS } from "@/lib/rubrics";
import { LIMITS, type Platform } from "@/lib/schemas";

/** Text platforms. Headline platforms use headline + about; bio platforms use about as the bio. */
export type TextProfile = { headline: string; about: string; jobDescription: string };

const MAX_HEADLINE = 300;

export function ProfileInput(props: {
  platform: Platform;
  text: TextProfile;
  hinge: HingePair[];
  demo: boolean;
  canContinue: boolean;
  onTextChange: (input: TextProfile) => void;
  onHingeChange: (pairs: HingePair[]) => void;
  onLoadDemo: () => void;
  onContinue: () => void;
  onError: (message: string) => void;
}) {
  const { platform, text, hinge, demo, canContinue, onTextChange, onHingeChange, onLoadDemo, onContinue, onError } = props;
  const config = PLATFORM_CONFIGS[platform];
  const [mode, setMode] = useState<"text" | "file">("text");
  const [filename, setFilename] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Read locally in the browser. Nothing is uploaded anywhere until the user consents later.
  async function loadFile(file?: File) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024 || !/\.(txt|md|json)$/i.test(file.name)) {
      onError("Choose a TXT, MD, or JSON file under 20 MB.");
      return;
    }
    try {
      let raw = await file.text();
      let headline = "";
      let about = "";
      if (/\.json$/i.test(file.name)) {
        const data: unknown = JSON.parse(raw);
        if (typeof data === "string") raw = data;
        else if (data && typeof data === "object") {
          if ("headline" in data && typeof data.headline === "string") headline = data.headline;
          if ("about" in data && typeof data.about === "string") about = data.about;
          else if ("text" in data && typeof data.text === "string") raw = data.text;
          else throw new Error("format");
        } else throw new Error("format");
      }
      if (!about) {
        const lines = raw.trim().split("\n");
        headline = lines.shift() ?? "";
        about = lines.join("\n").trim();
        if (!about) {
          about = headline;
          headline = "";
        }
      }
      if (headline.length > MAX_HEADLINE || headline.length + about.length > LIMITS.profileText || !about.trim()) {
        onError("Add nonempty About text and keep your profile under 4,000 characters (headline under 300).");
        return;
      }
      onTextChange({ ...text, headline, about });
      setFilename(file.name);
      setMode("text");
      onError("");
    } catch {
      onError("We couldn’t read this file. JSON needs headline/about or a text field. Try pasting your profile instead.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const setPair = (index: number, patch: Partial<HingePair>) =>
    onHingeChange(hinge.map((pair, i) => (i === index ? { ...pair, ...patch } : pair)));

  const showUpload = config.input === "headline_about";
  const bioLength = [...text.about].length;
  const bioOver = config.maxChars !== undefined && bioLength > config.maxChars;

  return (
    <section className="flow-section fade-in">
      <div className="workspace-grid">
        <div className="profile-panel">
          <div className="panel-header">
            <h2 className="section-heading">
              <FileText />
              Your {config.label} profile
            </h2>
            {showUpload && (
              <div className="input-mode">
                <Button variant="mode" data-active={mode === "file"} onClick={() => setMode("file")}>
                  <Upload />
                  Upload
                </Button>
                <Button variant="mode" data-active={mode === "text"} onClick={() => setMode("text")}>
                  <FileText />
                  Paste text
                </Button>
              </div>
            )}
          </div>
          <div className="profile-content">
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              accept=".txt,.md,.json"
              aria-label="Upload profile file"
              onChange={(event) => void loadFile(event.target.files?.[0])}
            />
            {showUpload && mode === "file" ? (
              <div
                className="upload-zone"
                data-dragging={dragging}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  void loadFile(event.dataTransfer.files[0]);
                }}
              >
                <span className="upload-icon">
                  <FolderUp />
                </span>
                <p className="upload-title">Drop your profile here</p>
                <p className="upload-caption">TXT, MD, or JSON · up to 20 MB</p>
                <Button variant="glass" onClick={() => fileInput.current?.click()}>
                  <Plus />
                  Browse files
                </Button>
              </div>
            ) : config.input === "prompts" ? (
              <div className="hinge-prompts">
                {hinge.map((pair, index) => (
                  <div className="hinge-prompt" key={index}>
                    <label className="field-label" htmlFor={`prompt-${index}`}>
                      Prompt {index + 1}
                    </label>
                    <select
                      id={`prompt-${index}`}
                      className="audience-select"
                      value={pair.prompt}
                      onChange={(event) => setPair(index, { prompt: event.target.value })}
                    >
                      {HINGE_PROMPTS.map((prompt) => (
                        <option key={prompt}>{prompt}</option>
                      ))}
                    </select>
                    <textarea
                      aria-label={`Answer ${index + 1}`}
                      className="profile-textarea hinge-answer"
                      maxLength={MAX_HINGE_ANSWER}
                      value={pair.answer}
                      placeholder="A little detail that feels like you…"
                      onChange={(event) => setPair(index, { answer: event.target.value })}
                    />
                    <span className="empty-note">
                      {pair.answer.length} / {MAX_HINGE_ANSWER}
                    </span>
                  </div>
                ))}
              </div>
            ) : config.input === "bio" ? (
              <>
                <label className="field-label" htmlFor="bio">
                  {config.fieldLabel}
                </label>
                <textarea
                  id="bio"
                  className="profile-textarea"
                  maxLength={LIMITS.profileText}
                  value={text.about}
                  placeholder={`Paste your ${config.label} ${config.fieldLabel.toLowerCase()}…`}
                  onChange={(event) => onTextChange({ ...text, about: event.target.value })}
                />
              </>
            ) : (
              <>
                <label className="field-label" htmlFor="headline">
                  Headline
                </label>
                <input
                  id="headline"
                  className="goal-input"
                  value={text.headline}
                  maxLength={MAX_HEADLINE}
                  placeholder="Your field, your focus, your next chapter…"
                  onChange={(event) => onTextChange({ ...text, headline: event.target.value })}
                />
                <label className="field-label mt-4" htmlFor="about">
                  About
                </label>
                <textarea
                  id="about"
                  className="profile-textarea"
                  maxLength={LIMITS.profileText}
                  value={text.about}
                  placeholder="Paste your About section…"
                  onChange={(event) => onTextChange({ ...text, about: event.target.value })}
                />
              </>
            )}
            <div className="input-meta">
              <span>
                <LockKeyhole size={11} />
                {filename || "Only here, only for this session."}
              </span>
              {config.input === "headline_about" && (
                <span>
                  {text.headline.length + text.about.length} / 4,000
                </span>
              )}
              {config.input === "bio" && config.maxChars && (
                <span className="bio-count" data-over={bioOver}>
                  {bioOver ? `Over ${config.label}'s limit · ` : ""}
                  {bioLength} / {config.maxChars}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="perspective-panel">
          <h2 className="section-heading">
            <Sparkles />
            Start with the real you
          </h2>
          <p className="section-subtitle">Improve expression, not invent identity.</p>
          <Button
            variant="glass"
            onClick={() => {
              onLoadDemo();
              setMode("text");
              setFilename("");
            }}
          >
            <Sparkles />
            Load demo persona
          </Button>
          {demo && <p className="demo-note">Fictitious demo persona</p>}
          {config.jobDescription && (
            <details className="job-details">
              <summary>Target a specific job</summary>
              <label className="field-label mt-4" htmlFor="job">
                Job description <span className="optional">(optional)</span>
              </label>
              <textarea
                id="job"
                className="profile-textarea job-textarea"
                maxLength={LIMITS.jobDescription}
                value={text.jobDescription}
                onChange={(event) => onTextChange({ ...text, jobDescription: event.target.value })}
                placeholder="Paste the role you have in mind…"
              />
            </details>
          )}
          {config.category === "dating" && (
            <p className="flow-description">A good conversation starts with something genuinely yours.</p>
          )}
          {config.category === "social" && (
            <p className="flow-description">A bio is a first glance. Make it one that is genuinely yours.</p>
          )}
        </div>
      </div>
      <div className="action-band">
        <span className="empty-note">Your identity comes first. Your audience comes next.</span>
        <Button variant="aero" disabled={!canContinue} onClick={onContinue}>
          Continue <ArrowRight />
        </Button>
      </div>
    </section>
  );
}
