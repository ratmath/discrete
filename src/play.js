// Combinatorial games and games in extensive form.
//
// Impartial games (both players have the same moves) are solved by
// Sprague–Grundy values: a position's value is the least whole number not
// among its options' values, a position is lost for the player to move
// exactly when its value is 0, and the value of a sum of games is the
// nim-sum (exclusive or) of the values.
//
// Partizan games (Left and Right have different moves) are Conway's games
// {L | R}, kept in canonical form: dominated options removed and reversible
// ones bypassed, so two games are equal exactly when their canonical forms are
// identical. Numbers, nimbers and ↑ are recognised and printed by name.
//
// Games in extensive form are trees with players, chance and payoffs, solved
// by backward induction, with ties reported rather than broken silently.

import { Rational } from "@ratmath/core";
import { refuse } from "./counting.js";
import { exact } from "./lp.js";

// ---- impartial games ------------------------------------------------------------------------------

/** The least whole number not in the list. */
export function mex(values) {
  const s = new Set(values);
  let m = 0;
  while (s.has(m)) m++;
  return m;
}

/**
 * An impartial game from its rule: moves(position) → the positions reachable
 * in one move. Positions are compared by key(position) (JSON by default).
 *   game.grundy(p), game.isLoss(p) (the player to move loses), game.winningMoves(p)
 * Values are remembered, so a whole family of positions costs one pass.
 */
export function impartialGame(moves, { key = (p) => JSON.stringify(p) } = {}) {
  const memo = new Map();
  const grundy = (p) => {
    const k = key(p);
    if (memo.has(k)) {
      const v = memo.get(k);
      if (v === null) refuse("loopy", "the game can return to a position, so Grundy values are not defined here");
      return v;
    }
    memo.set(k, null);
    const v = mex(moves(p).map(grundy));
    memo.set(k, v);
    return v;
  };
  return Object.freeze({
    grundy,
    isLoss: (p) => grundy(p) === 0,
    /** The moves to a position of value 0 (empty when p itself is lost). */
    winningMoves: (p) => moves(p).filter((q) => grundy(q) === 0),
    moves,
  });
}

/**
 * Nim: the value of heaps is their nim-sum; the winning moves take a heap h
 * down to h ⊕ s where s is the nim-sum.
 *   { nimSum, losing, winningMoves: [{ heap, from, to }] }
 */
export function nim(heaps) {
  const hs = heaps.map((h) => {
    const b = BigInt(h);
    if (b < 0n) refuse("bad-argument", "a heap is not negative");
    return b;
  });
  const s = hs.reduce((a, b) => a ^ b, 0n);
  const winningMoves = [];
  if (s) hs.forEach((h, i) => {
    const t = h ^ s;
    if (t < h) winningMoves.push({ heap: i, from: h, to: t });
  });
  return Object.freeze({ nimSum: s, losing: s === 0n, winningMoves });
}

/**
 * A subtraction game: from a heap of n, remove any amount in S. The Grundy
 * values from 0 up to `length` − 1, and the period they settle into (found
 * when the values repeat over a window as long as the largest move, which
 * proves the period from then on).
 *   { values, period: { start, length } | null }
 */
export function subtractionGame(S, length = 60) {
  const moves = [...new Set(S.map(Number))].filter((x) => x > 0).sort((a, b) => a - b);
  if (!moves.length) refuse("bad-argument", "a subtraction game needs a positive move");
  const values = [];
  for (let n = 0; n < length; n++) values.push(mex(moves.filter((m) => m <= n).map((m) => values[n - m])));
  const w = moves[moves.length - 1];
  let period = null;
  outer: for (let p = 1; p <= length / 2; p++) for (let s = 0; s + p + w <= length; s++) {
    let ok = true;
    for (let i = s; i + p < length; i++) if (values[i] !== values[i + p]) {
      ok = false;
      break;
    }
    if (ok && length - s >= p + w) {
      period = { start: s, length: p };
      break outer;
    }
  }
  return Object.freeze({ values, period });
}

