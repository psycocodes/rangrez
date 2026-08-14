import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Inter_Tight, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";

import "./globals.css";

/* Three voices, deliberately contrasted:
   — Instrument Serif shouts (masthead, pull quotes, the italic asides)
   — Inter Tight speaks (every piece of UI copy)
   — JetBrains Mono annotates (labels, indices, spec lines) */

const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter_Tight({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/**
 * The name in its own script.
 *
 * AMS Kartik is a legacy Devanagari font: it carries no Unicode Devanagari at
 * all, only ~93 glyphs hung on ASCII slots, so the word is typed as the ASCII
 * string its keyboard layout produces rather than as रंगरेज़. See
 * `WORDMARK` in components/Vat.tsx — that string is not a typo.
 */
const kartik = localFont({
  src: "./fonts/AMSKartik-Regular.ttf",
  variable: "--font-kartik",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rangrez — the dyer of cloth",
  description:
    "One avatar. Every garment you own, rendered on the same body. Rangrez turns photos of outfits you have already worn into a wardrobe you can actually wear again.",
};

export const viewport: Viewport = {
  themeColor: "#EDE7DA",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${instrument.variable} ${inter.variable} ${jetbrains.variable} ${kartik.variable} h-full`}
    >
      <body className="weave grain min-h-full text-ink">{children}</body>
    </html>
  );
}
