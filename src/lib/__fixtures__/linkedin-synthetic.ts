import type { PdfLine } from "../linkedin-pdf";

// A made-up person's LinkedIn "Save to PDF" export, as extracted lines, following the real
// template's layout (sidebar first, then the main column; font sizes and spacing as in the export).
// Nobody here is real. It also packs in harder cases than a typical export: a wrapped headline,
// glued sentences, contact details inside About, a page break mid-bullet, several roles at one
// company, an entry with no location and a paragraph description, and sections we don't import.

type Row = [page: number, x: number, size: number, gap: number, text: string];

const SIDE = 22;
const MAIN = 224;

const rows: Row[] = [
  // Sidebar (page 1)
  [1, SIDE, 13, 0, "Contact"],
  [1, SIDE, 10.5, 20, "rowan.example@example.com"],
  [1, SIDE, 11, 24, "www.linkedin.com/in/rowan-example"],
  [1, SIDE, 11, 15, "(LinkedIn)"],
  [1, SIDE, 13, 35, "Top Skills"],
  [1, SIDE, 10.5, 19, "Robot Operating System (ROS)"],
  [1, SIDE, 10.5, 18, "C++"],
  [1, SIDE, 10.5, 18, "Finite Element Analysis"],
  [1, SIDE, 13, 34, "Languages"],
  [1, SIDE, 10.5, 20, "Spanish (Native or Bilingual)"],
  [1, SIDE, 13, 34, "Honors-Awards"],
  [1, SIDE, 10.5, 20, "Regional Robotics Challenge"],
  [1, SIDE, 10.5, 13, "Finalist"],
  [1, SIDE, 10.5, 18, "Dean's List"],
  // Main column (page 1)
  [1, MAIN, 26, 0, "Rowan Example"],
  [1, MAIN, 12, 21, "Robotics engineer | Controls and perception for small"],
  [1, MAIN, 12, 15, "autonomous vehicles"],
  [1, MAIN, 12, 15, "Greater Boston"],
  [1, MAIN, 15.8, 38, "Summary"],
  [1, MAIN, 12, 25, "I build controllers for robots that have to work outside the lab.My"],
  [1, MAIN, 12, 18, "recent work is on state estimation for rovers on loose terrain."],
  [1, MAIN, 12, 36, "Outside work I mentor a high school robotics team.&nbsp;Reach me at"],
  [1, MAIN, 12, 18, "rowan.example@example.com or (555) 010-0199, or see example.dev/rowan."],
  [1, MAIN, 15.8, 54, "Experience"],
  [1, MAIN, 12, 31, "Brightwater Robotics"],
  [1, MAIN, 11.5, 16, "Controls Engineer"],
  [1, MAIN, 10.5, 14, "March 2024 - Present (2 years 8 months)"],
  [1, MAIN, 10.5, 15, "Somerville, Massachusetts, United States"],
  [1, MAIN, 10.5, 21, "· Tuned ~40 PID loops across 3 rover platforms, cutting settling time by"],
  [1, MAIN, 10.5, 18, "25%."],
  [1, MAIN, 10.5, 18, "· Wrote the state estimator (EKF) used on the 2025–2026 field trials."],
  [1, MAIN, 9, 300, "Page 1 of 2"],
  // Page 2: the bullet list continues after the page break
  [2, MAIN, 10.5, 0, "· Contributed to the team's simulation pipeline in Gazebo and ROS 2."],
  [2, MAIN, 12, 40, "Kestrel Labs"],
  [2, MAIN, 10.5, 15, "3 years 1 month"],
  [2, MAIN, 11.5, 22, "Robotics Engineer II"],
  [2, MAIN, 10.5, 14, "January 2023 - February 2024 (1 year 2 months)"],
  [2, MAIN, 10.5, 21, "· Led bring-up of 12+ test rigs for the drivetrain group."],
  [2, MAIN, 11.5, 30, "Robotics Engineer"],
  [2, MAIN, 10.5, 14, "February 2021 - December 2022 (1 year 11 months)"],
  [2, MAIN, 10.5, 21, "Worked on motor control firmware and test automation for over 200 units."],
  [2, MAIN, 15.8, 50, "Licenses & Certifications"],
  [2, MAIN, 12, 31, "Certified Example Professional"],
  [2, MAIN, 15.8, 50, "Education"],
  [2, MAIN, 12, 26, "Example State University"],
  [2, MAIN, 10.5, 17, "Master of Science - MS, Mechanical Engineering · (2019 -"],
  [2, MAIN, 10.5, 18, "2021)"],
  [2, MAIN, 12, 34, "Lakeview Community College"],
  [2, MAIN, 10.5, 17, "· (2016 - 2018)"],
  [2, MAIN, 9, 200, "Page 2 of 2"],
];

export const SYNTHETIC_LINKEDIN_LINES: PdfLine[] = (() => {
  // Sidebar and main column each start at the top of the page; y counts down by each row's gap.
  const y = new Map<string, number>();
  return rows.map(([page, x, size, gap, text]) => {
    const key = `${page}|${x}`;
    const next = (y.get(key) ?? 740 + gap) - gap;
    y.set(key, next);
    return { page, x, size, y: next, text };
  });
})();