// ---- partizan games ---------------------------------------------------------------------------------

const canonCache = new Map(); // key → Game
let idCounter = 0;

/**
 * A partizan game {L | R}, canonical. Build with `cgame(left, right)`, where
 * left and right are lists of games (or numbers, which are turned into the
 * games they name), or with the constants in `Game`.
 */
export class Game {
  constructor(L, R, key) {
    this.L = L;
    this.R = R;
    this.key = key;
    this.id = idCounter++;
    Object.freeze(this);
  }
  /** G ≤ H: no Left option of G is ≥ H, and no Right option of H is ≤ G. */
  le(h) {
    return le(this, cg(h));
  }
  ge(h) {
    return le(cg(h), this);
  }
  equals(h) {
    return this === cg(h);
  }
  /** Compare: "<", ">", "=" or "‖" (confused with: neither ≤ nor ≥). */
  compare(h) {
    const H = cg(h);
    const a = le(this, H);
    const b = le(H, this);
    return a && b ? "=" : a ? "<" : b ? ">" : "‖";
  }
  /** Who wins: "Left" (Left wins whoever starts, G > 0), "Right" (G < 0), "second" (G = 0), "first" (G ‖ 0). */
  get outcome() {
    const c = this.compare(ZERO_G);
    return c === ">" ? "Left" : c === "<" ? "Right" : c === "=" ? "second player" : "first player";
  }
  add(h) {
    return add(this, cg(h));
  }
  negate() {
    return neg(this);
  }
  subtract(h) {
    return add(this, neg(cg(h)));
  }
  /** The value as a dyadic Rational when the game is a number, else null. */
  get number() {
    return numberOf(this);
  }
  /** n when the game is the nimber *n, else null. */
  get nimber() {
    return nimberOf(this);
  }
  toString() {
    return nameOf(this);
  }
}

const keyOf = (L, R) => `{${L.map((g) => g.id).sort((a, b) => a - b).join(",")}|${R.map((g) => g.id).sort((a, b) => a - b).join(",")}}`;
const raw = (L, R) => {
  const k = keyOf(L, R);
  if (!canonCache.has(k)) canonCache.set(k, new Game(L, R, k));
  return canonCache.get(k);
};

const leMemo = new Map();
function le(G, H) {
  if (G === H) return true;
  const k = `${G.id}<=${H.id}`;
  if (leMemo.has(k)) return leMemo.get(k);
  const v = !G.L.some((gl) => le(H, gl)) && !H.R.some((hr) => le(hr, G));
  leMemo.set(k, v);
  return v;
}

/** The canonical form of {L | R} with canonical options. */
function canonical(L0, R0) {
  let L = dedupe(L0);
  let R = dedupe(R0);
  for (let changed = true; changed; ) {
    changed = false;
    // dominated
    const L2 = L.filter((a, i) => !L.some((b, j) => j !== i && le(a, b) && (!le(b, a) || j < i)));
    const R2 = R.filter((a, i) => !R.some((b, j) => j !== i && le(b, a) && (!le(a, b) || j < i)));
    if (L2.length !== L.length || R2.length !== R.length) changed = true;
    L = L2;
    R = R2;
    // reversible: a Left option A with some Right option A^R ≤ G is replaced by A^R's Left options
    const G = raw(L, R);
    const L3 = [];
    for (const a of L) {
      const rev = a.R.find((ar) => le(ar, G));
      if (rev) {
        L3.push(...rev.L);
        changed = true;
      } else L3.push(a);
    }
    const R3 = [];
    for (const b of R) {
      const rev = b.L.find((bl) => le(G, bl));
      if (rev) {
        R3.push(...rev.R);
        changed = true;
      } else R3.push(b);
    }
    L = dedupe(L3);
    R = dedupe(R3);
  }
  return raw(L, R);
}
const dedupe = (xs) => [...new Map(xs.map((g) => [g.id, g])).values()];

