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
  title: "AetherDoc | Document Intelligence & LLM Failover Engine",
  description: "Enterprise-grade document ingestion, OCR parsing, semantic consolidation, and multi-model failover extraction.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full dark">
      <body className="h-full bg-slate-950 text-slate-100 font-sans antialiased overflow-hidden selection:bg-teal-500/30 selection:text-teal-200">
        {children}
      </body>
    </html>
  );
}
