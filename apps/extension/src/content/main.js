/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Orchestration
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  detect → offer → isolate → render → save.
 *
 *  All network work is delegated to the service worker: it holds the token,
 *  it has the host permissions to fetch a shop's CDN, and it can run the
 *  pixel analysis on an OffscreenCanvas without touching the page.
 * ═══════════════════════════════════════════════════════════════════════════
 */
globalThis.RZ = globalThis.RZ || {};

(() => {
  if (window.__rangrezBooted) return;
  window.__rangrezBooted = true;

  const RENDER_STEPS = [
    "Sending the garment",
    "Apparel VTO · task queued",
    "Dressing your avatar",
  ];

  let surface = null;
  let product = null;
  let session = null;
  let busy = false;

  /** The service worker is the only thing that talks to the network. */
  async function ask(type, payload) {
    try {
      const res = await chrome.runtime.sendMessage({ type, ...payload });
      if (res?.error) throw new Error(res.error);
      return res;
    } catch (err) {
      // Reloading the extension orphans this script; say something true.
      if (String(err?.message || err).includes("Extension context invalidated")) {
        throw new Error("Extension was reloaded — refresh this page.");
      }
      throw err;
    }
  }

  /* ── the offer ────────────────────────────────────────────────────────── */

  async function evaluate() {
    let found = null;
    try {
      found = RZ.detect();
    } catch (err) {
      console.debug("[rangrez] detect failed", err);
    }

    if (!found) {
      surface?.showTrigger(false);
      product = null;
      return;
    }

    // Re-offering the same product on every DOM mutation would be noise.
    if (product && product.sourceUrl === found.sourceUrl) return;
    product = found;

    const { dismissed } = await ask("GET_DISMISSED", { host: location.hostname });
    if (dismissed) return;

    if (!surface) {
      surface = new RZ.Surface();
      surface.onTrigger = () => start();
      surface.onDismiss = () => {
        surface.showTrigger(false);
        ask("DISMISS", { host: location.hostname }).catch(() => {});
      };
    }
    surface.showTrigger(true);
  }

  /* ── the pipeline ─────────────────────────────────────────────────────── */

  async function start() {
    if (busy || !product) return;
    busy = true;
    surface.open(product.site.label);

    try {
      await run();
    } catch (err) {
      console.warn("[rangrez]", err);
      wire(surface.renderError(err.message || "Something went wrong."));
    } finally {
      busy = false;
    }
  }

  async function run() {
    session = session || (await ask("SESSION"));

    if (!session?.connected) {
      wire(
        surface.renderNeeds({
          line: "Not <em>paired</em> yet.",
          note: "Open Rangrez once while signed in and the extension picks up its key on its own.",
          cta: "Open Rangrez",
          href: `${session?.apiBase || ""}/connect`,
        }),
      );
      return;
    }

    if (!session.avatar) {
      wire(
        surface.renderNeeds({
          line: "No <em>body</em> on file.",
          note: "Rangrez needs one clean photograph of you before it can hang anything on it.",
          cta: "Create your avatar",
          href: `${session.apiBase}/atelier`,
        }),
      );
      return;
    }

    const { category } = product;

    // Detected on purpose, refused on purpose. Spending a VTO call on a
    // necklace only buys a slower failure.
    if (!category.vto) {
      wire(surface.renderUnsupported(category.label, RZ.taxonomy.unsupportedReason(category.label)));
      return;
    }

    // ── isolate ────────────────────────────────────────────────────────
    const strip = surface.renderIsolating(product.candidates);
    const { scored, winner } = await ask("ANALYSE", {
      candidates: product.candidates,
    });

    if (!winner) throw new Error("Couldn't read any of the product photographs.");

    surface.applyScores(strip, scored, winner.url);
    // Let the crown land before the view changes — this is the one moment
    // that shows the work, and it's over in under a second.
    await new Promise((r) => setTimeout(r, 950));

    // ── render ─────────────────────────────────────────────────────────
    const steps = surface.renderRendering(session.avatar.renderUrl, RENDER_STEPS);
    let step = 0;
    const advance = setInterval(() => {
      if (step < steps.length) {
        steps[step].dataset.done = "1";
        steps[step].dataset.on = "";
      }
      step = Math.min(step + 1, steps.length - 1);
      steps[step].dataset.on = "1";
    }, 1500);
    steps[0].dataset.on = "1";

    let result;
    try {
      result = await ask("TRYON", { imageUrl: winner.url, category: category.vto });
    } finally {
      clearInterval(advance);
    }

    // ── done ───────────────────────────────────────────────────────────
    const specLine = [category.label, product.site.label]
      .filter(Boolean)
      .join(" · ");

    const view = surface.renderResult({
      renderUrl: result.renderUrl,
      name: product.title,
      specLine,
      dye: winner.dominantColor,
      mocked: result.mocked,
    });

    // If the shop's CSP refuses YouCam's S3 host, re-fetch through the service
    // worker and inline it. Everything worked; it would be absurd to lose the
    // render to a header.
    const shot = view.querySelector(".plate img");
    shot?.addEventListener(
      "error",
      async () => {
        try {
          const { dataUrl } = await ask("RENDER_IMAGE", { url: result.renderUrl });
          shot.src = dataUrl;
        } catch (err) {
          console.warn("[rangrez] couldn't inline the render", err);
        }
      },
      { once: true },
    );

    wire(view, {
      save: async (btn) => {
        btn.disabled = true;
        btn.querySelector(".spec").textContent = "Saving";
        try {
          await ask("SAVE", {
            name: product.title,
            zone: category.zone,
            dominantColor: winner.dominantColor,
            material: `${category.label} · ${product.brand || product.site.label}`,
            renderUrl: result.renderUrl,
            sourceUrl: product.sourceUrl,
          });
          btn.classList.add("btn--done");
          btn.querySelector(".spec").textContent = "In your wardrobe";
        } catch (err) {
          btn.disabled = false;
          btn.querySelector(".spec").textContent = "Couldn't save";
          console.warn("[rangrez] save failed", err);
        }
      },
    });
  }

  /** Binds the data-act buttons a state just rendered. */
  function wire(view, handlers = {}) {
    view.querySelectorAll("[data-act]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const act = btn.dataset.act;
        if (act === "close") return surface.close();
        if (act === "retry") return void start();
        if (act === "open") {
          return void ask("OPEN", { url: btn.dataset.href }).catch(() => {});
        }
        handlers[act]?.(btn);
      });
    });
  }

  /* ── boot + SPA navigation ────────────────────────────────────────────── */

  let timer;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void evaluate(), 400);
  };

  schedule();

  // Myntra, Flipkart and Ajio all swap products without a page load.
  for (const method of ["pushState", "replaceState"]) {
    const original = history[method];
    history[method] = function (...args) {
      const out = original.apply(this, args);
      schedule();
      return out;
    };
  }
  window.addEventListener("popstate", schedule);

  // Late-rendered galleries: watch the title, which changes with the product.
  const titleNode = document.querySelector("title");
  if (titleNode) new MutationObserver(schedule).observe(titleNode, { childList: true });
})();
