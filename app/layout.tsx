import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Project override in design-system/social-insight-dashboard/MASTER.md:
// Fira Sans has no Thai glyph coverage, so the generated Fira Sans/Fira Code
// pairing is replaced with IBM Plex Sans Thai/Mono (same technical mood,
// one family across Thai and Latin).
const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans-thai",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Social Insight Dashboard",
  description:
    "ข้อมูล insight จาก Facebook Page, Instagram Business และ TikTok รวมในที่เดียว",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={`${ibmPlexSansThai.variable} ${ibmPlexMono.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
