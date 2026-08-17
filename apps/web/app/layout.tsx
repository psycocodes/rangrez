import type { Metadata, Viewport } from "next";
import {
  Instrument_Sans,
  Instrument_Serif,
  Inter_Tight,
  JetBrains_Mono,
  Smokum,
} from "next/font/google";
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

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
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

/* ── the garment card's three voices ──────────────────────────────────────
   These three exist only for the card (components/GarmentPlate.tsx) and are
   loaded globally because that card appears on every route.

   Both local faces are drawn far outside their em box, which is the whole
   reason they look the way they do — and the reason a font-size on either
   cannot be read as a cap height:

     Identity      caps 0.98em, but the ink spans 1.65em top to bottom. Its
                   letterforms are filled with fingerprint whorls, so the
                   texture behind the garment is *typeset*, not an image.
     Scholar Block caps 2.13em. At the 67px the design specifies, the letters
                   stand 143px tall and overflow their own line box on
                   purpose. Setting it by eye to "look 143px" would give a
                   672px font-size and break every proportion around it. */

const identity = localFont({
  src: "./fonts/IdentityRegular.ttf",
  variable: "--font-identity",
  display: "swap",
});

const scholar = localFont({
  src: "./fonts/ScholarBlock-Regular.ttf",
  variable: "--font-scholar",
  display: "swap",
});

/** The category line. A wood-type western, per the design. */
const smokum = Smokum({
  variable: "--font-smokum",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const friday = localFont({
  src: "../public/assets/fonts/FridayNightLights-l5pe.ttf",
  variable: "--font-friday",
  display: "swap",
});

const iosevka = localFont({
  src: "../public/assets/fonts/Iosevka-Nerd-Font-Complete.ttf",
  variable: "--font-iosevka",
  display: "swap",
});

const clash = localFont({
  src: "../public/assets/fonts/ClashDisplay-Variable.ttf",
  variable: "--font-clash",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rangrez — the dyer of cloth",
  description:
    "One avatar. Every garment you own, rendered on the same body. Rangrez turns photos of outfits you have already worn into a wardrobe you can actually wear again.",
  icons: {
    icon: [
      { url: "/assets/logos/rangrez-logo.png" },
      { url: "/icon.png" },
    ],
    shortcut: "/assets/logos/rangrez-logo.png",
    apple: "/assets/logos/rangrez-logo.png",
  },
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
      className={`${instrument.variable} ${instrumentSans.variable} ${inter.variable} ${jetbrains.variable} ${kartik.variable} ${identity.variable} ${scholar.variable} ${smokum.variable} ${friday.variable} ${iosevka.variable} ${clash.variable} h-full`}
    >
      <body className="weave grain min-h-full text-ink">{children}</body>
    </html>
  );
}
