import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personify",
  description:
    "Audience feedback and fact-checked rewrites for LinkedIn and Hinge profiles.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the Hub sets data-hub-theme on <html> before React hydrates.
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
