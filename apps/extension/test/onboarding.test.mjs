import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * First run, and whose face to show.
 *
 * Both of these are pure decisions over a User, which is the whole reason they
 * were pulled out of the components: the profile page and the navbar each had
 * their own copy of the photo rule and each had the same bug, and the landing
 * redirect was written out four times as `user.avatar ? … : …`.
 */

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "../../web");

const { profilePhoto, googlePhotoFromMetadata, hasGooglePhoto } = await import(
  resolve(web, "lib/profile-photo.ts")
);
const { steps, isReady, nextStep, landingFor } = await import(resolve(web, "lib/onboarding.ts"));

const GOOGLE = "https://lh3.googleusercontent.com/a/ACg8oc";

/* ── the picture ──────────────────────────────────────────────────────── */

test("the Google picture is preferred, and it is a real one", () => {
  const url = profilePhoto({ name: "Krish", useGooglePhoto: true, googlePhotoUrl: GOOGLE });
  assert.equal(url, GOOGLE);
  // The bug this replaces: a DiceBear drawing seeded from the name, returned
  // under the name "googleAvatarUrl".
  assert.ok(!url.includes("dicebear"), "must not fall through to the drawing");
});

test("turning Google off uses the photo they uploaded", () => {
  assert.equal(
    profilePhoto({
      name: "Krish",
      useGooglePhoto: false,
      googlePhotoUrl: GOOGLE,
      profilePhotoUrl: "/uploads/me.png",
    }),
    "/uploads/me.png",
  );
});

test("an account with no Google picture still gets a face", () => {
  // Email-and-password sign-up. Asking for Google is not an error, there is
  // simply nothing to honour — an uploaded photo beats a drawing.
  assert.equal(
    profilePhoto({ name: "Krish", useGooglePhoto: true, profilePhotoUrl: "/uploads/me.png" }),
    "/uploads/me.png",
  );
  const drawn = profilePhoto({ name: "Krish", useGooglePhoto: true });
  assert.ok(drawn.includes("dicebear"), "last resort is the generated drawing");
  assert.ok(drawn.includes("Krish"), "and it is seeded from the name, so it is stable");
});

test("the toggle knows whether there is anything to toggle to", () => {
  assert.equal(hasGooglePhoto({ googlePhotoUrl: GOOGLE }), true);
  assert.equal(hasGooglePhoto({}), false);
});

test("only an https URL is taken off provider metadata", () => {
  assert.equal(googlePhotoFromMetadata({ avatar_url: GOOGLE }), GOOGLE);
  assert.equal(googlePhotoFromMetadata({ picture: GOOGLE }), GOOGLE, "OIDC calls it `picture`");
  assert.equal(googlePhotoFromMetadata({ avatar_url: GOOGLE, picture: "x" }), GOOGLE);

  // This lands in an <img src> and the metadata is the provider's, not ours.
  for (const bad of [
    { avatar_url: "javascript:alert(1)" },
    { avatar_url: "http://insecure.example/a.png" },
    { avatar_url: "data:image/png;base64,AAA" },
    { avatar_url: 42 },
    { avatar_url: null },
  ]) {
    assert.equal(googlePhotoFromMetadata(bad), undefined, JSON.stringify(bad));
  }
  assert.equal(googlePhotoFromMetadata(undefined), undefined);
  assert.equal(googlePhotoFromMetadata(null), undefined);
});

/* ── first run ────────────────────────────────────────────────────────── */

const account = (over = {}) => ({
  name: "Krish",
  avatars: [],
  measurements: { unit: "cm" },
  ...over,
});

/* The real field names, and they matter: only chest, waist and hip are `core`
   in MEASUREMENT_FIELDS, so coverage is scored out of those three alone. */
const FULL = { unit: "cm", chestCm: 98, waistCm: 84, hipCm: 96, heightCm: 178 };

test("a fresh account is not ready, and is sent to the flow", () => {
  const u = account();
  assert.equal(isReady(u), false);
  assert.equal(landingFor(u), "/welcome");
  assert.equal(nextStep(u).id, "measurements", "identity is satisfied by having a name");
});

test("an account with measurements and a body is ready", () => {
  const u = account({ measurements: FULL, avatars: [{ id: "a" }] });
  assert.equal(isReady(u), true);
  assert.equal(nextStep(u), null);
  assert.equal(landingFor(u), "/wardrobe");
});

test("the optional step never blocks the app", () => {
  // No display name, but everything the app actually needs is present.
  const u = account({ name: "You", measurements: FULL, avatars: [{ id: "a" }] });
  const identity = steps(u).find((s) => s.id === "identity");
  assert.equal(identity.done, false, "still outstanding");
  assert.equal(identity.required, false, "but not required");
  assert.equal(isReady(u), true, "so the account is usable");
});

test("done-ness is read off the account, so it can regress", () => {
  // The reason this is derived rather than a stored flag: deleting your only
  // avatar has to put the body step back, or try-on silently stops working
  // while the account still claims to be set up.
  const before = account({ measurements: FULL, avatars: [{ id: "a" }] });
  assert.equal(isReady(before), true);

  const after = { ...before, avatars: [] };
  assert.equal(isReady(after), false);
  assert.equal(nextStep(after).id, "body");
  assert.equal(landingFor(after), "/welcome");
});

test("half-filled measurements do not count as done", () => {
  // Height is not a core field, so a form with only this in it has covered
  // nothing a size call could use.
  const u = account({ measurements: { unit: "cm", heightCm: 178 }, avatars: [{ id: "a" }] });
  assert.equal(isReady(u), false);
  assert.equal(nextStep(u).id, "measurements");
});
