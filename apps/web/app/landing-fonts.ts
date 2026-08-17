import { Geist, Imbue, Instrument_Serif } from "next/font/google";
import localFont from "next/font/local";

/**
 * The landing page's faces, loaded only for the landing page.
 *
 * Seven of them, which is six more than any other route uses. They are kept
 * out of the root layout on purpose: this is the one screen that is a poster
 * rather than an interface, and none of these should be downloaded by someone
 * who signed in and went straight to their wardrobe.
 *
 * Four are already in the repository (public/assets/fonts) because the garment
 * card uses them; three come from Google.
 */

/** The workhorse — every heavy sans heading on the page. */
export const clash = localFont({
  src: "../public/assets/fonts/ClashDisplay-Variable.ttf",
  variable: "--font-clash",
  display: "swap",
});

/** "PINK SHIRT" on the card front. */
export const friday = localFont({
  src: "../public/assets/fonts/FridayNightLights-l5pe.ttf",
  variable: "--font-friday",
  display: "swap",
});

/** The card's "SHIRTS" category line. */
export const iosevka = localFont({
  src: "../public/assets/fonts/Iosevka-Nerd-Font-Complete.ttf",
  variable: "--font-iosevka",
  display: "swap",
});

/** The wordmark, and "THE TEAM". Italic for the first, roman for the second. */
export const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

/** "Avatar 01" under the model plate. */
export const imbue = Imbue({
  variable: "--font-imbue",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

/** "rangrez wasnt built in a day". */
export const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const landingFonts = [clash, friday, iosevka, instrument, imbue, geist]
  .map((f) => f.variable)
  .join(" ");
