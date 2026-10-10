import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PERSONA — One identity. Every platform.",
  description:
    "Thoughtful, AI-assisted profile feedback for LinkedIn and Hinge. Improve the expression, keep the identity yours.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
