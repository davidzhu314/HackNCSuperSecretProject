import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personify",
  description:
    "Audience feedback and fact-checked rewrites for LinkedIn and Hinge profiles.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the Hub's theme toggle sets data-hub-theme on <html> in the browser.
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
