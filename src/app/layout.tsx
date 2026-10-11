import type { Metadata } from "next";
import { HUB_THEME_SCRIPT } from "@/lib/hub-theme";
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
      <head>
        {/* Applies the Hub's stored light/dark choice before paint. Here, not in the Hub page: the root
            layout renders once on the server, while a page reached by client navigation renders its
            <script> in React, where it never runs (and React warns). */}
        <script dangerouslySetInnerHTML={{ __html: HUB_THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
