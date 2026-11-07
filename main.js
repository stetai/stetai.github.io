(function () {
  "use strict";

  const SITE = window.SITE;
  const main = document.getElementById("main");
  if (!SITE) {
    main.append(el("p", { class: "notice", text: "Content is missing: check that data.js loads." }));
    return;
  }

  /* ---------- helpers ---------- */

  // Builds DOM nodes with textContent only, so API data can never inject HTML.
  function el(tag, props, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k === "style") node.style.cssText = v;
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children.flat()) {
      if (c != null && c !== false) node.append(c instanceof Node ? c : String(c));
    }
    return node;
  }

  const isExternal = (url) => /^https?:\/\//.test(url) && !url.startsWith(location.origin);

  // Caches API responses for an hour per tab; GitHub allows 60 unauthenticated requests per hour per IP.
  async function cachedJson(url, ttlMs = 60 * 60 * 1000) {
    const key = "cache:" + url;
    try {
      const hit = JSON.parse(sessionStorage.getItem(key));
      if (hit && Date.now() - hit.t < ttlMs) return hit.v;
    } catch (_) { /* storage unavailable */ }
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status + " " + res.statusText);
    const v = await res.json();
    try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), v })); } catch (_) {}
    return v;
  }

  const nf = new Intl.NumberFormat("en");
  function relDate(iso) {
    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    const days = (new Date(iso) - Date.now()) / 864e5;
    if (Math.abs(days) < 30) return rtf.format(Math.round(days), "day");
    if (Math.abs(days) < 365) return rtf.format(Math.round(days / 30), "month");
    return rtf.format(Math.round(days / 365), "year");
  }

  function plate(cat) {
    return el("div", { class: "card-media", "aria-hidden": "true" },
      el("span", { class: "plate-glyph", text: cat.glyph }));
  }

  function media(card, cat) {
    if (!card.image) return plate(cat);
    return el("div", { class: "card-media" },
      el("img", { src: card.image, alt: card.alt || "", loading: "lazy", decoding: "async" }));
  }

  function titleLink(title, url) {
    const ext = isExternal(url);
    return el("a", { class: "card-link", href: url, target: ext ? "_blank" : null, rel: ext ? "noopener" : null, text: title });
  }

  /* ---------- card renderers ---------- */

  const renderers = {
    link(card, cat) {
      return el("article", { class: "card card--link" },
        media(card, cat),
        el("div", { class: "card-body" },
          el("h3", null, titleLink(card.title, card.url)),
          card.text && el("p", { class: "card-text", text: card.text }),
          card.source && el("ul", { class: "meta" }, el("li", { text: card.source }))));
    },

    repo(card, cat) {
      const [owner, name] = card.repo.split("/");
      const desc = el("p", { class: "card-text", text: card.note || "Loading repository details…" });
      const meta = el("ul", { class: "meta" });
      const preview = card.image ? media(card, cat) :
        el("div", { class: "card-media plate--repo", "aria-hidden": "true" },
          el("div", null,
            el("span", { class: "owner", text: owner + " /" }),
            el("span", { class: "name", text: name })));

      cachedJson("https://api.github.com/repos/" + card.repo)
        .then((r) => {
          if (!card.note) desc.textContent = r.description || "No description yet.";
          meta.replaceChildren(
            r.language ? el("li", null, el("span", { class: "lang-dot", "aria-hidden": "true" }), r.language) : "",
            el("li", { text: "★ " + nf.format(r.stargazers_count), "aria-label": r.stargazers_count + " stars" }),
            el("li", { text: "Updated " + relDate(r.pushed_at) }));
        })
        .catch(() => {
          if (!card.note) desc.textContent = "Details unavailable right now. Open the repository on GitHub.";
        });

      return el("article", { class: "card card--repo" },
        preview,
        el("div", { class: "card-body" },
          el("h3", null, titleLink(name, "https://github.com/" + card.repo)),
          desc, meta));
    },

    embed(card, cat) {
      const box = el("div", { class: "card-media embed", style: card.ratio ? "aspect-ratio:" + card.ratio : null });
      const load = () => box.replaceChildren(el("iframe", {
        src: card.src,
        title: card.title,
        loading: "lazy",
        allow: "autoplay; encrypted-media; fullscreen; picture-in-picture",
        allowfullscreen: true,
        referrerpolicy: "strict-origin-when-cross-origin"
      }));
      box.append(
        el("span", { class: "plate-glyph", "aria-hidden": "true", text: cat.glyph }),
        el("button", { type: "button", class: "embed-load", onclick: load, text: "Load from " + card.provider }),
        el("p", { class: "embed-note", text: "Loading connects your browser to " + card.provider + "." }));

      return el("article", { class: "card card--embed" },
        box,
        el("div", { class: "card-body" },
          el("h3", { text: card.title }),
          card.text && el("p", { class: "card-text", text: card.text })));
    },

    lichess(card, cat) {
      const perfs = card.perfs || ["rapid", "blitz", "puzzle"];
      const labels = { bullet: "Bullet", blitz: "Blitz", rapid: "Rapid", classical: "Classical", puzzle: "Puzzles", correspondence: "Corresp." };
      const ratings = el("dl", { class: "ratings" },
        perfs.map((p) => el("div", null, el("dt", { text: labels[p] || p }), el("dd", { text: "–" }))));
      const desc = el("p", { class: "card-text", text: "Loading ratings…" });
      const url = "https://lichess.org/@/" + encodeURIComponent(card.username);

      cachedJson("https://lichess.org/api/user/" + encodeURIComponent(card.username), 10 * 60 * 1000)
        .then((u) => {
          ratings.replaceChildren(...perfs.map((p) => {
            const perf = u.perfs && u.perfs[p];
            const value = perf ? perf.rating + (perf.prov ? "?" : "") : "–";
            return el("div", null, el("dt", { text: labels[p] || p }), el("dd", { text: String(value) }));
          }));
          desc.textContent = u.count ? nf.format(u.count.all) + " games played on Lichess." : "My Lichess profile.";
        })
        .catch(() => { desc.textContent = "Set your Lichess username in data.js to show live ratings."; });

      return el("article", { class: "card card--lichess" },
        el("div", { class: "card-media" }, ratings),
        el("div", { class: "card-body" },
          el("h3", null, titleLink("Lichess: " + card.username, url)),
          desc));
    },

    note(card) {
      return el("article", { class: "card card--note" },
        el("div", { class: "card-body" },
          el("h3", { text: card.title }),
          card.text && el("p", { class: "card-text", text: card.text }),
          card.items && el("ul", null, card.items.map((i) => el("li", { text: i })))));
    }
  };

  /* ---------- page ---------- */

  const o = SITE.owner || {};
  if (o.name) {
    document.getElementById("owner-name").textContent = o.name;
    document.title = o.name + " | stetai";
  }
  document.getElementById("owner-tagline").textContent = o.tagline || "";
  document.getElementById("owner-links").append(
    ...(o.links || []).map((l) => el("li", null, el("a", { href: l.url, rel: "me", text: l.label }))));

  const toc = document.getElementById("toc");

  for (const cat of SITE.categories) {
    const n = cat.cards.length;
    if (n !== 3 && n !== 6) console.warn(`"${cat.title}" has ${n} cards; use 3 or 6 to keep full rows.`);

    toc.append(el("li", { style: "--accent:" + cat.accent }, el("a", { href: "#" + cat.id, text: cat.title })));

    const cards = cat.cards.map((card) => {
      const render = renderers[card.type];
      if (!render) { console.warn("Unknown card type:", card.type); return null; }
      return render(card, cat);
    });

    main.append(el("section", { class: "category", id: cat.id, style: "--accent:" + cat.accent, "aria-labelledby": cat.id + "-title" },
      el("div", { class: "category-head" },
        el("h2", { id: cat.id + "-title" },
          el("span", { class: "glyph", "aria-hidden": "true", text: cat.glyph }), cat.title),
        cat.intro && el("p", { text: cat.intro })),
      el("div", { class: "grid" }, cards)));
  }

  const updated = document.getElementById("updated");
  const d = new Date(document.lastModified);
  updated.dateTime = d.toISOString().slice(0, 10);
  updated.textContent = d.toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric" });
})();
