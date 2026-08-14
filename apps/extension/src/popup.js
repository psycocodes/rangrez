import { api, isGecko } from "./lib/api.js";

/**
 * Popup: the extension's own status page. Says exactly one useful thing —
 * whether it can render on your body right now — and gives you the one action
 * that fixes it if it can't.
 */
const view = document.getElementById("view");

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);

const ask = (type, payload = {}) =>
  api.runtime.sendMessage({ type, ...payload });

function open(url) {
  api.tabs.create({ url });
  window.close();
}

/**
 * Firefox treats MV3 host permissions as optional — declared in the manifest,
 * but not granted until the user says so — where Chrome grants them at install.
 * Without them nothing injects and no shop CDN can be fetched, so the popup
 * asks. `permissions.request` needs a user gesture, which a click here is.
 */
async function siteAccess() {
  if (!isGecko || !api.permissions) return true;
  try {
    return await api.permissions.contains({ origins: ["<all_urls>"] });
  } catch {
    return true;
  }
}

function renderNeedsPermission() {
  view.innerHTML = `
    <p class="display">Let me <em>see</em><br>the shops.</p>
    <p class="note" style="margin-top:11px">
      Firefox asks before an add-on can read pages. Rangrez needs it to spot
      clothes on a product page and fetch the photograph — nothing leaves your
      browser except the one image you ask to try on.
    </p>
    <div class="rule"><button class="btn" data-act="grant">
      <span class="spec">Grant site access</span><span class="spec">&rarr;</span>
    </button></div>`;

  view.querySelector('[data-act="grant"]').addEventListener("click", async () => {
    try {
      const granted = await api.permissions.request({ origins: ["<all_urls>"] });
      if (granted) boot();
    } catch (err) {
      console.warn("[rangrez] permission request failed", err);
    }
  });
}

function render(session) {
  const { apiBase } = session;

  if (session.unreachable) {
    view.innerHTML = `
      <p class="display">Can't reach<br><em>the app.</em></p>
      <p class="note" style="margin-top:11px">
        Nothing is answering at <b>${esc(apiBase)}</b>. Start it with
        <code>npm run dev</code> and open the popup again.
      </p>
      <div class="rule"><button class="btn btn--ghost" data-open="${esc(apiBase)}">
        <span class="spec">Open anyway</span><span class="spec">&rarr;</span>
      </button></div>`;
  } else if (!session.connected) {
    view.innerHTML = `
      <p class="display">Not <em>paired.</em></p>
      <p class="note" style="margin-top:11px">
        Open Rangrez while signed in — the extension picks up its key on its
        own. Nothing to copy.
      </p>
      <div class="rule"><button class="btn" data-open="${esc(apiBase)}/connect">
        <span class="spec">Pair the extension</span><span class="spec">&rarr;</span>
      </button></div>`;
  } else if (!session.avatar) {
    view.innerHTML = `
      <div class="status"><span class="dot" data-on="1"></span><span class="spec">Paired</span></div>
      <p class="display">No <em>body</em><br>on file.</p>
      <p class="note" style="margin-top:11px">
        One clean photograph and every garment you meet can be hung on it.
      </p>
      <div class="rule"><button class="btn" data-open="${esc(apiBase)}/atelier">
        <span class="spec">Create your avatar</span><span class="spec">&rarr;</span>
      </button></div>`;
  } else {
    view.innerHTML = `
      <div class="status">
        <span class="dot" data-on="1"></span>
        <span class="spec">Ready to dress you</span>
      </div>

      ${session.mocked ? `<div class="flag"><b class="spec-sm">Mock mode</b> —
        renders are simulated. Set <code>YOUCAM_MOCK=0</code> in
        apps/web/.env.local to go live.</div>` : ""}

      <div class="who">
        <div class="plate"><img src="${esc(session.avatar.renderUrl)}" alt=""></div>
        <div>
          <p class="name">${esc(session.user.name)}</p>
          <p class="spec-sm" style="color:var(--ink-3)">
            ${esc(session.avatar.colorSeason || "Unanalysed")}
          </p>
          <p class="note" style="margin-top:8px">
            Open any product page. The mark appears when there are clothes on it.${
              session.avatars?.length > 1
                ? ` You keep ${session.avatars.length} plates, so it will ask which body to use.`
                : ""
            }
          </p>
        </div>
      </div>

      <button class="btn" data-open="${esc(apiBase)}/wardrobe">
        <span class="spec">Open the wardrobe</span><span class="spec">&rarr;</span>
      </button>
      <button class="btn btn--ghost" data-act="undismiss">
        <span class="spec">Show on hidden sites</span><span class="spec">&#8635;</span>
      </button>

      <div class="rule">
        <div class="kv"><span class="spec">Signed in</span><span>${esc(session.user.email)}</span></div>
        <div class="kv"><span class="spec">App</span><span>${esc(apiBase)}</span></div>
        <div class="kv"><span class="spec">YouCam</span><span>${session.mocked ? "MOCK" : "LIVE"}</span></div>
      </div>`;
  }

  view.querySelectorAll("[data-open]").forEach((b) =>
    b.addEventListener("click", () => open(b.dataset.open)),
  );

  view.querySelector('[data-act="undismiss"]')?.addEventListener("click", async (e) => {
    await ask("CLEAR_DISMISSED");
    e.currentTarget.querySelector(".spec").textContent = "Shown everywhere again";
  });
}

async function boot() {
  view.innerHTML = `<p class="spec" style="color:var(--ink-3)">Checking…</p>`;
  try {
    if (!(await siteAccess())) return renderNeedsPermission();
    render(await ask("SESSION"));
  } catch (err) {
    view.innerHTML = `<p class="note">${esc(err.message || "Something went wrong.")}</p>`;
  }
}

void boot();
