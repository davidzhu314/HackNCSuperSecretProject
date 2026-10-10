import { describe, expect, it } from "vitest";
import { SYNTHETIC_LINKEDIN_LINES } from "./__fixtures__/linkedin-synthetic";
import { cleanText, linesFromTextItems, parseLinkedInLines, type PdfTextItem } from "./linkedin-pdf";
import { rewritableSections, segmentProfile } from "./profile";
import { LinkedInProfileSchema } from "./schemas";

const item = (str: string, x: number, y: number, height: number, hasEOL = false): PdfTextItem => ({
  str,
  hasEOL,
  height,
  transform: [1, 0, 0, 1, x, y],
});

describe("linesFromTextItems", () => {
  it("joins items on one line, splits on end-of-line markers and baseline changes", () => {
    const lines = linesFromTextItems([
      [
        item("July 2026 - Present", 224, 368, 10.5),
        item(" ", 314, 368, 0),
        item("(4 months)", 317, 368, 10.5),
        item("", 224, 353, 0, true),
        item("·", 224, 332, 10.5),
        item(" ", 226, 332, 0),
        item("Built a thing", 244, 332, 10.5),
        item("next line, no EOL marker", 224, 314, 10.5),
      ],
      [item("Page 2", 384, 14, 9, true)],
    ]);
    expect(lines).toEqual([
      { text: "July 2026 - Present (4 months)", size: 10.5, x: 224, y: 368, page: 1 },
      { text: "· Built a thing", size: 10.5, x: 224, y: 332, page: 1 },
      { text: "next line, no EOL marker", size: 10.5, x: 224, y: 314, page: 1 },
      { text: "Page 2", size: 9, x: 384, y: 14, page: 2 },
    ]);
  });
});

describe("cleanText", () => {
  it("fixes glued sentences and &nbsp; without breaking dotted names", () => {
    expect(cleanText("real problems?My work.I’m here&nbsp;now. Next.js and U.S. stay")).toBe(
      "real problems? My work. I’m here now. Next.js and U.S. stay",
    );
  });

  it("drops whole sentences containing contact details and counts them", () => {
    const ctx = { removed: 0 };
    expect(cleanText("Measurable impact.&nbsp;me@example.com", ctx)).toBe("Measurable impact.");
    expect(cleanText("Call (555) 010-0199 anytime. Or not. See www.example.com/x.", ctx)).toBe("Or not.");
    expect(ctx.removed).toBe(3);
  });

  it("keeps numbers that only look a bit like phone numbers", () => {
    expect(cleanText("Worked 2024 - 2026 on 3 rovers, ~12,500 ft, 8+ students.")).toBe(
      "Worked 2024 - 2026 on 3 rovers, ~12,500 ft, 8+ students.",
    );
  });
});

describe("parseLinkedInLines (synthetic export)", () => {
  const { profile, warnings } = parseLinkedInLines(SYNTHETIC_LINKEDIN_LINES);

  it("produces a schema-valid profile", () => {
    expect(LinkedInProfileSchema.safeParse(profile).success).toBe(true);
  });

  it("reads the wrapped headline and drops the name and location", () => {
    expect(profile.headline).toBe("Robotics engineer | Controls and perception for small autonomous vehicles");
    const all = JSON.stringify(profile);
    expect(all).not.toContain("Rowan Example");
    expect(all).not.toContain("Greater Boston");
  });

  it("never keeps contact details anywhere", () => {
    const all = JSON.stringify(profile);
    for (const s of ["@example.com", "linkedin.com", "example.dev", "555", "Reach me"]) expect(all).not.toContain(s);
    expect(warnings).toContain("Removed 1 sentence containing an email, link, or phone number.");
  });

  it("splits About into paragraphs and repairs glued sentences", () => {
    expect(profile.about).toBe(
      "I build controllers for robots that have to work outside the lab. My recent work is on state estimation for rovers on loose terrain.\n\nOutside work I mentor a high school robotics team.",
    );
  });

  it("keeps skills and honors, joining wrapped items, and skips other sidebar sections", () => {
    expect(profile.skills).toEqual(["Robot Operating System (ROS)", "C++", "Finite Element Analysis"]);
    expect(profile.honors).toEqual(["Regional Robotics Challenge Finalist", "Dean's List"]);
    expect(JSON.stringify(profile)).not.toContain("Spanish");
    expect(warnings).toContain('"Languages" isn\'t imported.');
  });

  it("parses an entry with a bullet list that continues across a page break", () => {
    expect(profile.experience[0]).toEqual({
      id: "exp1",
      title: "Controls Engineer",
      organization: "Brightwater Robotics",
      dates: "March 2024 - Present (2 years 8 months)",
      location: "Somerville, Massachusetts, United States",
      description: [
        "- Tuned ~40 PID loops across 3 rover platforms, cutting settling time by 25%.",
        "- Wrote the state estimator (EKF) used on the 2025–2026 field trials.",
        "- Contributed to the team's simulation pipeline in Gazebo and ROS 2.",
      ].join("\n"),
    });
  });

  it("splits several roles at one company into entries and warns", () => {
    expect(profile.experience.slice(1)).toEqual([
      {
        id: "exp2",
        title: "Robotics Engineer II",
        organization: "Kestrel Labs",
        dates: "January 2023 - February 2024 (1 year 2 months)",
        description: "- Led bring-up of 12+ test rigs for the drivetrain group.",
      },
      {
        id: "exp3",
        title: "Robotics Engineer",
        organization: "Kestrel Labs",
        dates: "February 2021 - December 2022 (1 year 11 months)",
        description: "Worked on motor control firmware and test automation for over 200 units.",
      },
    ]);
    expect(warnings.some((w) => w.includes('"Kestrel Labs" seems to list several roles'))).toBe(true);
  });

  it("parses education with wrapped dates and a school with no degree", () => {
    expect(profile.education).toEqual([
      {
        id: "edu1",
        title: "Master of Science - MS, Mechanical Engineering",
        organization: "Example State University",
        dates: "2019 - 2021",
        description: "",
      },
      { id: "edu2", title: "", organization: "Lakeview Community College", dates: "2016 - 2018", description: "" },
    ]);
  });

  it("skips unknown main sections with a warning and returns empty Projects/Volunteering", () => {
    expect(JSON.stringify(profile)).not.toContain("Certified Example Professional");
    expect(warnings).toContain('Skipped the "Licenses & Certifications" section; add anything important by hand.');
    expect(profile.projects).toEqual([]);
    expect(profile.volunteering).toEqual([]);
    expect(warnings.some((w) => w.startsWith("No Projects or Volunteering"))).toBe(true);
  });

  it("feeds straight into sections and segments, with no location in any segment", () => {
    expect(rewritableSections(profile).map((s) => s.key)).toEqual(["headline", "about", "exp1", "exp2", "exp3"]);
    expect(segmentProfile(profile).some((s) => s.text.includes("Somerville"))).toBe(false);
  });
});

describe("parseLinkedInLines (not an export)", () => {
  it("returns an empty profile and one clear warning", () => {
    const r = parseLinkedInLines([{ text: "Just a document", size: 12, x: 72, y: 700, page: 1 }]);
    expect(r.profile.experience).toEqual([]);
    expect(r.warnings).toEqual(['This doesn\'t look like a LinkedIn "Save to PDF" export. Enter your sections by hand instead.']);
  });
});
