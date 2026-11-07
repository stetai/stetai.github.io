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
  // ndjson: true parses newline-delimited JSON (one object per line) into an array.
  async function cachedJson(url, ttlMs = 60 * 60 * 1000, { accept, ndjson } = {}) {
    const key = "cache:" + url;
    try {
      const hit = JSON.parse(sessionStorage.getItem(key));
      if (hit && Date.now() - hit.t < ttlMs) return hit.v;
    } catch (_) { /* storage unavailable */ }
    const res = await fetch(url, accept ? { headers: { Accept: accept } } : undefined);
    if (!res.ok) throw new Error(res.status + " " + res.statusText);
    const v = ndjson
      ? (await res.text()).split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l))
      : await res.json();
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

  // Fills `box` with a "Load from …" button; the iframe is only created on click.
  function clickToLoad(box, { src, title, provider, glyph }) {
    const load = () => box.replaceChildren(el("iframe", {
      src,
      title,
      loading: "lazy",
      allow: "autoplay; encrypted-media; fullscreen; picture-in-picture",
      allowfullscreen: true,
      referrerpolicy: "strict-origin-when-cross-origin"
    }));
    box.replaceChildren(
      el("span", { class: "plate-glyph", "aria-hidden": "true", text: glyph }),
      el("button", { type: "button", class: "embed-load", onclick: load, text: "Load from " + provider }),
      el("p", { class: "embed-note", text: "Loading connects your browser to " + provider + "." }));
  }

  const SVGNS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs, ...children) {
    const node = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v != null) node.setAttribute(k, v);
    for (const c of children.flat()) if (c != null) node.append(c instanceof Node ? c : String(c));
    return node;
  }

  const monthFmt = new Intl.DateTimeFormat("en", { month: "short", year: "numeric" });
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "");

  // Draws up to three rating lines as an SVG. Returns null if there is nothing to draw.
  function ratingChart(history, wanted, months) {
    const now = Date.now();
    const start = new Date(); start.setMonth(start.getMonth() - months);
    const t0 = start.getTime();

    const series = wanted.map((name) => {
      const entry = history.find((h) => h.name.toLowerCase().startsWith(name.toLowerCase()));
      if (!entry) return null;
      // Lichess sends points as [year, month, day, rating]; month is treated as 0-based, like JS Date.
      const all = entry.points.map(([y, m, d, r]) => ({ t: new Date(y, m, d).getTime(), r }));
      const before = all.filter((p) => p.t < t0).pop();
      const pts = all.filter((p) => p.t >= t0);
      if (before) pts.unshift({ t: t0, r: before.r });     // start the line at the left edge
      if (!pts.length) return null;
      pts.push({ t: now, r: pts[pts.length - 1].r });     // rating holds until the next game
      return { name: entry.name, pts };
    }).filter(Boolean).slice(0, 3);
    if (!series.length) return null;

    const W = 320, H = 180, L = 36, R = 6, T = 8, B = 22;
    const ratings = series.flatMap((s) => s.pts.map((p) => p.r));
    let lo = Math.floor(Math.min(...ratings) / 50) * 50;
    let hi = Math.ceil(Math.max(...ratings) / 50) * 50;
    if (lo === hi) { lo -= 50; hi += 50; }
    const x = (t) => L + ((t - t0) / (now - t0)) * (W - L - R);
    const y = (r) => T + ((hi - r) / (hi - lo)) * (H - T - B);

    const ticks = [lo, Math.round((lo + hi) / 2), hi];
    const summary = series.map((s) => `${s.name} from ${s.pts[0].r} to ${s.pts[s.pts.length - 1].r}`).join(", ");

    const chart = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `Rating over the last ${months} months: ${summary}.` },
      ticks.map((r) => [
        svg("line", { class: "gl", x1: L, x2: W - R, y1: y(r), y2: y(r) }),
        svg("text", { x: L - 6, y: y(r) + 3.5, "text-anchor": "end" }, String(r))
      ]),
      svg("text", { x: L, y: H - 6 }, monthFmt.format(start)),
      svg("text", { x: W - R, y: H - 6, "text-anchor": "end" }, "Now"),
      series.map((s, i) => svg("path", {
        class: "series series-" + i,
        d: s.pts.map((p, j) => (j ? "L" : "M") + x(p.t).toFixed(1) + " " + y(p.r).toFixed(1)).join(" ")
      })));

    return { chart, series };
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
      clickToLoad(box, { src: card.src, title: card.title, provider: card.provider, glyph: cat.glyph });

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

    "lichess-history"(card) {
      const months = card.months || 12;
      const wanted = card.perfs || ["Rapid", "Blitz"];
      const box = el("div", { class: "card-media chart" }, el("p", { class: "embed-note", text: "Loading rating history…" }));
      const legend = el("ul", { class: "meta legend" });
      const desc = el("p", { class: "card-text", text: `The last ${months} months on Lichess.` });
      const user = encodeURIComponent(card.username);

      cachedJson(`https://lichess.org/api/user/${user}/rating-history`)
        .then((history) => {
          const result = ratingChart(history, wanted, months);
          if (!result) { box.replaceChildren(el("p", { class: "embed-note", text: "No rated games in this period yet." })); return; }
          box.replaceChildren(result.chart);
          legend.replaceChildren(...result.series.map((s, i) => {
            const first = s.pts[0].r, last = s.pts[s.pts.length - 1].r;
            return el("li", null, el("span", { class: "swatch swatch-" + i, "aria-hidden": "true" }), `${s.name} ${first} → ${last}`);
          }));
        })
        .catch(() => {
          box.replaceChildren(el("p", { class: "embed-note", text: "Set your Lichess username in data.js to show the chart." }));
        });

      return el("article", { class: "card card--chart" },
        box,
        el("div", { class: "card-body" },
          el("h3", null, titleLink("Rating history", "https://lichess.org/@/" + user)),
          desc, legend));
    },

    "lichess-game"(card, cat) {
      const user = encodeURIComponent(card.username);
      const placeholder = (text) => el("div", { class: "cv-placeholder" },
        el("span", { class: "plate-glyph", "aria-hidden": "true", text: cat.glyph }),
        el("p", { class: "embed-note", text }));
      const box = el("div", { class: "card-media cv-media" }, placeholder("Looking up my latest game…"));
      const heading = el("h3", { text: "Most recent game" });
      const desc = el("p", { class: "card-text" });
      const meta = el("ul", { class: "meta" });
 
      cachedJson(`https://lichess.org/api/games/user/${user}?max=1&clocks=true&opening=true`, 10 * 60 * 1000,
        { accept: "application/x-ndjson", ndjson: true })
        .then(([g]) => {
          if (!g) throw new Error("No games found");
          const me = card.username.toLowerCase();
          const myColor = g.players.white.user && g.players.white.user.id === me ? "white" : "black";
          const opp = g.players[myColor === "white" ? "black" : "white"];
          const oppName = opp.user ? opp.user.name : opp.aiLevel ? "Stockfish level " + opp.aiLevel : "an anonymous player";
          const result = g.status === "aborted" ? "Aborted" : !g.winner ? "Draw" : g.winner === myColor ? "Won" : "Lost";
          const gameUrl = "https://lichess.org/" + g.id;
 
          heading.replaceChildren(titleLink("Most recent game", gameUrl));
          desc.textContent = `${cap(g.speed)} as ${myColor} against ${oppName}${opp.rating ? " (" + opp.rating + ")" : ""}.`;
          meta.replaceChildren(
            el("li", { text: result }),
            g.opening ? el("li", { text: g.opening.name }) : "",
            el("li", { text: relDate(g.lastMoveAt || g.createdAt) }));
 
          // Chess960 and other variants use different rules; those link to Lichess instead.
          if (!window.ChessViewer || !["standard", "fromPosition"].includes(g.variant)) {
            box.replaceChildren(placeholder("This variant can't be shown here. Open the game on Lichess."));
            return;
          }
          try {
            box.replaceChildren(window.ChessViewer.create({
              moves: (g.moves || "").split(" ").filter(Boolean),
              clocks: g.clocks,
              clock: g.clock,
              fen: g.initialFen,
              orientation: myColor
            }));
          } catch (err) {
            console.warn(err);
            box.replaceChildren(placeholder("This game couldn't be replayed here. Open it on Lichess."));
          }
        })
        .catch(() => box.replaceChildren(placeholder("Set your Lichess username in data.js to show your latest game.")));
 
      return el("article", { class: "card card--game" },
        box,
        el("div", { class: "card-body" }, heading, desc, meta));
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
    document.title = o.name + " – interests and hobbies";
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