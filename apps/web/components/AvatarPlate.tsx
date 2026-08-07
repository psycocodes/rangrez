import Image from "next/image";
import Link from "next/link";

import { PlateGuides } from "./PlateGuides";
import type { Avatar, AvatarCustomization } from "@/lib/types";

const BACKDROP: Record<Avatar["customization"]["backdrop"], string> = {
  paper: "#D8CFBA",
  vat: "#161D3D",
  madder: "#8E3520",
  studio: "#14120E",
};

const CROP: Record<Avatar["customization"]["crop"], string> = {
  full: "50% 50%",
  "three-quarter": "50% 34%",
  bust: "50% 18%",
};

/**
 * The constant.
 *
 * Every try-on in the product — closet upload, shop extension, swipe combo —
 * composites onto this plate. It is rendered from one component so a garment
 * card and the profile page can never disagree about crop, backdrop or grade.
 */
export function AvatarPlate({
  avatar,
  className = "",
  ratio = "aspect-[3/4]",
  showLabel = true,
  override,
}: {
  avatar: Avatar;
  className?: string;
  ratio?: string;
  showLabel?: boolean;
  /** Unsaved settings, so the profile can preview live before committing. */
  override?: AvatarCustomization;
}) {
  const c = override ?? avatar.customization;
  const warm = c.grade >= 0;

  return (
    <figure className={className}>
      <div
        className={`plate relative w-full overflow-hidden ${ratio}`}
        style={{ backgroundColor: BACKDROP[c.backdrop] }}
      >
        <Image
          src={avatar.renderUrl}
          alt={`${c.label} — base avatar`}
          fill
          sizes="(max-width: 1024px) 100vw, 420px"
          className="object-cover"
          style={{ objectPosition: CROP[c.crop] }}
          priority
        />

        {/* Colour grade, applied as a dye wash rather than an image filter so
            it behaves identically over light and dark backdrops. `overlay`
            rather than `soft-light`: at soft-light the slider barely moved the
            plate, which makes the control feel broken. */}
        {c.grade !== 0 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[1] mix-blend-overlay"
            style={{
              backgroundColor: warm ? "#D99B21" : "#26356E",
              opacity: (Math.abs(c.grade) / 100) * 0.85,
            }}
          />
        )}

        {c.guides && (
          <PlateGuides src={avatar.renderUrl} crop={c.crop} />
        )}

        <span className="spec-sm absolute left-2.5 top-2.5 bg-paper px-1.5 py-1 text-ink">
          BASE
        </span>
      </div>

      {showLabel && (
        <figcaption className="rule mt-2.5 flex items-baseline justify-between pt-2">
          <span className="tight text-[0.9rem]">{c.label}</span>
          <span className="spec-sm text-ink-3">
            {avatar.colorSeason?.name ?? "UNANALYSED"}
          </span>
        </figcaption>
      )}
    </figure>
  );
}

/**
 * Pre-avatar state. This is the most important CTA in the product — nothing
 * downstream works without a body, so it is drawn as a missing plate rather
 * than a button in a card.
 */
export function AvatarMissing({
  className = "",
  ratio = "aspect-[3/4]",
}: {
  className?: string;
  ratio?: string;
}) {
  return (
    <Link
      href="/atelier"
      className={`group block ${className}`}
      aria-label="Create your avatar"
    >
      <div
        className={`plate relative flex w-full flex-col justify-between overflow-hidden bg-vat p-4 text-paper ${ratio}`}
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.16] transition-opacity duration-700 group-hover:opacity-30"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg,#fff 0 1px,transparent 1px 9px)",
          }}
        />
        <span className="spec-sm relative text-paper/55">NO BODY ON FILE</span>

        <div className="relative">
          <p className="display display-md mb-3">
            Create your
            <br />
            <span className="aside">avatar.</span>
          </p>
          <p className="mb-5 max-w-[26ch] text-[0.82rem] leading-relaxed text-paper/60">
            One clean photo. Everything you own gets rendered onto it, in the
            same light, forever after.
          </p>
          <span className="btn btn-invert w-full !py-2.5">
            <span className="spec">Begin</span>
            <span aria-hidden className="spec transition-transform duration-500 group-hover:translate-x-1">
              →
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}
