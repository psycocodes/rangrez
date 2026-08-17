/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  The surface: trigger mark + try-on panel
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Everything lives in one shadow root so the shop's CSS cannot reach in and
 *  ours cannot leak out. The one exception is @font-face, which browsers only
 *  honour at document scope — those get injected into the host <head> under
 *  namespaced family names that nothing else could match.
 *
 *  Design rules, carried over from the app: paper and ink, one madder accent,
 *  spec-sheet mono for every label, Instrument Serif for the one line per
 *  state that is allowed to speak. The output is the interface — as few words
 *  as the state can survive on.
 * ═══════════════════════════════════════════════════════════════════════════
 */
globalThis.RZ = globalThis.RZ || {};

(() => {
  const KNOT = `<svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M1 3.5h12M1 7h12M1 10.5h12" stroke="currentColor" stroke-width="1"/>
    <path d="M4.5 1v12M9.5 1v12" stroke="currentColor" stroke-width="1" opacity=".45"/>
    <circle cx="7" cy="7" r="2.1" fill="currentColor"/>
  </svg>`;

  /* ── fonts ────────────────────────────────────────────────────────────── */

  function ensureFonts() {
    if (document.getElementById("rz-fontface")) return;
    const url = (f) => RZ.api.runtime.getURL(`assets/fonts/${f}`);
    const style = document.createElement("style");
    style.id = "rz-fontface";
    style.textContent = `
@font-face{font-family:RangrezMono;font-style:normal;font-weight:500;font-display:swap;src:url("${url("jetbrains-mono-500.woff2")}") format("woff2")}`;
    (document.head || document.documentElement).appendChild(style);
  }

  /* ── styles ───────────────────────────────────────────────────────────── */

  const CSS = `
:host{all:initial;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:host{
  /* Neubrutalist, and deliberately the same token names the old dye-house
     palette used — every rule below already reads through them, so the whole
     panel converts by changing what they mean rather than where they are
     used. These are the app's values (apps/web/app/globals.css). */
  --paper:#F4EFE6; --paper-2:#EBE3D5; --paper-3:#E0D6C4;
  --ink:#12100D; --ink-2:#12100D; --ink-3:#5C574C;
  --madder:#FF5252; --turmeric:#FFDE59; --indigo:#2196F3; --vat:#12100D;
  --brut:4px 4px 0 #12100D; --brut-sm:2px 2px 0 #12100D;
  --cloth:cubic-bezier(.22,1,.36,1);
  color:var(--ink); line-height:1.45;
}
.spec{font-family:RangrezMono,ui-monospace,monospace;font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;font-weight:500;line-height:1}
.spec-sm{font-family:RangrezMono,ui-monospace,monospace;font-size:8.5px;letter-spacing:.24em;text-transform:uppercase;font-weight:500;line-height:1}
/* Inter Tight 800 in the app. A content script is injected into somebody
   else's page, so it takes the heaviest system face rather than shipping
   another font file for one heading. */
.display{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-weight:800;letter-spacing:-.02em;line-height:1;font-size:28px;text-transform:none}
.display em{font-style:italic}
.note{font-size:11.5px;line-height:1.55;color:var(--ink-3);letter-spacing:-.005em}

/* ── trigger ─────────────────────────────────────────────────────────── */
.dock{display:flex;align-items:stretch;filter:drop-shadow(0 10px 24px rgba(20,18,14,.28))}
.dock[hidden]{display:none}
.trigger{
  display:flex;align-items:center;gap:9px;padding:11px 13px;cursor:pointer;
  background:var(--turmeric);border:3px solid var(--ink);border-right:0;
  border-radius:8px 0 0 8px;box-shadow:-4px 4px 0 var(--ink);color:var(--ink);
  position:relative;overflow:hidden;isolation:isolate;font:inherit;
  transition:color .3s var(--cloth);
}
.trigger:hover{background:var(--madder);color:var(--paper)}
.trigger:hover::before{transform:translateY(0)}
.trigger__rule{position:absolute;top:0;left:0;right:0;height:3px;background:var(--ink)}
.trigger svg{width:13px;height:13px;flex:none}
.trigger__arrow{opacity:.5;transition:transform .42s var(--cloth)}
.trigger:hover .trigger__arrow{transform:translateX(3px);opacity:1}
.dock__x{
  width:30px;cursor:pointer;background:var(--paper);border-left:3px solid var(--ink);
  color:var(--ink-3);font:inherit;font-size:14px;line-height:1;
  transition:background .25s var(--cloth),color .25s var(--cloth);
}
.dock__x:hover{background:var(--madder);color:var(--paper)}

/* ── panel ───────────────────────────────────────────────────────────── */
.panel{
  position:relative; /* the grain overlay is absolute against this */
  width:372px;max-width:calc(100vw - 36px);max-height:calc(100vh - 36px);
  display:flex;flex-direction:column;overflow:hidden;
  background:var(--paper);border:3px solid var(--ink);border-radius:8px;
  box-shadow:6px 6px 0 var(--ink);
  animation:rise .5s var(--cloth) both;
}
.panel[hidden]{display:none}
/* The grain overlay belonged to the paper this replaced. Flat colour now. */
@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}

.head{display:flex;align-items:center;gap:8px;padding:10px 11px;border-bottom:3px solid var(--ink);background:var(--turmeric);position:relative}
.head svg{width:13px;height:13px;flex:none}
.head__site{margin-left:auto;color:var(--ink-3)}
.head__x{
  width:20px;height:20px;cursor:pointer;background:transparent;border:0;color:var(--ink-3);
  font:inherit;font-size:15px;line-height:1;transition:color .2s
}
.head__x:hover{color:var(--madder)}

.body{padding:13px;overflow-y:auto;flex:1;position:relative}
.kicker{color:var(--madder);margin-bottom:9px}

/* ── plate: anything that shows a body ──────────────────────────────── */
.plate{position:relative;width:100%;aspect-ratio:3/4;overflow:hidden;background:var(--vat)}
.plate img{width:100%;height:100%;object-fit:cover;display:block;transition:opacity .6s var(--cloth),filter .6s var(--cloth)}
.plate--busy img{opacity:.4;filter:saturate(.15)}
.plate::after,.plate::before{content:"";position:absolute;width:11px;height:11px;border:1px solid rgba(237,231,218,.55);pointer-events:none;z-index:3}
.plate::before{top:0;left:0;border-right:0;border-bottom:0}
.plate::after{bottom:0;right:0;border-left:0;border-top:0}
.plate__tag{position:absolute;top:0;left:0;background:var(--paper);color:var(--ink);padding:5px 7px;z-index:3}
.scan{position:absolute;left:0;right:0;top:0;height:1px;background:var(--turmeric);z-index:4;animation:scan 2.1s cubic-bezier(.65,0,.35,1) infinite;box-shadow:0 0 12px 2px rgba(217,155,33,.5)}
@keyframes scan{0%{transform:translateY(0);opacity:0}12%{opacity:1}88%{opacity:1}100%{transform:translateY(var(--h,420px));opacity:0}}

/* ── candidate strip: the isolation pass, made visible ──────────────── */
.strip{display:flex;gap:4px;margin-bottom:12px}
.cand{flex:1;min-width:0;position:relative;animation:rise .45s var(--cloth) both}
.cand__shot{position:relative;aspect-ratio:3/4;overflow:hidden;background:var(--paper-3);border:1px solid transparent}
.cand__shot img{width:100%;height:100%;object-fit:cover;display:block;filter:grayscale(1) contrast(1.05);opacity:.55;transition:all .5s var(--cloth)}
.cand__meter{height:2px;background:rgba(20,18,14,.14);margin-top:3px;position:relative;overflow:hidden}
.cand__meter i{position:absolute;inset:0 auto 0 0;width:0;background:var(--ink-3);transition:width .7s var(--cloth)}
.cand[data-scored="1"] .cand__meter i{width:calc(var(--v,0) * 100%)}
.cand[data-win="1"] .cand__shot{border-color:var(--ink)}
.cand[data-win="1"] .cand__shot img{filter:none;opacity:1}
.cand[data-win="1"] .cand__meter i{background:var(--madder)}
.cand__flag{position:absolute;left:0;right:0;bottom:0;background:var(--turmeric);color:var(--ink);padding:3px 4px;text-align:center;opacity:0;transform:translateY(100%);transition:all .45s var(--cloth)}
.cand[data-win="1"] .cand__flag{opacity:1;transform:none}

/* ── choosing a body ────────────────────────────────────────────────── */
.plates{display:flex;gap:6px;margin-top:12px}
.plate-pick{
  flex:1;min-width:0;padding:0;cursor:pointer;font:inherit;text-align:left;
  background:transparent;border:0;animation:rise .4s var(--cloth) both;
}
.plate-pick__shot{position:relative;aspect-ratio:3/4;overflow:hidden;background:var(--vat);border:1px solid rgba(20,18,14,.2);transition:border-color .3s var(--cloth)}
.plate-pick__shot img{width:100%;height:100%;object-fit:cover;display:block;opacity:.72;filter:grayscale(.5);transition:all .4s var(--cloth)}
.plate-pick:hover .plate-pick__shot{border-color:var(--ink)}
.plate-pick:hover .plate-pick__shot img{opacity:1;filter:none}
.plate-pick__rule{position:absolute;top:0;left:0;right:0;height:3px;background:var(--madder);opacity:0;transition:opacity .3s}
.plate-pick[data-on="1"] .plate-pick__shot{border-color:var(--ink)}
.plate-pick[data-on="1"] .plate-pick__shot img{opacity:1;filter:none}
.plate-pick[data-on="1"] .plate-pick__rule{opacity:1}
.plate-pick__name{display:block;margin-top:5px;color:var(--ink-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.plate-pick[data-on="1"] .plate-pick__name{color:var(--ink)}
.plate-pick__tag{position:absolute;bottom:0;left:0;right:0;background:var(--turmeric);color:var(--ink);padding:3px 4px;text-align:center}

/* ── steps ──────────────────────────────────────────────────────────── */
.steps{list-style:none;margin-top:12px;display:flex;flex-direction:column;gap:7px}
.steps li{display:flex;align-items:center;gap:8px;color:var(--ink-3);transition:color .4s}
.steps li[data-on="1"]{color:var(--ink)}
.steps b{width:5px;height:5px;border-radius:50%;background:rgba(20,18,14,.2);flex:none;transition:background .4s}
.steps li[data-on="1"] b{background:var(--madder)}
.steps li[data-done="1"] b{background:var(--turmeric)}

/* ── result ─────────────────────────────────────────────────────────── */
.result__name{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-weight:800;font-size:19px;line-height:1.15;letter-spacing:-.02em;margin-top:11px}
.result__spec{color:var(--ink-3);margin-top:7px}
.swatch{display:inline-block;width:8px;height:8px;vertical-align:-1px;margin-right:5px;border:1px solid rgba(20,18,14,.25)}

/* ── fit: which size, and why ───────────────────────────────────────── */
.fit{margin-top:12px;border:3px solid var(--ink);border-radius:8px;background:var(--paper-2);box-shadow:var(--brut-sm);padding:10px}
.fit__top{display:flex;align-items:baseline;gap:8px}
.fit__size{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-weight:800;font-size:26px;line-height:.9;letter-spacing:-.02em}
.fit__verdict{color:var(--ink-2)}
.fit__conf{margin-left:auto;color:var(--ink-3)}
.fit__why{font-size:11px;line-height:1.5;color:var(--ink-3);margin-top:7px}
.fit__scale{display:flex;gap:3px;margin-top:9px}
.fit__step{flex:1;min-width:0;text-align:center;padding-bottom:3px;border-bottom:3px solid rgba(18,16,13,.2)}
.fit__step b{display:block;font-family:RangrezMono,ui-monospace,monospace;font-size:9px;letter-spacing:.14em;font-weight:500;color:var(--ink-3);padding:4px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fit__step[data-pick="1"]{border-bottom-color:var(--madder)}
.fit__step[data-pick="1"] b{color:var(--ink)}
.fit__step[data-alt="1"]{border-bottom-color:var(--turmeric)}
/* Verdict, as a colour, at a glance: too tight and too loose both read as a
   warning; snug and roomy are wearable; true to size is the one you want. */
.fit__step[data-v="too tight"] b,.fit__step[data-v="too loose"] b{color:rgba(176,58,33,.7)}
.fit__step[data-pick="1"][data-v="too tight"] b,.fit__step[data-pick="1"][data-v="too loose"] b{color:var(--madder)}

/* ── actions ────────────────────────────────────────────────────────── */
.actions{display:flex;gap:5px;margin-top:13px}
/* The wipe-up fill was the old language's one flourish. This one has no
   gradients and no transitions over colour: a button is a slab that sits on
   its shadow, and pressing it moves it *into* the shadow. */
.btn{
  flex:1;display:flex;align-items:center;justify-content:space-between;gap:10px;
  padding:10px 11px;cursor:pointer;font:inherit;color:var(--paper);
  background:var(--ink);border:3px solid var(--ink);border-radius:8px;
  box-shadow:var(--brut);position:relative;
  transition:translate .12s ease,box-shadow .12s ease,background-color .12s ease;
}
.btn:hover{background:var(--madder);border-color:var(--ink);color:var(--ink)}
.btn:active{translate:4px 4px;box-shadow:none}
.btn:disabled{opacity:.4;cursor:default;translate:none;box-shadow:var(--brut)}
.btn--ghost{flex:0 0 auto;background:var(--paper);color:var(--ink)}
.btn--ghost:hover{background:var(--turmeric);color:var(--ink)}
.btn--done{background:var(--turmeric);border-color:var(--ink);color:var(--ink)}

.flag{border-left:2px solid var(--madder);background:rgba(176,58,33,.08);padding:8px 10px;font-size:11.5px;line-height:1.5;color:var(--ink-2)}
.flag--mock{border-left-color:var(--turmeric);background:rgba(217,155,33,.12)}

@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
}`;

  /* ── construction ─────────────────────────────────────────────────────── */

  const el = (html) => {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);

  /**
   * The size, under the render.
   *
   * The render answers "do I like it" and this answers "which one do I order",
   * and the two only earn their place together — a size with no picture is a
   * spreadsheet, and a picture with no size is a decision you still can't make.
   *
   * Three states, and the empty one matters most: someone who hasn't entered
   * their measurements should be told exactly what they'd get if they did,
   * once, quietly, and not be nagged about it on every product page.
   */
  function fitBlock(fit, appBase) {
    if (!fit) return "";

    const advice = fit.advice ?? fit;
    if (!advice?.headline) return "";

    if (!advice.recommended) {
      // Nothing to recommend. Only worth a line if it is a line they can act
      // on — "no size to pick" on a scarf is noise, a missing chest
      // measurement is a link.
      if (!advice.missing?.length) return "";
      return `
        <div class="fit">
          <p class="spec-sm" style="color:var(--ink-3)">Fit</p>
          <p class="fit__why" style="margin-top:6px">
            ${esc(advice.detail)}
            <button class="fit__link" type="button" data-act="open"
                    data-href="${esc(`${appBase ?? ""}/profile`)}"
                    style="background:none;border:0;padding:0;font:inherit;color:var(--ink);
                           text-decoration:underline;text-underline-offset:3px;cursor:pointer">
              Add them
            </button>
          </p>
        </div>`;
    }

    // Chart order, not score order: a size scale reads left to right as sizes,
    // and re-sorting it by how well each fits makes it unreadable as a scale.
    const scale = [...(advice.sizes ?? [])]
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map(
        (s) => `<span class="fit__step"
                      data-v="${esc(s.verdict)}"
                      data-pick="${s.size === advice.recommended ? 1 : 0}"
                      data-alt="${s.size === advice.alternate ? 1 : 0}"
                      title="${esc(`${s.size} — ${s.verdict}`)}"><b>${esc(s.size)}</b></span>`,
      )
      .join("");

    return `
      <div class="fit">
        <div class="fit__top">
          <span class="fit__size">${esc(advice.recommended)}</span>
          <span class="spec fit__verdict">${esc(advice.sizes[0]?.verdict ?? "")}</span>
          <span class="spec-sm fit__conf">${esc(advice.confidence)} confidence</span>
        </div>
        ${scale ? `<div class="fit__scale">${scale}</div>` : ""}
        <p class="fit__why">${esc(advice.detail)}</p>
      </div>`;
  }

  class Surface {
    constructor() {
      ensureFonts();

      this.host = document.createElement("div");
      this.host.id = "rangrez-surface";
      // Pinned inline and !important, because a `:host` rule loses to any page
      // rule that happens to match this element — and shops style bare `div`s
      // more often than you'd hope. Only the properties that decide *where*
      // this sits are forced; everything else is left to the shadow stylesheet.
      this.host.style.cssText = [
        "position:fixed !important",
        "right:18px !important",
        "bottom:18px !important",
        "top:auto !important",
        "left:auto !important",
        "z-index:2147483647 !important",
        "margin:0 !important",
        "padding:0 !important",
        "width:auto !important",
        "height:auto !important",
        "max-width:none !important",
        "max-height:none !important",
        "min-width:0 !important",
        "min-height:0 !important",
        "transform:none !important",
        "float:none !important",
        "clip-path:none !important",
        "opacity:1 !important",
        "visibility:visible !important",
        "display:block !important",
        "pointer-events:auto !important",
      ].join(";");
      this.root = this.host.attachShadow({ mode: "open" });
      this.root.innerHTML = `<style>${CSS}</style>
        <div class="dock" hidden>
          <button class="trigger" type="button">
            <span class="trigger__rule"></span>
            ${KNOT}
            <span class="spec">Try this on yourself</span>
            <span class="spec trigger__arrow">&rarr;</span>
          </button>
          <button class="dock__x" type="button" title="Hide Rangrez on this site">&times;</button>
        </div>
        <section class="panel" hidden role="dialog" aria-label="Rangrez try-on">
          <header class="head">
            ${KNOT}
            <span class="spec">Rangrez</span>
            <span class="spec-sm head__site"></span>
            <button class="head__x" type="button" aria-label="Close">&times;</button>
          </header>
          <div class="body"></div>
        </section>`;

      document.documentElement.appendChild(this.host);

      this.dock = this.root.querySelector(".dock");
      this.panel = this.root.querySelector(".panel");
      this.body = this.root.querySelector(".body");
      this.siteLabel = this.root.querySelector(".head__site");

      this.root.querySelector(".trigger").addEventListener("click", () =>
        this.onTrigger?.(),
      );
      this.root.querySelector(".dock__x").addEventListener("click", () =>
        this.onDismiss?.(),
      );
      this.root.querySelector(".head__x").addEventListener("click", () =>
        this.close(),
      );

      // Esc closes, but only ours — never swallow the shop's own handlers.
      this.onKey = (e) => {
        if (e.key === "Escape" && !this.panel.hidden) this.close();
      };
      document.addEventListener("keydown", this.onKey, true);
    }

    showTrigger(show) {
      this.dock.hidden = !show;
    }

    open(siteLabel) {
      this.siteLabel.textContent = siteLabel || "";
      this.dock.hidden = true;
      this.panel.hidden = false;
    }

    close() {
      this.panel.hidden = true;
      this.dock.hidden = false;
      this.onClose?.();
    }

    destroy() {
      document.removeEventListener("keydown", this.onKey, true);
      this.host.remove();
    }

    /* ── states ────────────────────────────────────────────────────────── */

    /** Reading the gallery: every candidate, scoring live. */
    renderIsolating(candidates) {
      this.body.innerHTML = `
        <p class="spec kicker">Reading the gallery</p>
        <div class="strip"></div>
        <p class="note">Looking for the shot that shows the whole garment —
        on a model or laid flat. Fabric close-ups and detail crops are
        thrown out; there's nothing there to put on a body.</p>`;

      const strip = this.body.querySelector(".strip");
      candidates.slice(0, 5).forEach((c, i) => {
        const fig = el(`<figure class="cand" style="animation-delay:${i * 60}ms">
          <div class="cand__shot">
            <img src="${esc(c.thumb || c.url)}" alt="" loading="eager" referrerpolicy="no-referrer">
            <span class="spec-sm cand__flag">Isolated</span>
          </div>
          <span class="cand__meter"><i></i></span>
        </figure>`);
        strip.appendChild(fig);
      });
      return strip;
    }

    /** Paint the scores back onto the strip, then crown the winner. */
    applyScores(strip, scored, winnerUrl) {
      const cards = Array.from(strip.querySelectorAll(".cand"));
      scored.slice(0, cards.length).forEach((s, i) => {
        cards[i].style.setProperty("--v", String(s.score ?? 0));
        cards[i].dataset.scored = "1";
        if (s.url === winnerUrl) cards[i].dataset.win = "1";
      });
    }

    /**
     * Which body?
     *
     * Only ever reached when the account holds more than one plate — see
     * main.js. A question with one answer is not a question, and making
     * everybody confirm their only avatar before every try-on would be a tax
     * on the common case to serve the rare one.
     *
     * Photographs, not a list: these are bodies, and the user recognises them
     * faster than they read "Plate 02".
     */
    renderAvatarPick(avatars, activeId) {
      this.body.innerHTML = `
        <p class="spec kicker">Which body?</p>
        <p class="note">You keep more than one plate. Pick the one to hang this on.</p>
        <div class="plates"></div>`;

      const row = this.body.querySelector(".plates");
      avatars.forEach((a, i) => {
        const on = a.id === activeId;
        const card = el(`<button class="plate-pick" type="button"
            data-on="${on ? "1" : ""}" data-avatar="${esc(a.id)}"
            style="animation-delay:${i * 70}ms">
          <span class="plate-pick__shot">
            <span class="plate-pick__rule"></span>
            <img src="${esc(a.renderUrl)}" alt="" referrerpolicy="no-referrer">
            ${on ? `<span class="spec-sm plate-pick__tag">In use</span>` : ""}
          </span>
          <span class="spec-sm plate-pick__name">${esc(a.label)}</span>
        </button>`);
        row.appendChild(card);
      });

      return this.body;
    }

    /** The VTO call itself. */
    renderRendering(avatarUrl, steps) {
      this.body.innerHTML = `
        <p class="spec kicker">In the vat</p>
        <div class="plate plate--busy">
          <span class="spec-sm plate__tag">Your avatar</span>
          ${avatarUrl ? `<img src="${esc(avatarUrl)}" alt="">` : ""}
          <span class="scan"></span>
        </div>
        <ol class="steps">${steps
          .map((s) => `<li><b></b><span class="spec">${esc(s)}</span></li>`)
          .join("")}</ol>`;

      const plate = this.body.querySelector(".plate");
      // The scan sweep needs the plate's real height, not a guess.
      requestAnimationFrame(() =>
        this.body
          .querySelector(".scan")
          ?.style.setProperty("--h", `${plate.clientHeight}px`),
      );
      return Array.from(this.body.querySelectorAll(".steps li"));
    }

    /** Done. The render is the interface; everything else gets out of its way. */
    renderResult({ renderUrl, name, specLine, dye, mocked, fit, appBase }) {
      this.body.innerHTML = `
        <div class="plate">
          <span class="spec-sm plate__tag">On you</span>
          <img src="${esc(renderUrl)}" alt="Your avatar wearing ${esc(name)}">
        </div>
        <p class="result__name">${esc(name)}</p>
        <p class="spec-sm result__spec">
          ${dye ? `<span class="swatch" style="background:${esc(dye)}"></span>` : ""}${esc(specLine)}
        </p>
        ${fitBlock(fit, appBase)}
        ${mocked ? `<div class="flag flag--mock" style="margin-top:11px">
          <b class="spec-sm">Mock mode</b> — set <code>YOUCAM_MOCK=0</code> in
          apps/web/.env.local to render for real.</div>` : ""}
        <div class="actions">
          <button class="btn" type="button" data-act="save">
            <span class="spec">Save to wardrobe</span><span class="spec">&rarr;</span>
          </button>
          <button class="btn btn--ghost" type="button" data-act="close">
            <span class="spec">Done</span>
          </button>
        </div>`;
      return this.body;
    }

    /** Recognised, but Apparel VTO can't dress a body with it. */
    renderUnsupported(label, reason) {
      this.body.innerHTML = `
        <p class="spec kicker">Recognised</p>
        <p class="display">${esc(label)}<em>.</em></p>
        <p class="note" style="margin-top:11px">${esc(reason)}</p>
        <div class="actions">
          <button class="btn btn--ghost" style="flex:1" type="button" data-act="close">
            <span class="spec">Close</span><span class="spec">&times;</span>
          </button>
        </div>`;
      return this.body;
    }

    /** Not paired, or paired with no avatar yet. */
    renderNeeds({ line, note, cta, href }) {
      this.body.innerHTML = `
        <p class="spec kicker">Rangrez</p>
        <p class="display">${line}</p>
        <p class="note" style="margin-top:11px">${esc(note)}</p>
        <div class="actions">
          <button class="btn" type="button" data-act="open" data-href="${esc(href)}">
            <span class="spec">${esc(cta)}</span><span class="spec">&rarr;</span>
          </button>
        </div>`;
      return this.body;
    }

    renderError(message) {
      this.body.innerHTML = `
        <p class="spec kicker">Didn't take</p>
        <div class="flag" style="margin-bottom:12px">${esc(message)}</div>
        <div class="actions">
          <button class="btn" type="button" data-act="retry">
            <span class="spec">Try again</span><span class="spec">&#8635;</span>
          </button>
          <button class="btn btn--ghost" type="button" data-act="close">
            <span class="spec">Close</span>
          </button>
        </div>`;
      return this.body;
    }
  }

  RZ.Surface = Surface;
})();
