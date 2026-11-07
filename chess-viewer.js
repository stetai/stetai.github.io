/*
  Minimal chess game viewer: replays a list of SAN moves on a board drawn with
  Unicode pieces. No libraries and no external requests.
  Browser: window.ChessViewer.create({...}) returns a DOM element.
  Node (tests): module.exports = { replay, applySan, parseFen }.
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

  /* ---------- browser view ---------- */

  const GLYPH = { K: "\u265A", Q: "\u265B", R: "\u265C", B: "\u265D", N: "\u265E", P: "\u265F" };
  const TEXT = "\uFE0E"; // keeps iOS from drawing emoji

  const clockText = (cs) => {
    const sec = Math.max(0, Math.round(cs / 100));
    return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
  };
  const spentText = (cs) => (cs < 6000 ? (cs / 100).toFixed(1) + " s" : clockText(cs));

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

    const boardEl = make("div", "cv-board");
    boardEl.setAttribute("role", "img");
    const cells = [];
    for (let d = 0; d < 64; d++) {
      const row = Math.floor(d / 8), col = d % 8;
      const idx = orientation === "white" ? (7 - row) * 8 + col : row * 8 + (7 - col);
      const cell = make("div", "cv-sq " + ((fileOf(idx) + rankOf(idx)) % 2 ? "light" : "dark"));
      cells[idx] = cell;
      boardEl.append(cell);
    }

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

    // Time spent on move i (0-based ply), from the clock left after each move, in centiseconds.
    function spent(i) {
      if (!clocks || clocks[i] == null || !clock) return null;
      const before = i >= 2 ? clocks[i - 2] : clock.initial * 100;
      const inc = i >= 2 ? clock.increment * 100 : 0;
      return Math.max(0, before + inc - clocks[i]);
    }

    function label(i) {
      const n = i + offset;
      return Math.floor(n / 2) + 1 + (n % 2 ? "\u2026 " : ". ") + moves[i];
    }

    function render() {
      const pos = positions[ply];
      for (let i = 0; i < 64; i++) {
        const p = pos.board[i];
        const cell = cells[i];
        cell.textContent = p ? GLYPH[p[1]] + TEXT : "";
        cell.classList.toggle("cv-w", !!p && p[0] === "w");
        cell.classList.toggle("cv-b", !!p && p[0] === "b");
        cell.classList.toggle("last", i === pos.from || i === pos.to);
      }
      status.replaceChildren();
      if (ply === 0) {
        status.textContent = "Start position";
      } else {
        const strong = make("strong", null, label(ply - 1));
        status.append(strong);
        const t = spent(ply - 1);
        if (t != null) status.append("  " + spentText(t) + ", " + clockText(clocks[ply - 1]) + " left");
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
    return rootEl;
  }

  const api = { create, replay, applySan, parseFen };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ChessViewer = api;
})(typeof window !== "undefined" ? window : globalThis);