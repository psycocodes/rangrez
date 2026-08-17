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
 * string its keyboard layout produces rather than as रंगरेज़. See `WORDMARK`
 * in components/Wordmark.tsx — that string is not a typo. Use the `<Rangrez/>`
 * component rather than the variable directly; it carries the accessible name.
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

const friday = localFont({
  src: "../public/assets/fonts/FridayNightLights-l5pe.ttf",
  variable: "--font-friday",
  display: "swap",
});

const identity = localFont({
  src: "../public/assets/fonts/IdentityRegular.ttf",
  variable: "--font-identity",
  display: "swap",
});

const iosevka = localFont({
  src: "../public/assets/fonts/Iosevka-Nerd-Font-Complete.ttf",
  variable: "--font-iosevka",
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
      className={`${instrument.variable} ${inter.variable} ${jetbrains.variable} ${kartik.variable} ${friday.variable} ${identity.variable} ${iosevka.variable} h-full`}
    >
      <body className="weave grain min-h-full text-ink">{children}</body>
    </html>
  );
}