const ZERO_G = raw([], []);
const STAR = canonical([ZERO_G], [ZERO_G]);

/** A game from a number (whole or dyadic: 1/2, 3/4, …), or the game itself. */
function cg(x) {
  if (x instanceof Game) return x;
  return numberGame(exact(x, "number"));
}
const numberMemo = new Map();
function numberGame(q) {
  const k = String(q);
  if (numberMemo.has(k)) return numberMemo.get(k);
  let g;
  const d = q.denominator;
  if ((d & (d - 1n)) !== 0n) refuse("bad-argument", `only dyadic rationals (denominator a power of 2) are short games; ${q} is not`);
  if (d === 1n) {
    const n = q.numerator;
    if (n === 0n) g = ZERO_G;
    else if (n > 0n) g = canonical([numberGame(new Rational(n - 1n))], []);
    else g = canonical([], [numberGame(new Rational(n + 1n))]);
  } else {
    // m/2^k = { (m−1)/2^k | (m+1)/2^k }
    const half = new Rational(1n, d);
    g = canonical([numberGame(q.subtract(half))], [numberGame(q.add(half))]);
  }
  numberMemo.set(k, g);
  return g;
}

/** {left | right}, in canonical form. */
export function cgame(left = [], right = []) {
  return canonical(left.map(cg), right.map(cg));
}
/** *n: the nimber, {0, *, …, *(n−1) | 0, *, …, *(n−1)}. */
export function star(n = 1) {
  const opts = [];
  for (let i = 0; i < n; i++) opts.push(i === 0 ? ZERO_G : star(i));
  return canonical(opts, opts);
}
export const up = () => canonical([ZERO_G], [STAR]);
export const down = () => canonical([STAR], [ZERO_G]);

const addMemo = new Map();
function add(G, H) {
  const k = `${Math.min(G.id, H.id)}+${Math.max(G.id, H.id)}`;
  if (addMemo.has(k)) return addMemo.get(k);
  const L = [...G.L.map((gl) => add(gl, H)), ...H.L.map((hl) => add(G, hl))];
  const R = [...G.R.map((gr) => add(gr, H)), ...H.R.map((hr) => add(G, hr))];
  const v = canonical(L, R);
  addMemo.set(k, v);
  return v;
}
const negMemo = new Map();
function neg(G) {
  if (negMemo.has(G.id)) return negMemo.get(G.id);
  const v = canonical(G.R.map(neg), G.L.map(neg));
  negMemo.set(G.id, v);
  return v;
}

function numberOf(G) {
  // canonical numbers: {} = 0, {n−1|} = n, {|n+1} = n, {a|b} with a < b both numbers, b − a = 1/2^k
  if (!G.L.length && !G.R.length) return new Rational(0n);
  const Ln = G.L.map(numberOf);
  const Rn = G.R.map(numberOf);
  if (Ln.some((x) => x === null) || Rn.some((x) => x === null)) return null;
  if (G.L.length > 1 || G.R.length > 1) return null;
  const l = Ln[0];
  const r = Rn[0];
  if (l && !r) return l.add(new Rational(1n));
  if (r && !l) return r.subtract(new Rational(1n));
  if (!l.lessThan(r)) return null;
  const mid = l.add(r).divide(new Rational(2n));
  return numberGame(mid) === G ? mid : null;
}
function nimberOf(G) {
  if (G === ZERO_G) return 0;
  const n = G.L.length;
  if (G.R.length !== n) return null;
  return star(n) === G ? n : null;
}
function nameOf(G) {
  const q = numberOf(G);
  if (q) return String(q);
  const n = nimberOf(G);
  if (n !== null) return n === 1 ? "*" : `*${n}`;
  if (G === up()) return "↑";
  if (G === down()) return "↓";
  if (G === add(up(), STAR)) return "↑*";
  if (G === add(down(), STAR)) return "↓*";
  if (G === add(up(), up())) return "⇑";
  if (G === add(down(), down())) return "⇓";
  return `{${G.L.map(nameOf).join(", ")} | ${G.R.map(nameOf).join(", ")}}`;
}
Object.defineProperties(Game, {
  zero: { get: () => ZERO_G },
  star: { get: () => STAR },
});

