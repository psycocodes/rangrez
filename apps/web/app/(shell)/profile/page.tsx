import Link from "next/link";

import {
  clearStarterWardrobe,
  savePreferences,
  setColorSeason,
} from "@/app/actions/profile";
import { AvatarMissing } from "@/components/AvatarPlate";
import { AvatarShelf } from "@/components/AvatarShelf";
import { PaletteStrip } from "@/components/PaletteStrip";
import { requireUser } from "@/lib/auth";
import { listGarments } from "@/lib/db";
import { SEASONS } from "@/lib/palette";
import { MAX_AVATARS } from "@/lib/types";

export const metadata = { title: "Profile — Rangrez" };

export default async function ProfilePage() {
  const user = await requireUser();
  const garments = await listGarments(user.id);
  const seeded = garments.filter((g) => g.origin === "seed").length;
  const season = user.avatar?.colorSeason;

  return (
    <section className="px-4 lg:px-6">
      <div className="flex items-baseline justify-between gap-4 border-b border-ink/15 py-3">
        <span className="spec text-ink-3">03 — Your file</span>
        <span className="spec-sm text-ink-3">{user.email.toUpperCase()}</span>
      </div>

      <header className="grid gap-8 py-10 lg:grid-cols-[1.6fr_1fr] lg:py-14">
        <div>
          <p className="spec mb-6 text-madder">Kept on the shelf</p>
          <h1 className="display display-lg">
            Everything
            <br />
            <span className="aside">about you</span>
            <br />
            we hold.
          </h1>
        </div>
        <p className="max-w-[44ch] self-end text-[0.95rem] leading-relaxed text-ink-2">
          Two things drive the whole product: the plate your clothes are rendered
          onto, and the colour season we rank them against. Both are yours to
          change — the analysis is a starting point, not a verdict.
        </p>
      </header>

      {/* ── 3.1 · the plates ───────────────────────────────────────────── */}
      <Block
        index="3.1"
        title="Your plates"
        aside={`up to ${MAX_AVATARS} bodies, one in use`}
      >
        {user.avatars.length ? (
          <AvatarShelf avatars={user.avatars} activeId={user.activeAvatarId} />
        ) : (
          <div className="grid gap-6 sm:max-w-sm">
            <AvatarMissing />
          </div>
        )}
      </Block>

      {/* ── 3.2 · colour season ────────────────────────────────────────── */}
      <Block index="3.2" title="Your colour season" aside="what flatters, and what drains">
        {season ? (
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-14">
            <div>
              <p className="display display-md mb-5">
                Analysed as a <span className="aside">{season.name}.</span>
              </p>
              <PaletteStrip season={season} />
              <p className="rule mt-6 pt-3 text-[0.8rem] leading-relaxed text-ink-3">
                Ranking happens on our side, not YouCam&apos;s — changing this
                re-scores your whole wardrobe instantly and costs no API credit.
              </p>
            </div>

            <form action={setColorSeason}>
              <p className="spec-sm mb-3 text-ink-3">OVERRIDE</p>
              <div className="grid gap-px bg-ink/15 sm:grid-cols-2">
                {Object.values(SEASONS).map((s) => (
                  <label
                    key={s.name}
                    className="group flex cursor-pointer flex-col gap-2.5 bg-paper p-3.5 transition-colors duration-300 hover:bg-paper-2 has-checked:bg-ink has-checked:text-paper"
                  >
                    <span className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="season"
                        value={s.name}
                        defaultChecked={s.name === season.name}
                        className="h-3.5 w-3.5 accent-madder"
                      />
                      <span className="spec">{s.name}</span>
                    </span>
                    <span className="flex h-4 gap-px">
                      {s.palette.map((d) => (
                        <span
                          key={d.hex}
                          className="flex-1"
                          style={{ backgroundColor: d.hex }}
                        />
                      ))}
                    </span>
                  </label>
                ))}
              </div>
              <button type="submit" className="btn mt-5">
                <span className="spec">Re-rank my wardrobe</span>
                <span aria-hidden className="spec">→</span>
              </button>
            </form>
          </div>
        ) : (
          <p className="max-w-[46ch] text-[0.9rem] leading-relaxed text-ink-3">
            Your colour season comes out of the skin-tone pass in the studio.{" "}
            <Link
              href="/atelier"
              className="text-ink underline decoration-madder underline-offset-4"
            >
              Create your avatar
            </Link>{" "}
            and it will be waiting here.
          </p>
        )}
      </Block>

      {/* ── 3.3 · identity & fit ───────────────────────────────────────── */}
      <Block index="3.3" title="Name & fit" aside="how things should sit on you">
        <form action={savePreferences} className="grid gap-8 lg:grid-cols-2 lg:gap-14">
          <div className="flex flex-col gap-7">
            <label className="block">
              <span className="spec-sm mb-2.5 block text-ink-3">NAME</span>
              <input name="name" defaultValue={user.name} className="field" />
            </label>
            <label className="block">
              <span className="spec-sm mb-2.5 block text-ink-3">HEIGHT · CM</span>
              <input
                name="heightCm"
                type="number"
                min={100}
                max="230"
                defaultValue={user.preferences.heightCm ?? ""}
                placeholder="e.g. 174"
                className="field"
              />
            </label>
          </div>

          <div className="flex flex-col gap-7">
            <fieldset>
              <legend className="spec-sm mb-3 text-ink-3">PREFERRED FIT</legend>
              <div className="flex flex-wrap gap-1.5">
                {(["relaxed", "regular", "tailored"] as const).map((f) => (
                  <label key={f} className="chip has-checked:!bg-ink has-checked:!text-paper">
                    <input
                      type="radio"
                      name="fitPreference"
                      value={f}
                      defaultChecked={user.preferences.fitPreference === f}
                      className="h-3 w-3 self-center accent-madder"
                    />
                    <span className="spec">{f}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="spec-sm mb-3 text-ink-3">
                FIT MODEL · SHOES, BAGS & HATS
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {(["male", "female"] as const).map((g) => (
                  <label key={g} className="chip has-checked:!bg-ink has-checked:!text-paper">
                    <input
                      type="radio"
                      name="vtoGender"
                      value={g}
                      defaultChecked={(user.preferences.vtoGender ?? "male") === g}
                      className="h-3 w-3 self-center accent-madder"
                    />
                    <span className="spec">{g}</span>
                  </label>
                ))}
              </div>
              <p className="mt-2.5 max-w-[42ch] text-[0.78rem] leading-relaxed text-ink-3">
                YouCam&apos;s shoe, bag and hat surfaces require a body model and
                accept only these two. It affects nothing else in Rangrez.
              </p>
            </fieldset>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                name="paletteFirst"
                defaultChecked={user.preferences.paletteFirst}
                className="mt-0.5 h-4 w-4 accent-madder"
              />
              <span>
                <span className="spec block">Palette first</span>
                <span className="mt-1.5 block max-w-[40ch] text-[0.78rem] leading-relaxed text-ink-3">
                  Rank pieces inside your colour season above the rest, in the
                  grid and in Surprise Me.
                </span>
              </span>
            </label>

            <button type="submit" className="btn">
              <span className="spec">Save</span>
              <span aria-hidden className="spec">→</span>
            </button>
          </div>
        </form>
      </Block>

      {/* ── 3.4 · the ledger ───────────────────────────────────────────── */}
      <Block index="3.4" title="The ledger" aside="what is on file">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:gap-14">
          <dl className="grid grid-cols-2 gap-px border border-ink/15 bg-ink/15 sm:grid-cols-3">
            {[
              ["Pieces", String(garments.length).padStart(2, "0")],
              ["Starter", String(seeded).padStart(2, "0")],
              [
                "Member since",
                new Date(user.createdAt).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                }),
              ],
            ].map(([k, v]) => (
              <div key={k} className="bg-paper px-3.5 py-4">
                <dt className="spec-sm mb-2.5 text-ink-3">{k}</dt>
                <dd className="display text-[1.7rem] leading-none">{v}</dd>
              </div>
            ))}
          </dl>

          {seeded > 0 && (
            <form action={clearStarterWardrobe}>
              <p className="mb-4 max-w-[42ch] text-[0.85rem] leading-relaxed text-ink-2">
                Your closet was seeded with {seeded} demo pieces so the grid had
                something to say on day one. Clear them once your own uploads are
                in — this cannot be undone.
              </p>
              <button type="submit" className="btn btn-ghost !border-madder !text-madder">
                <span className="spec">Clear the starter wardrobe</span>
                <span aria-hidden className="spec">×</span>
              </button>
            </form>
          )}
        </div>
      </Block>
    </section>
  );
}

function Block({
  index,
  title,
  aside,
  children,
}: {
  index: string;
  title: string;
  aside: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t-2 border-ink py-8 lg:py-12">
      <div className="mb-8 flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
        <span className="spec text-madder">{index}</span>
        <h2 className="display text-[1.9rem] leading-none">{title}</h2>
        <span className="aside text-[1.05rem] text-ink-3">— {aside}</span>
      </div>
      {children}
    </section>
  );
}
