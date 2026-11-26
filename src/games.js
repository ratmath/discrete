// Matrix games and bimatrix games, solved exactly.
//
// A two-player zero-sum game is solved by one linear program: its optimal
// mixed strategies and its value are rationals, and the dual of the row
// player's program is the column player's. A bimatrix game (each player with
// their own payoffs) can have several equilibria; support enumeration finds
// all of them when the game is nondegenerate, and Lemke–Howson follows a
// path to one. Every equilibrium returned has been checked: no player gains by
// switching to any pure strategy.

import { Rational } from "@ratmath/core";
import { refuse } from "./counting.js";
import { combinations } from "./enumerate.js";
import { exact, linearProgram, solveSquare } from "./lp.js";

const ZERO = new Rational(0n);
const ONE = new Rational(1n);
const sgn = (r) => (r.numerator > 0n ? 1 : r.numerator < 0n ? -1 : 0);
const sum = (xs) => xs.reduce((a, b) => a.add(b), ZERO);
const maxOf = (xs) => xs.reduce((a, b) => (b.compareTo(a) > 0 ? b : a));
const minOf = (xs) => xs.reduce((a, b) => (b.compareTo(a) < 0 ? b : a));

function matrix(M, what) {
  if (!Array.isArray(M) || !M.length || !Array.isArray(M[0]) || !M[0].length) refuse("bad-game", `${what} must be a non-empty matrix (an array of rows)`);
  const n = M[0].length;
  if (M.some((r) => !Array.isArray(r) || r.length !== n)) refuse("bad-game", `the rows of ${what} must have equal lengths`);
  return M.map((r) => r.map((v) => exact(v, "payoff")));
}
const labels = (given, k, prefix) => (given ? [...given].map(String) : Array.from({ length: k }, (_, i) => `${prefix}${i + 1}`));
/** Row player's payoffs against a column mixture: (Aq)_i. */
const rowPayoffs = (A, q) => A.map((r) => sum(r.map((v, j) => v.multiply(q[j]))));
/** Column player's payoffs against a row mixture: (pB)_j. */
const colPayoffs = (B, p) => B[0].map((_, j) => sum(B.map((r, i) => r[j].multiply(p[i]))));
const strategy = (v, k) => {
  const s = v.map((x) => exact(x, "probability"));
  if (s.length !== k) refuse("bad-strategy", `a strategy here has ${k} entries`);
  if (s.some((x) => sgn(x) < 0) || !sum(s).equals(ONE)) refuse("bad-strategy", "a mixed strategy is non-negative and sums to 1");
  return s;
};
const fail = (why) => refuse("certificate-fails", why);

// ---- zero-sum games --------------------------------------------------------------

/**
 * Solve a two-player zero-sum game. A[i][j] is what the column player pays the
 * row player when row i meets column j.
 *
 *   matrixGame([[0, -1, 1], [1, 0, -1], [-1, 1, 0]])   // value 0, each plays 1/3, 1/3, 1/3
 */
export function matrixGame(A, { rows, columns } = {}) {
  const M = matrix(A, "the payoff matrix");
  const m = M.length;
  const n = M[0].length;
  const names = [...Array.from({ length: m }, (_, i) => `p${i + 1}`), "v"];
  // maximise v subject to (pA)_j ≥ v for every column, Σp = 1, p ≥ 0, v free
  const constraints = M[0].map((_, j) => [[...M.map((r) => r[j]), ONE.negate()], ">=", 0, `column ${j + 1}`]);
  constraints.push([[...M.map(() => ONE), ZERO], "=", 1, "total"]);
  const lp = linearProgram({ maximize: [...M.map(() => ZERO), ONE], constraints, names, free: ["v"] });
  if (lp.status !== "optimal") throw new Error("internal: a matrix game always has a value");
  const p = lp.x.slice(0, m);
  const q = lp.dual.slice(0, n).map((y) => y.negate());
  return new MatrixGameSolution(M, lp.value, p, q, labels(rows, m, "r"), labels(columns, n, "c"));
}