/**
 * Build a partizan game from a position and two move rules, recursively:
 * partizanGame(p, leftMoves, rightMoves) with leftMoves(p) → positions.
 * Positions are remembered by key (JSON by default).
 */
export function partizanGame(position, leftMoves, rightMoves, { key = (p) => JSON.stringify(p) } = {}) {
  const memo = new Map();
  const go = (p) => {
    const k = key(p);
    if (memo.has(k)) {
      if (memo.get(k) === null) refuse("loopy", "the game can return to a position");
      return memo.get(k);
    }
    memo.set(k, null);
    const g = canonical(leftMoves(p).map(go), rightMoves(p).map(go));
    memo.set(k, g);
    return g;
  };
  return go(position);
}

// ---- games in extensive form ------------------------------------------------------------------------------

/**
 * Backward induction on a game tree with perfect information.
 * A node is one of
 *   { payoff: { A: 3, B: 1 } }                       a leaf
 *   { player: "A", moves: { left: node, right: node } }
 *   { chance: [{ p: "1/3", node, label? }, …] }      probabilities add to 1
 * Payoffs and probabilities are exact rationals.
 *   { value: { player: Rational }, plan: [{ path, player, choice, ties }], path }
 * `plan` gives every decision node's choice (a subgame perfect equilibrium);
 * `ties` lists other moves with the same payoff to the mover, when there are
 * any, and the first is taken. `path` is the play that results when chance
 * nodes are followed by their first branch.
 */
export function backwardInduction(tree) {
  const plan = [];
  const solve = (node, path) => {
    if (node.payoff) return Object.fromEntries(Object.entries(node.payoff).map(([k, v]) => [k, exact(v, "payoff")]));
    if (node.chance) {
      const total = node.chance.reduce((s, b) => s.add(exact(b.p, "probability")), new Rational(0n));
      if (!total.equals(new Rational(1n))) refuse("bad-argument", `chance probabilities at ${path.join(" → ") || "the root"} add to ${total}, not 1`);
      const acc = {};
      node.chance.forEach((b, i) => {
        const v = solve(b.node, [...path, b.label ?? `chance ${i + 1}`]);
        const p = exact(b.p, "probability");
        for (const [k, x] of Object.entries(v)) acc[k] = (acc[k] ?? new Rational(0n)).add(x.multiply(p));
      });
      return acc;
    }
    if (!node.player || !node.moves) refuse("bad-argument", "a node is { payoff }, { player, moves } or { chance }");
    const options = Object.entries(node.moves).map(([label, child]) => ({ label, value: solve(child, [...path, label]) }));
    const mine = (o) => o.value[node.player] ?? new Rational(0n);
    let best = options[0];
    for (const o of options) if (mine(o).greaterThan(mine(best))) best = o;
    const ties = options.filter((o) => o !== best && mine(o).equals(mine(best))).map((o) => o.label);
    plan.push(Object.freeze({ path, player: node.player, choice: best.label, ties }));
    return best.value;
  };
  const value = solve(tree, []);
  // the equilibrium path
  const play = [];
  let node = tree;
  let path = [];
  while (node && !node.payoff) {
    if (node.chance) {
      const b = node.chance[0];
      path = [...path, b.label ?? "chance 1"];
      play.push(path[path.length - 1]);
      node = b.node;
      continue;
    }
    const step = plan.find((s) => s.path.join("\u0000") === path.join("\u0000"));
    play.push(step.choice);
    path = [...path, step.choice];
    node = node.moves[step.choice];
  }
  return Object.freeze({ value, plan: plan.reverse(), path: play });
}
