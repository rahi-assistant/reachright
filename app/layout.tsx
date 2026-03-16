import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
