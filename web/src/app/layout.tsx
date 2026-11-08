import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import { Header } from "@/components/Header";
import { ModeWindows } from "@/components/ModeControls";
import { Toaster } from "@/components/Toaster";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "Verity: the encyclopedia that knows how sure it is",
  description: "Every fact has a market behind it. AI writes each page from the odds. Built on NEAR.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable}`}>
      <body className="min-h-screen">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-white"
        >
          Skip to content
        </a>
        <Header />
        <div id="content" tabIndex={-1} className="outline-none">
          {children}
        </div>
        <footer className="mx-auto mt-24 max-w-6xl border-t border-line px-5 py-10 text-sm text-faint sm:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span>Verity · built at the NEAR Hackathon, 2026</span>
            <span>Demo uses play money. Live uses real USDC on NEAR.</span>
          </div>
        </footer>
        <ModeWindows />
        <Toaster />
      </body>
    </html>
  );
}
