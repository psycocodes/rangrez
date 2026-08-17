import { Landing } from "@/components/Landing";
import { landingFonts } from "./landing-fonts";

export const metadata = {
  title: "Rangrez — the stylist everyone needs",
  description:
    "One avatar. Every garment you own, rendered on the same body. Rangrez turns photos of outfits you have already worn into a wardrobe you can actually wear again.",
};

/**
 * The front door — the `v0` frame, ported.
 *
 * This route used to redirect (signed in to the wardrobe, signed out to the
 * sign-in page), so the site had no public face at all. It is now the landing
 * page for everybody, including people who already have a session: it is a
 * poster, and a poster you are bounced past is not a poster. "Start styling"
 * is the way in, and the sign-in route forwards an existing session straight
 * through.
 *
 * There is a second landing component in the tree — `components/LandingPage.tsx`,
 * which arrived on v0 in parallel with this one and is not wired to any route.
 * This is the Figma port, and it is the one mounted here.
 */
export default function HomePage() {
  return (
    <div className={landingFonts}>
      <Landing />
    </div>
  );
}
