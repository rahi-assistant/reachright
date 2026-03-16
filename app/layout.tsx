import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const body = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const display = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "ReachRight — AI-Powered Business Growth for Local Businesses",
  description: "We find local businesses with weak online presence and help them reach more customers. AI-powered web audits, website creation, and digital marketing.",
  keywords: ["local business", "website audit", "digital marketing", "Kolkata", "AI", "lead generation"],
  openGraph: {
    title: "ReachRight — Your Business Deserves to Be Found",
    description: "AI-powered growth engine for local businesses. Free web presence audit.",
    url: "https://reachright.app",
    siteName: "ReachRight",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${body.variable} ${mono.variable} ${display.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
