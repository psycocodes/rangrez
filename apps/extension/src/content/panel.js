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
    const url = (f) => chrome.runtime.getURL(`assets/fonts/${f}`);
    const style = document.createElement("style");
    style.id = "rz-fontface";
    style.textContent = `
@font-face{font-family:RangrezSerif;font-style:normal;font-weight:400;font-display:swap;src:url("${url("instrument-serif-normal.woff2")}") format("woff2")}
@font-face{font-family:RangrezSerif;font-style:italic;font-weight:400;font-display:swap;src:url("${url("instrument-serif-italic.woff2")}") format("woff2")}
@font-face{font-family:RangrezMono;font-style:normal;font-weight:500;font-display:swap;src:url("${url("jetbrains-mono-500.woff2")}") format("woff2")}`;
    (document.head || document.documentElement).appendChild(style);
  }

  /* ── styles ───────────────────────────────────────────────────────────── */

  const CSS = `
:host{all:initial;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:host{
  --paper:#EDE7DA; --paper-2:#E4DCCA; --paper-3:#D8CFBA;
  --ink:#14120E; --ink-2:#3A352B; --ink-3:#6D6555;
  --madder:#B03A21; --turmeric:#D99B21; --indigo:#26356E; --vat:#161D3D;
  --cloth:cubic-bezier(.22,1,.36,1);
  --grain:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E");
  color:var(--ink); line-height:1.45;
}
.spec{font-family:RangrezMono,ui-monospace,monospace;font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;font-weight:500;line-height:1}
.spec-sm{font-family:RangrezMono,ui-monospace,monospace;font-size:8.5px;letter-spacing:.24em;text-transform:uppercase;font-weight:500;line-height:1}
.display{font-family:RangrezSerif,Georgia,serif;font-weight:400;letter-spacing:-.03em;line-height:.95;font-size:30px}
.display em{font-style:italic}
.note{font-size:11.5px;line-height:1.55;color:var(--ink-3);letter-spacing:-.005em}

/* ── trigger ─────────────────────────────────────────────────────────── */
.dock{display:flex;align-items:stretch;filter:drop-shadow(0 10px 24px rgba(20,18,14,.28))}
.dock[hidden]{display:none}
.trigger{
  display:flex;align-items:center;gap:9px;padding:11px 13px;cursor:pointer;
  background:var(--paper);border:1px solid var(--ink);border-right:0;color:var(--ink);
  position:relative;overflow:hidden;isolation:isolate;font:inherit;
  transition:color .3s var(--cloth);
}
.trigger::before{content:"";position:absolute;inset:0;z-index:-1;background:var(--ink);transform:translateY(101%);transition:transform .42s var(--cloth)}
.trigger:hover{color:var(--paper)}
.trigger:hover::before{transform:translateY(0)}
.trigger__rule{position:absolute;top:0;left:0;right:0;height:2px;background:var(--madder)}
.trigger svg{width:13px;height:13px;flex:none}
.trigger__arrow{opacity:.5;transition:transform .42s var(--cloth)}
.trigger:hover .trigger__arrow{transform:translateX(3px);opacity:1}
.dock__x{
  width:30px;cursor:pointer;background:var(--paper);border:1px solid var(--ink);
  color:var(--ink-3);font:inherit;font-size:14px;line-height:1;
  transition:background .25s var(--cloth),color .25s var(--cloth);
}
.dock__x:hover{background:var(--madder);color:var(--paper)}

/* ── panel ───────────────────────────────────────────────────────────── */
.panel{
  position:relative; /* the grain overlay is absolute against this */
  width:372px;max-width:calc(100vw - 36px);max-height:calc(100vh - 36px);
  display:flex;flex-direction:column;overflow:hidden;
  background:var(--paper);border:1px solid var(--ink);
  box-shadow:0 26px 64px -22px rgba(20,18,14,.55);
  animation:rise .5s var(--cloth) both;
}
.panel[hidden]{display:none}
.panel::before{content:"";position:absolute;inset:0;pointer-events:none;background-image:var(--grain);opacity:.16;mix-blend-mode:multiply}
@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}

.head{display:flex;align-items:center;gap:8px;padding:10px 11px;border-bottom:1px solid var(--ink);position:relative}
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

/* ── steps ──────────────────────────────────────────────────────────── */
.steps{list-style:none;margin-top:12px;display:flex;flex-direction:column;gap:7px}
.steps li{display:flex;align-items:center;gap:8px;color:var(--ink-3);transition:color .4s}
.steps li[data-on="1"]{color:var(--ink)}
.steps b{width:5px;height:5px;border-radius:50%;background:rgba(20,18,14,.2);flex:none;transition:background .4s}
.steps li[data-on="1"] b{background:var(--madder)}
.steps li[data-done="1"] b{background:var(--turmeric)}

/* ── result ─────────────────────────────────────────────────────────── */
.result__name{font-family:RangrezSerif,Georgia,serif;font-size:19px;line-height:1.15;letter-spacing:-.02em;margin-top:11px}
.result__spec{color:var(--ink-3);margin-top:7px}
.swatch{display:inline-block;width:8px;height:8px;vertical-align:-1px;margin-right:5px;border:1px solid rgba(20,18,14,.25)}

/* ── actions ────────────────────────────────────────────────────────── */
.actions{display:flex;gap:5px;margin-top:13px}
.btn{
  flex:1;display:flex;align-items:center;justify-content:space-between;gap:10px;
  padding:10px 11px;cursor:pointer;font:inherit;color:var(--paper);
  background:var(--ink);border:1px solid var(--ink);
  position:relative;overflow:hidden;isolation:isolate;transition:color .3s var(--cloth);
}
.btn::before{content:"";position:absolute;inset:0;z-index:-1;background:var(--madder);transform:translateY(101%);transition:transform .42s var(--cloth)}
.btn:hover::before{transform:translateY(0)}
.btn:disabled{opacity:.45;cursor:default}
.btn:disabled::before{transform:translateY(101%)}
.btn--ghost{flex:0 0 auto;background:transparent;color:var(--ink)}
.btn--ghost:hover{color:var(--paper)}
.btn--done{background:var(--turmeric);border-color:var(--turmeric);color:var(--ink)}
.btn--done::before{display:none}

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
    renderResult({ renderUrl, name, specLine, dye, mocked }) {
      this.body.innerHTML = `
        <div class="plate">
          <span class="spec-sm plate__tag">On you</span>
          <img src="${esc(renderUrl)}" alt="Your avatar wearing ${esc(name)}">
        </div>
        <p class="result__name">${esc(name)}</p>
        <p class="spec-sm result__spec">
          ${dye ? `<span class="swatch" style="background:${esc(dye)}"></span>` : ""}${esc(specLine)}
        </p>
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
