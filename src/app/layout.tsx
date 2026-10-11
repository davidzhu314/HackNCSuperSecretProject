import type { Metadata } from "next";
import { Archivo, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Self-hosted by next/font, so no request goes to Google Fonts at runtime.
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });
// Landing page face. The width axis gives the extra-condensed display cuts.
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo" });

export const metadata: Metadata = {
  title: "Personify",
  description:
    "Audience feedback and fact-checked rewrites for LinkedIn and Hinge profiles.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the Hub sets data-hub-theme on <html> before React hydrates.
    <html lang="en" className={`${jakarta.variable} ${archivo.variable} antialiased`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