export class MatrixGameSolution {
  constructor(A, value, row, column, rowNames, columnNames) {
    this.payoffs = Object.freeze(A.map((r) => Object.freeze(r)));
    this.value = value;
    this.row = Object.freeze(row);
    this.column = Object.freeze(column);
    this.rowNames = Object.freeze(rowNames);
    this.columnNames = Object.freeze(columnNames);
    Object.freeze(this);
  }
  /** Is the game fair (value 0)? */
  get fair() {
    return sgn(this.value) === 0;
  }
  /** The row player's guarantee: the least the mixture p earns against any column. */
  guarantee(p = this.row) {
    return minOf(colPayoffs(this.payoffs, strategy(p, this.payoffs.length)));
  }
  /** The column player's cap: the most any row earns against the mixture q. */
  cap(q = this.column) {
    return maxOf(rowPayoffs(this.payoffs, strategy(q, this.payoffs[0].length)));
  }
  /** Both strategies are optimal: the row player's guarantee equals the column player's cap. */
  check() {
    const lo = this.guarantee();
    const hi = this.cap();
    if (!lo.equals(this.value) || !hi.equals(this.value)) fail(`the row player guarantees ${lo} and the column player caps at ${hi}, not both ${this.value}`);
    return true;
  }
  toString() {
    const mix = (s, names) => s.map((v, i) => (sgn(v) ? `${names[i]} ${v}` : null)).filter(Boolean).join(", ");
    return `value ${this.value}; row plays ${mix(this.row, this.rowNames)}; column plays ${mix(this.column, this.columnNames)}`;
  }
}

/** Pure saddle points: entries that are the least in their row and the greatest in their column. */
export function saddlePoints(A) {
  const M = matrix(A, "the payoff matrix");
  const out = [];
  M.forEach((r, i) =>
    r.forEach((v, j) => {
      if (v.equals(minOf(r)) && v.equals(maxOf(M.map((row) => row[j])))) out.push({ row: i, column: j, value: v });
    }),
  );
  return out;
}

// ---- bimatrix games --------------------------------------------------------------

/**
 * A two-player game in normal form. A[i][j] is the row player's payoff and
 * B[i][j] the column player's. With one matrix, B = −A (zero-sum).
 */
export function bimatrixGame(A, B, { rows, columns } = {}) {
  const MA = matrix(A, "the row player's payoffs");
  const MB = B === undefined ? MA.map((r) => r.map((v) => v.negate())) : matrix(B, "the column player's payoffs");
  if (MB.length !== MA.length || MB[0].length !== MA[0].length) refuse("bad-game", "the two payoff matrices must have the same shape");
  return new BimatrixGame(MA, MB, labels(rows, MA.length, "r"), labels(columns, MA[0].length, "c"));
}

