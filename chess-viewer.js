/*
  Minimal chess game viewer: replays a list of SAN moves on a board drawn with
  Unicode pieces. No libraries and no external requests.
  Browser: window.ChessViewer.create({...}) returns a DOM element.
  Node (tests): module.exports = { replay, applySan, parseFen, plan }.
*/
(function (root) {
  "use strict";

  const FILES = "abcdefgh";
  const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w";

  // Board: 64 cells, index = rank * 8 + file, a1 = 0, h8 = 63. Pieces look like "wN", "bP".
  function parseFen(fen) {
    const board = new Array(64).fill(null);
    const [placement, turn] = (fen || START).split(" ");
    placement.split("/").forEach((row, i) => {
      let file = 0;
      const rank = 7 - i;
      for (const ch of row) {
        if (/\d/.test(ch)) { file += Number(ch); continue; }
        board[rank * 8 + file] = (ch === ch.toUpperCase() ? "w" : "b") + ch.toUpperCase();
        file++;
      }
    });
    return { board, turn: turn === "b" ? "b" : "w", from: -1, to: -1 };
  }

  const square = (s) => FILES.indexOf(s[0]) + (Number(s[1]) - 1) * 8;
  const fileOf = (i) => i % 8;
  const rankOf = (i) => Math.floor(i / 8);
  function step(i, df, dr) {
    const f = fileOf(i) + df, r = rankOf(i) + dr;
    return f >= 0 && f < 8 && r >= 0 && r < 8 ? r * 8 + f : -1;
  }

  const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  const KING = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const ROOK = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const BISHOP = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

  // Squares holding a piece of `color`+`type` that could move to `to` (pins ignored).
  function origins(board, to, color, type) {
    const want = color + type, out = [];
    const jump = (dirs) => dirs.forEach(([df, dr]) => {
      const s = step(to, df, dr);
      if (s >= 0 && board[s] === want) out.push(s);
    });
    const slide = (dirs) => dirs.forEach(([df, dr]) => {
      for (let s = step(to, df, dr); s >= 0; s = step(s, df, dr)) {
        if (board[s]) { if (board[s] === want) out.push(s); break; }
      }
    });
    if (type === "N") jump(KNIGHT);
    else if (type === "K") jump(KING);
    else if (type === "R") slide(ROOK);
    else if (type === "B") slide(BISHOP);
    else if (type === "Q") slide(ROOK.concat(BISHOP));
    return out;
  }

  function attacked(board, target, by) {
    const back = by === "w" ? -1 : 1; // an attacking pawn stands one rank "behind" the target
    for (const df of [-1, 1]) {
      const s = step(target, df, back);
      if (s >= 0 && board[s] === by + "P") return true;
    }
    return ["N", "K", "R", "B", "Q"].some((t) => origins(board, target, by, t).length > 0);
  }

  function applySan(pos, san) {
    const board = pos.board.slice();
    const c = pos.turn, opp = c === "w" ? "b" : "w";
    let s = san.replace(/[+#?!]/g, "");

    if (/^(O-O(-O)?|0-0(-0)?)$/.test(s)) {
      const long = s.length > 3, r = c === "w" ? 0 : 7;
      const k = r * 8 + 4, kTo = r * 8 + (long ? 2 : 6);
      const rook = r * 8 + (long ? 0 : 7), rookTo = r * 8 + (long ? 3 : 5);
      board[kTo] = board[k]; board[k] = null;
      board[rookTo] = board[rook]; board[rook] = null;
      return { board, turn: opp, from: k, to: kTo };
    }

    let promo = null;
    const pm = /^[a-h]/.test(s) && s.match(/=?([QRBN])$/);
    if (pm) { promo = pm[1]; s = s.slice(0, pm.index); }

    const type = /^[KQRBN]/.test(s) ? s[0] : "P";
    const body = type === "P" ? s : s.slice(1);
    const capture = body.includes("x");
    const clean = body.replace("x", "");
    const to = square(clean.slice(-2));
    const hint = clean.slice(0, -2); // disambiguation: "b", "1", "b1" or ""
    let from;

    if (type === "P") {
      const dir = c === "w" ? 1 : -1;
      if (capture) {
        from = FILES.indexOf(hint[0]) + (rankOf(to) - dir) * 8;
        if (!board[to]) board[to - dir * 8] = null; // en passant
      } else {
        from = board[to - dir * 8] === c + "P" ? to - dir * 8 : to - dir * 16;
      }
      if (board[from] !== c + "P") throw new Error("Cannot read move " + san);
      board[to] = promo ? c + promo : board[from];
      board[from] = null;
    } else {
      let cands = origins(board, to, c, type).filter((o) => [...hint].every((ch) =>
        /[a-h]/.test(ch) ? FILES[fileOf(o)] === ch : rankOf(o) === Number(ch) - 1));
      if (cands.length > 1) {
        // SAN leaves out the hint when the other piece is pinned
        cands = cands.filter((o) => {
          const b = board.slice();
          b[to] = b[o]; b[o] = null;
          return !attacked(b, b.indexOf(c + "K"), opp);
        });
      }
      if (cands.length !== 1) throw new Error("Cannot read move " + san);
      from = cands[0];
      board[to] = board[from];
      board[from] = null;
    }
    return { board, turn: opp, from, to };
  }

  function replay(moves, fen) {
    const out = [parseFen(fen)];
    for (const m of moves) out.push(applySan(out[out.length - 1], m));
    return out;
  }

  /* ---------- animation plan (pure, testable) ---------- */

  // Works out how to get from one board to the next: which pieces stay, which slide
  // (from -> to), which fade in and which fade out. Matching pieces by type and distance
  // also covers castling, captures, en passant, promotion and jumps of many moves.
  function plan(prev, next) {
    const keep = [], vanished = [], appeared = [];
    for (let i = 0; i < 64; i++) {
      if (prev[i] && prev[i] === next[i]) keep.push(i);
      else {
        if (prev[i]) vanished.push(i);
        if (next[i]) appeared.push(i);
      }
    }
    const dist = (a, b) => Math.max(Math.abs(fileOf(a) - fileOf(b)), Math.abs(rankOf(a) - rankOf(b)));
    const take = (to, ok) => {
      let best = -1;
      vanished.forEach((v, k) => {
        if (ok(prev[v]) && (best < 0 || dist(v, to) < dist(vanished[best], to))) best = k;
      });
      return best < 0 ? -1 : vanished.splice(best, 1)[0];
    };
    const moves = [], adds = [], pending = [];
    for (const to of appeared) {                        // same piece moved
      const from = take(to, (p) => p === next[to]);
      if (from >= 0) moves.push([from, to]); else pending.push(to);
    }
    for (const to of pending) {                         // pawn promoted (or un-promoted going back)
      const p = next[to];
      const from = take(to, (q) => q[0] === p[0] && (q[1] === "P" || p[1] === "P"));
      if (from >= 0) moves.push([from, to]); else adds.push(to);
    }
    return { keep, moves, adds, removes: vanished };
  }

  /* ---------- browser view ---------- */

  const GLYPH = { K: "\u265A", Q: "\u265B", R: "\u265C", B: "\u265D", N: "\u265E", P: "\u265F" };
  const TEXT = "\uFE0E"; // keeps iOS from drawing emoji
  const FADE_MS = 220;   // a bit longer than the CSS transition
  const SVGNS = "http://www.w3.org/2000/svg";

  // Small circle with a fixed fill; only the outline follows the text colour.
  function dot(fill) {
    const svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("viewBox", "0 0 10 10");
    svg.setAttribute("class", "cv-dot");
    svg.setAttribute("aria-hidden", "true");
    const c = document.createElementNS(SVGNS, "circle");
    c.setAttribute("cx", "5");
    c.setAttribute("cy", "5");
    c.setAttribute("r", "4.25");
    c.setAttribute("fill", fill);
    c.setAttribute("stroke", "currentColor");
    c.setAttribute("stroke-width", "1.5");
    svg.append(c);
    return svg;
  }

  const clockText = (cs) => {
    const sec = Math.max(0, Math.round(cs / 100));
    return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
  };

  function create({ moves, clocks, clock, fen, orientation = "white" }) {
    const positions = replay(moves, fen);
    const offset = positions[0].turn === "b" ? 1 : 0; // game started with black to move
    let ply = positions.length - 1;                     // open on the final position

    const make = (tag, cls, text) => {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      return n;
    };

    const rootEl = make("div", "cv");
    rootEl.tabIndex = 0;
    rootEl.setAttribute("aria-label", "Game viewer. Left and right arrow keys step through the moves.");

    // Two layers: 64 fixed squares (colours, last-move highlight) and the pieces on top.
    const boardEl = make("div", "cv-board cv-static");
    boardEl.setAttribute("role", "img");
    const cells = [];
    for (let d = 0; d < 64; d++) {
      const row = Math.floor(d / 8), col = d % 8;
      const idx = orientation === "white" ? (7 - row) * 8 + col : row * 8 + (7 - col);
      const cell = make("div", "cv-sq " + ((fileOf(idx) + rankOf(idx)) % 2 ? "light" : "dark"));
      cells[idx] = cell;
      boardEl.append(cell);
    }
    const layer = make("div", "cv-pieces");
    layer.setAttribute("aria-hidden", "true");
    boardEl.append(layer);

    const prev = make("button", "cv-btn", "\u25C0" + TEXT);
    const next = make("button", "cv-btn", "\u25B6" + TEXT);
    prev.type = next.type = "button";
    prev.setAttribute("aria-label", "Previous move");
    next.setAttribute("aria-label", "Next move");
    const status = make("p", "cv-status");
    status.setAttribute("aria-live", "polite");
    const bar = make("div", "cv-bar");
    bar.append(prev, status, next);
    rootEl.append(boardEl, bar);

    // Pieces are positioned with translate(), so moving one is a smooth CSS transition.
    function place(el, i) {
      const col = orientation === "white" ? fileOf(i) : 7 - fileOf(i);
      const row = orientation === "white" ? 7 - rankOf(i) : rankOf(i);
      el.style.transform = `translate(${col * 100}%, ${row * 100}%)`;
    }
    function dress(el, piece) {
      el.textContent = GLYPH[piece[1]] + TEXT;
      el.classList.toggle("cv-w", piece[0] === "w");
      el.classList.toggle("cv-b", piece[0] === "b");
    }

    let shown = new Array(64).fill(null);  // board currently drawn
    let els = new Array(64).fill(null);    // square -> piece element
    let lifted = [];

    function draw(board) {
      const { keep, moves: slides, adds, removes } = plan(shown, board);
      const nextEls = new Array(64).fill(null);
      lifted.forEach((el) => { el.style.zIndex = ""; });
      lifted = [];
      keep.forEach((i) => { nextEls[i] = els[i]; });
      slides.forEach(([from, to]) => {
        const el = els[from];
        dress(el, board[to]);
        el.style.zIndex = "2";             // slide over a piece that is being captured
        lifted.push(el);
        place(el, to);
        nextEls[to] = el;
      });
      removes.forEach((i) => {
        const el = els[i];
        el.classList.add("cv-gone");
        setTimeout(() => el.remove(), FADE_MS);
      });
      const fadeIn = shown.some(Boolean);  // no fade on the very first drawing
      adds.forEach((i) => {
        const el = make("span", fadeIn ? "cv-piece cv-gone" : "cv-piece");
        dress(el, board[i]);
        place(el, i);
        layer.append(el);
        if (fadeIn) requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove("cv-gone")));
        nextEls[i] = el;
      });
      shown = board;
      els = nextEls;
    }

    // Clock left for each player after `p` moves, in centiseconds (null for untimed games).
    function clocksAt(p) {
      if (!clocks || !clock) return null;
      const left = { w: clock.initial * 100, b: clock.initial * 100 };
      for (let i = 0; i < p && i < clocks.length; i++) left[(i + offset) % 2 ? "b" : "w"] = clocks[i];
      return left;
    }

    function label(i) {
      const n = i + offset;
      return Math.floor(n / 2) + 1 + (n % 2 ? "\u2026 " : ". ") + moves[i];
    }

    function render() {
      const pos = positions[ply];
      draw(pos.board);
      for (let i = 0; i < 64; i++) cells[i].classList.toggle("last", i === pos.from || i === pos.to);
      status.replaceChildren(make("strong", null, ply === 0 ? "Start" : label(ply - 1)));
      const left = clocksAt(ply);
      if (left) {
        for (const [side, fill, name] of [["w", "#fbfbf7", "White"], ["b", "#1b1d18", "Black"]]) {
          const c = make("span", "cv-clock");
          c.append(dot(fill), make("span", "cv-sr", name + " "), clockText(left[side]));
          status.append(c);
        }
      }
      boardEl.setAttribute("aria-label", ply === 0 ? "Start position" : "Position after " + label(ply - 1));
      prev.disabled = ply === 0;
      next.disabled = ply === positions.length - 1;
    }

    const go = (p) => { ply = Math.max(0, Math.min(positions.length - 1, p)); render(); };
    prev.addEventListener("click", () => go(ply - 1));
    next.addEventListener("click", () => go(ply + 1));
    rootEl.addEventListener("keydown", (e) => {
      const keys = { ArrowLeft: ply - 1, ArrowRight: ply + 1, Home: 0, End: positions.length - 1 };
      if (e.key in keys) { e.preventDefault(); go(keys[e.key]); }
    });

    render();
    // First drawing appears instantly; animations start with the first step.
    requestAnimationFrame(() => requestAnimationFrame(() => boardEl.classList.remove("cv-static")));
    return rootEl;
  }

  const api = { create, replay, applySan, parseFen, plan };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ChessViewer = api;
})(typeof window !== "undefined" ? window : globalThis);