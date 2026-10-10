import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Self-hosted by next/font, so no request goes to Google Fonts at runtime.
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: "Personify — One identity. Every platform.",
  description:
    "Simulated audience feedback and fact-checked rewrites for LinkedIn and Hinge profiles. Improve expression, not invent identity.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