export class BimatrixGame {
  constructor(A, B, rowNames, columnNames) {
    this.A = Object.freeze(A.map((r) => Object.freeze(r)));
    this.B = Object.freeze(B.map((r) => Object.freeze(r)));
    this.rowNames = Object.freeze(rowNames);
    this.columnNames = Object.freeze(columnNames);
    this.m = A.length;
    this.n = A[0].length;
    Object.freeze(this);
  }
  /** Expected payoffs { row, column } when the players use mixtures p and q. */
  payoffs(p, q) {
    p = strategy(p, this.m);
    q = strategy(q, this.n);
    return { row: sum(rowPayoffs(this.A, q).map((v, i) => v.multiply(p[i]))), column: sum(colPayoffs(this.B, p).map((v, j) => v.multiply(q[j]))) };
  }
  /** Each mixture is a best response to the other: no pure deviation gains. */
  isEquilibrium(p, q) {
    p = strategy(p, this.m);
    q = strategy(q, this.n);
    const u = rowPayoffs(this.A, q);
    const w = colPayoffs(this.B, p);
    const U = sum(u.map((v, i) => v.multiply(p[i])));
    const W = sum(w.map((v, j) => v.multiply(q[j])));
    return u.every((v) => v.compareTo(U) <= 0) && w.every((v) => v.compareTo(W) <= 0);
  }
  /** Equilibria in pure strategies. */
  pureEquilibria() {
    const out = [];
    for (let i = 0; i < this.m; i++)
      for (let j = 0; j < this.n; j++) {
        const bestRow = this.A.every((r) => r[j].compareTo(this.A[i][j]) <= 0);
        const bestCol = this.B[i].every((v) => v.compareTo(this.B[i][j]) <= 0);
        if (bestRow && bestCol) out.push(this.#equilibrium(unit(this.m, i), unit(this.n, j)));
      }
    return out;
  }
  /**
   * Remove strictly dominated strategies, round after round, until none is
   * left. A strategy is removed when some mixture of the player's remaining
   * strategies does strictly better against everything the opponent has left
   * (found by a linear program; `pureOnly` restricts to pure dominators).
   * Returns { rows, columns, steps } with the surviving indices and, for each
   * removal, who was removed and the mixture that dominates it.
   */
  dominance({ pureOnly = false } = {}) {
    let R = [...Array(this.m).keys()];
    let C = [...Array(this.n).keys()];
    const steps = [];
    for (let changed = true; changed; ) {
      changed = false;
      for (const i of R) {
        const by = dominator(R.filter((k) => k !== i).map((k) => C.map((j) => this.A[k][j])), C.map((j) => this.A[i][j]), pureOnly);
        if (by) {
          steps.push({ player: "row", removed: this.rowNames[i], by: Object.fromEntries(R.filter((k) => k !== i).map((k, t) => [this.rowNames[k], by[t]]).filter(([, v]) => sgn(v))) });
          R = R.filter((k) => k !== i);
          changed = true;
          break;
        }
      }
      if (changed) continue;
      for (const j of C) {
        const by = dominator(C.filter((k) => k !== j).map((k) => R.map((i) => this.B[i][k])), R.map((i) => this.B[i][j]), pureOnly);
        if (by) {
          steps.push({ player: "column", removed: this.columnNames[j], by: Object.fromEntries(C.filter((k) => k !== j).map((k, t) => [this.columnNames[k], by[t]]).filter(([, v]) => sgn(v))) });
          C = C.filter((k) => k !== j);
          changed = true;
          break;
        }
      }
    }
    return { rows: R.map((i) => this.rowNames[i]), columns: C.map((j) => this.columnNames[j]), steps };
  }
  /**
   * All equilibria by support enumeration: for each pair of supports of equal
   * size, solve the indifference equations exactly and keep the solutions that
   * are mixtures and best responses. For a nondegenerate game this is every
   * equilibrium. When some system is singular the game is degenerate and the
   * result is marked `complete: false` (it may then have infinitely many).
   */
  equilibria({ limit = 1000000 } = {}) {
    const { m, n } = this;
    let work = 0n;
    for (let k = 1n; k <= BigInt(Math.min(m, n)); k++) work += binom(BigInt(m), k) * binom(BigInt(n), k);
    if (work > BigInt(limit)) refuse("too-large", `support enumeration would try ${work} pairs of supports`);
    const found = [];
    let complete = true;
    const key = (p, q) => [...p, ...q].map(String).join(",");
    const seen = new Set();
    for (let k = 1; k <= Math.min(m, n); k++) {
      for (const I of combinations([...Array(m).keys()], k)) {
        for (const J of combinations([...Array(n).keys()], k)) {
          const q = indifferent(this.A, I, J, false);
          const p = indifferent(this.B, J, I, true);
          if (q === undefined || p === undefined) {
            complete = false;
            continue;
          }
          if (!q || !p) continue;
          const P = expand(p, I, m);
          const Q = expand(q, J, n);
          if (!this.isEquilibrium(P, Q)) continue;
          const s = key(P, Q);
          if (seen.has(s)) continue;
          seen.add(s);
          found.push(this.#equilibrium(P, Q));
        }
      }
    }
    return Object.freeze(Object.assign(found, { complete }));
  }
  /**
   * One equilibrium by the Lemke–Howson method, starting by dropping label k
   * (0 to m − 1 for the rows, m to m + n − 1 for the columns).
   */
  lemkeHowson(k = 0, { maxPivots = 10000 } = {}) {
    const { m, n } = this;
    if (!Number.isInteger(k) || k < 0 || k >= m + n) refuse("bad-label", `the label is a whole number from 0 to ${m + n - 1}`);
    // make every payoff positive; equilibria do not change
    const lowest = minOf([...this.A.flat(), ...this.B.flat()]);
    const shift = ONE.subtract(lowest);
    const A = this.A.map((r) => r.map((v) => v.add(shift)));
    const B = this.B.map((r) => r.map((v) => v.add(shift)));
    // tableau P: Bᵀx + s = 1 (n rows; x_i has label i, s_j label m + j)
    // tableau Q: r + Ay = 1 (m rows; r_i has label i, y_j label m + j)
    const L = m + n;
    const tabP = B[0].map((_, j) => {
      const row = new Array(L + 1).fill(ZERO);
      for (let i = 0; i < m; i++) row[i] = B[i][j];
      row[m + j] = ONE;
      row[L] = ONE;
      return row;
    });
    const tabQ = A.map((r, i) => {
      const row = new Array(L + 1).fill(ZERO);
      row[i] = ONE;
      for (let j = 0; j < n; j++) row[m + j] = r[j];
      row[L] = ONE;
      return row;
    });
    const basisP = Array.from({ length: n }, (_, j) => m + j);
    const basisQ = Array.from({ length: m }, (_, i) => i);
    let inP = k < m; // x_k enters P when k is a row label, y enters Q otherwise
    let entering = k;
    for (let steps = 0; ; steps++) {
      if (steps > maxPivots) refuse("too-hard", "Lemke–Howson did not finish; the game may be degenerate");
      const T = inP ? tabP : tabQ;
      const basis = inP ? basisP : basisQ;
      let r = -1;
      let best = null;
      for (let i = 0; i < T.length; i++) {
        if (sgn(T[i][entering]) <= 0) continue;
        const ratio = T[i][L].divide(T[i][entering]);
        const c = best === null ? -1 : ratio.compareTo(best);
        if (best === null || c < 0 || (c === 0 && basis[i] < basis[r])) {
          best = ratio;
          r = i;
        }
      }
      if (r < 0) throw new Error("internal: Lemke–Howson found no leaving variable");
      const leaving = basis[r];
      const inv = ONE.divide(T[r][entering]);
      T[r] = T[r].map((v) => v.multiply(inv));
      for (let i = 0; i < T.length; i++) {
        if (i === r || sgn(T[i][entering]) === 0) continue;
        const f = T[i][entering];
        T[i] = T[i].map((v, c) => v.subtract(f.multiply(T[r][c])));
      }
      basis[r] = entering;
      if (leaving === k) break;
      entering = leaving;
      inP = !inP;
    }
    const x = new Array(m).fill(ZERO);
    basisP.forEach((lab, i) => {
      if (lab < m) x[lab] = tabP[i][L];
    });
    const y = new Array(n).fill(ZERO);
    basisQ.forEach((lab, i) => {
      if (lab >= m) y[lab - m] = tabQ[i][L];
    });
    const sx = sum(x);
    const sy = sum(y);
    const p = x.map((v) => v.divide(sx));
    const q = y.map((v) => v.divide(sy));
    if (!this.isEquilibrium(p, q)) throw new Error("internal: Lemke–Howson ended away from an equilibrium");
    return this.#equilibrium(p, q);
  }
  #equilibrium(p, q) {
    const { row, column } = this.payoffs(p, q);
    const game = this;
    return Object.freeze({
      row: Object.freeze(p),
      column: Object.freeze(q),
      payoffs: Object.freeze({ row, column }),
      pure: p.every((v) => sgn(v) === 0 || v.equals(ONE)) && q.every((v) => sgn(v) === 0 || v.equals(ONE)),
      check: () => game.isEquilibrium(p, q) || fail("a player gains by deviating"),
      toString() {
        const mix = (s, names) => s.map((v, i) => (sgn(v) ? (v.equals(ONE) ? names[i] : `${v} ${names[i]}`) : null)).filter(Boolean).join(" + ");
        return `(${mix(p, game.rowNames)}; ${mix(q, game.columnNames)}) paying ${row} and ${column}`;
      },
    });
  }
  toString() {
    return this.A.map((r, i) => r.map((v, j) => `${v},${this.B[i][j]}`).join("  ")).join("\n");
  }
}

const unit = (k, i) => Array.from({ length: k }, (_, t) => (t === i ? ONE : ZERO));
const expand = (v, S, k) => {
  const out = new Array(k).fill(ZERO);
  S.forEach((s, t) => (out[s] = v[t]));
  return out;
};
const binom = (n, k) => {
  let r = 1n;
  for (let i = 0n; i < k; i++) r = (r * (n - i)) / (i + 1n);
  return r;
};

/**
 * The opponent's mixture on support J that makes every strategy in I pay the
 * same. Returns the mixture; null if there is none, or it has an entry ≤ 0; or
 * undefined when the system has a whole line of solutions (a degenerate game).
 */
function indifferent(M, I, J, transpose) {
  const k = I.length;
  const at = (i, j) => (transpose ? M[j][i] : M[i][j]);
  // unknowns: v_1..v_k (the mixture on J) and u (the common payoff)
  const rows = I.map((i) => [...J.map((j) => at(i, j)), ONE.negate()]);
  rows.push([...J.map(() => ONE), ZERO]);
  const rhs = [...I.map(() => ZERO), ONE];
  const sol = solveSquare(rows, rhs);
  if (!sol) return consistent(rows, rhs) ? undefined : null;
  const v = sol.slice(0, k);
  if (v.some((x) => sgn(x) <= 0)) return null;
  return v;
}

/** Does the (singular) system M v = rhs have a solution? Row reduction, exactly. */
function consistent(M, rhs) {
  const A = M.map((r, i) => [...r, rhs[i]]);
  const cols = A[0].length - 1;
  let row = 0;
  for (let c = 0; c < cols && row < A.length; c++) {
    const p = A.findIndex((r, i) => i >= row && sgn(r[c]) !== 0);
    if (p < 0) continue;
    [A[row], A[p]] = [A[p], A[row]];
    for (let i = 0; i < A.length; i++) {
      if (i === row || sgn(A[i][c]) === 0) continue;
      const f = A[i][c].divide(A[row][c]);
      A[i] = A[i].map((v, k) => v.subtract(f.multiply(A[row][k])));
    }
    row++;
  }
  return A.every((r) => r.slice(0, cols).some((v) => sgn(v) !== 0) || sgn(r[cols]) === 0);
}

/**
 * A mixture over the rows of `others` that beats `target` strictly in every
 * column, or null. Each row lists payoffs against the opponent's remaining
 * strategies.
 */
function dominator(others, target, pureOnly) {
  if (!others.length) return null;
  if (pureOnly) {
    const k = others.findIndex((r) => r.every((v, j) => v.compareTo(target[j]) > 0));
    return k < 0 ? null : others.map((_, t) => (t === k ? ONE : ZERO));
  }
  // maximise e subject to Σ p_k others[k][j] − e ≥ target[j], Σp = 1
  const K = others.length;
  const constraints = target.map((t, j) => [[...others.map((r) => r[j]), ONE.negate()], ">=", t]);
  constraints.push([[...others.map(() => ONE), ZERO], "=", 1]);
  const lp = linearProgram({ maximize: [...others.map(() => ZERO), ONE], constraints, free: [K] });
  if (lp.status !== "optimal" || sgn(lp.value) <= 0) return null;
  return lp.x.slice(0, K);
}
