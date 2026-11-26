// Linear recurrences with constant coefficients, solved two ways: any term by
// powers of the companion matrix (so the 10¹⁰⁰-th Fibonacci number is a few
// hundred multiplications), and in closed form as a sum of powers of the
// roots of the characteristic polynomial, the roots being exact algebraic
// numbers. Every closed form is checked against the terms it claims to give.
//
// Also: recovering a recurrence from terms (Berlekamp–Massey over Q), sums of
// polynomials and of polynomial-times-geometric terms in closed form, and the
// master theorem for divide-and-conquer recurrences.

import { Rational } from "@ratmath/core";
import * as alg from "@ratmath/algebraic";
import { refuse } from "./counting.js";
import { poly, RationalSeries, _R as R, _ZERO as ZERO, _ONE as ONE } from "./series.js";

const isZero = (r) => r.numerator === 0n;
const big = (n) => {
  if (typeof n === "bigint") return n;
  if (Number.isInteger(n)) return BigInt(n);
  return refuse("bad-argument", `an index is a whole number, not ${n}`);
};

// ---- matrices of Rationals -----------------------------------------------------------------------
const matMul = (A, B) => A.map((row) => B[0].map((_, j) => row.reduce((s, a, k) => (isZero(a) ? s : s.add(a.multiply(B[k][j]))), ZERO)));
const identity = (k) => Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => (i === j ? ONE : ZERO)));
function matPow(M, e) {
  let out = identity(M.length);
  let b = M;
  while (e > 0n) {
    if (e & 1n) out = matMul(out, b);
    b = matMul(b, b);
    e >>= 1n;
  }
  return out;
}

/**
 * aₙ = c₁aₙ₋₁ + c₂aₙ₋₂ + … + cₖaₙ₋ₖ (+ g(n)), from the initial values.
 *
 *   recurrence({ coefficients: [1, 1], initial: [0, 1] })            Fibonacci
 *   recurrence({ coefficients: [2], initial: [0], plus: [1] })        aₙ = 2aₙ₋₁ + 1
 *   recurrence({ coefficients: [3], initial: [1], plus: { poly: [0, 1], base: 2 } })   + n·2ⁿ
 *
 * `plus` is a polynomial in n (coefficients, constant first) or
 * { poly, base } for poly(n)·baseⁿ. It is removed by raising the order: the
 * operator (E − base) applied deg + 1 times kills it, so the result is a
 * homogeneous recurrence with more initial values, which is what is stored.
 * More initial values than the order may be given: the recurrence then holds
 * from the first index past them.
 */
export class LinearRecurrence {
  constructor({ coefficients, initial, plus = null }) {
    this.given = plus ? { coefficients: coefficients.map(R), plus } : null;
    let c = coefficients.map(R);
    let init = initial.map(R);
    if (init.length < c.length) refuse("bad-argument", `a recurrence of order ${c.length} needs ${c.length} initial values`);
    if (plus) {
      const g = Array.isArray(plus) ? { poly: plus, base: 1 } : plus;
      const gp = poly.trim(g.poly.map(R));
      const base = R(g.base ?? 1);
      // compute enough terms of the inhomogeneous recurrence
      const extra = gp.length;
      const gAt = (n) => poly.at(gp, new Rational(BigInt(n))).multiply(base.pow(BigInt(n)));
      while (init.length < Math.max(c.length, initial.length) + extra) {
        const n = init.length;
        init.push(c.reduce((s, ci, i) => s.add(ci.multiply(init[n - 1 - i])), gAt(n)));
      }
      // characteristic polynomial times (x − base)^extra
      let chi = charFrom(c);
      for (let i = 0; i < extra; i++) chi = poly.mul(chi, [base.negate(), ONE]);
      c = coeffsFrom(chi);
    }
    this.coefficients = Object.freeze(c);
    this.initial = Object.freeze(init);
    this.order = c.length;
  }
  /** The characteristic polynomial xᵏ − c₁xᵏ⁻¹ − … − cₖ, constant first. */
  get characteristic() {
    return charFrom(this.coefficients);
  }
  /** The first n terms. */
  terms(n) {
    const out = this.initial.slice(0, n);
    while (out.length < n) {
      const m = out.length;
      out.push(this.coefficients.reduce((s, ci, i) => s.add(ci.multiply(out[m - 1 - i])), ZERO));
    }
    return out;
  }
  /** The n-th term (n counted from 0), by a power of the companion matrix: about log₂ n matrix products. */
  term(n) {
    const N = big(n);
    if (N < 0n) refuse("bad-argument", "terms are counted from 0");
    if (N < BigInt(this.initial.length)) return this.initial[Number(N)];
    const k = this.order;
    if (k === 0) return ZERO;
    // state (aₘ, aₘ₋₁, …, aₘ₋ₖ₊₁) with m = initial.length − 1
    const m = this.initial.length - 1;
    const C = [this.coefficients.slice(), ...Array.from({ length: k - 1 }, (_, i) => Array.from({ length: k }, (_, j) => (j === i ? ONE : ZERO)))];
    const P = matPow(C, N - BigInt(m));
    const state = Array.from({ length: k }, (_, i) => this.initial[m - i]);
    return P[0].reduce((s, a, j) => s.add(a.multiply(state[j])), ZERO);
  }
  /** The ordinary generating function, as P(x)/Q(x) with Q(x) = 1 − c₁x − … − cₖxᵏ. */
  generatingFunction() {
    const Q = [ONE, ...this.coefficients.map((c) => c.negate())];
    const s = this.initial.length;
    // P = (Σ aₙxⁿ)·Q, which stops at degree s − 1
    const a = this.initial;
    const P = Array.from({ length: s }, (_, n) => {
      let v = ZERO;
      for (let j = 0; j <= n && j < Q.length; j++) v = v.add(Q[j].multiply(a[n - j]));
      return v;
    });
    return new RationalSeries(P, Q);
  }
  /**
   * aₙ as a sum of terms p(n)·rⁿ over the roots r of the characteristic
   * polynomial (p of degree below the root's multiplicity), with the roots
   * and coefficients exact algebraic numbers. The coefficients come from
   * solving the first k equations exactly; the form is then checked on the
   * next terms, and `checked` says so.
   *
   *   { parts: [{ root, multiplicity, coefficients: [c₀, c₁, …] }],   aₙ = Σ (c₀ + c₁n + …)·rootⁿ
   *     validFrom, checked, at(n), toString() }
   */
  closedForm({ check = 3 } = {}) {
    let chi = this.characteristic;
    // zero roots only affect the first terms: strip them and start later
    let zeros = 0;
    while (chi.length > 1 && isZero(chi[0])) {
      chi = chi.slice(1);
      zeros++;
    }
    const k = chi.length - 1;
    const start = Math.max(0, this.initial.length - this.order) + zeros;
    if (k === 0) return closed([], start, this, check);
    const lcm = chi.reduce((l, c) => {
      const g = gcd(l, c.denominator);
      return (l / g) * c.denominator;
    }, 1n);
    const intPoly = chi.map((c) => (c.numerator * lcm) / c.denominator);
    const rs = alg.roots(intPoly, { complex: true });
    // unknowns: for each root r with multiplicity m, coefficients of n^0 … n^{m−1}
    const cols = [];
    for (const { value, multiplicity } of rs) for (let j = 0; j < multiplicity; j++) cols.push({ root: value, j });
    if (cols.length !== k) refuse("internal", "the roots found do not account for the degree");
    const a = this.terms(start + k + check);
    const A = [];
    const b = [];
    for (let i = 0; i < k; i++) {
      const n = start + i;
      A.push(cols.map(({ root, j }) => alg.mul(alg.fromRational(new Rational(BigInt(n) ** BigInt(j))), alg.pow(root, n))));
      b.push(alg.fromRational(a[n]));
    }
    const x = solveAlgebraic(A, b);
    const parts = [];
    let ci = 0;
    for (const { value, multiplicity } of rs) {
      parts.push({ root: value, multiplicity, coefficients: x.slice(ci, ci + multiplicity) });
      ci += multiplicity;
    }
    return closed(parts, start, this, check);
  }
  toString() {
    const c = this.coefficients;
    const rhs = c
      .map((ci, i) => [ci, `a(n−${i + 1})`])
      .filter(([ci]) => !isZero(ci))
      .map(([ci, t], i) => {
        const neg = ci.numerator < 0n;
        const a = neg ? ci.negate() : ci;
        const term = a.equals(ONE) ? t : `${a.denominator === 1n ? a : `(${a})`}·${t}`;
        return i === 0 ? `${neg ? "−" : ""}${term}` : `${neg ? " − " : " + "}${term}`;
      })
      .join("");
    return `a(n) = ${rhs || "0"}, from ${this.initial.map((v, i) => `a(${i}) = ${v}`).join(", ")}${this.given ? " (made homogeneous)" : ""}`;
  }
}
export const recurrence = (spec) => new LinearRecurrence(spec);

const gcd = (a, b) => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
};
const charFrom = (c) => poly.trim([...c.map((x) => x.negate()).reverse(), ONE]);
const coeffsFrom = (chi) => {
  // chi monic of degree k, constant first
  const k = chi.length - 1;
  return Array.from({ length: k }, (_, i) => (chi[k - 1 - i] ?? ZERO).negate());
};

/** Gaussian elimination over algebraic numbers (small systems). */
function solveAlgebraic(A, b) {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    const p = M.findIndex((row, r) => r >= col && !alg.isZero(row[col]));
    if (p < 0) refuse("internal", "the system for the closed form is singular");
    [M[col], M[p]] = [M[p], M[col]];
    const inv = alg.inv(M[col][col]);
    M[col] = M[col].map((v) => alg.mul(v, inv));
    for (let r = 0; r < n; r++) {
      if (r === col || alg.isZero(M[r][col])) continue;
      const f = M[r][col];
      M[r] = M[r].map((v, j) => alg.sub(v, alg.mul(f, M[col][j])));
    }
  }
  return M.map((row) => alg.simplify(row[n]));
}

function closed(parts, start, rec, check) {
  const at = (n) => {
    const N = Number(n);
    let s = alg.fromRational(new Rational(0n));
    for (const { root, coefficients } of parts) {
      const rn = alg.pow(root, N);
      coefficients.forEach((c, j) => {
        if (!alg.isZero(c)) s = alg.add(s, alg.mul(alg.mul(c, alg.fromRational(new Rational(BigInt(N) ** BigInt(j)))), rn));
      });
    }
    return s;
  };
  const k = parts.reduce((s, p) => s + p.multiplicity, 0);
  const terms = rec.terms(start + k + check);
  let checked = true;
  for (let n = start; n < start + k + check; n++) {
    const v = at(n);
    const want = alg.fromRational(terms[n]);
    if (!alg.equals(v, want)) checked = false;
  }
  if (!checked) throw new Error("internal: the closed form does not give the terms");
  const fmt = (x) => alg.format(x);
  const wrap = (s) => (/^[\w√.]+$/.test(s) || /^\(.*\)$/.test(s) && balanced(s.slice(1, -1)) ? s : `(${s})`);
  const text = () => {
    let out = "";
    for (const { root, coefficients } of parts) {
      const r = fmt(root);
      const pow = r === "1" ? "" : `${wrap(r)}^n`;
      coefficients.forEach((c, j) => {
        if (alg.isZero(c)) return;
        let cs = fmt(c);
        // a plain negative number: pull the sign out
        const neg = /^−[\w√/.]+$/.test(cs) && !/[+]/.test(cs);
        if (neg) cs = cs.slice(1);
        const nj = j === 0 ? "" : j === 1 ? "n" : `n^${j}`;
        const factors = [cs === "1" && (nj || pow) ? "" : (nj || pow) ? wrap(cs) : cs, nj, pow].filter(Boolean);
        const term = factors.join("·") || "1";
        out += out ? (neg ? ` − ${term}` : ` + ${term}`) : neg ? `−${term}` : term;
      });
    }
    return `a(n) = ${out || "0"}${start ? `   (n ≥ ${start})` : ""}`;
  };
  return Object.freeze({
    parts: Object.freeze(parts.map((p) => Object.freeze({ ...p, coefficients: Object.freeze(p.coefficients) }))),
    validFrom: start,
    checked,
    /** The closed form at n, an exact algebraic number (rational: `.rational`). */
    at,
    toString: text,
  });
}
const balanced = (s) => {
  let d = 0;
  for (const ch of s) {
    if (ch === "(") d++;
    if (ch === ")" && --d < 0) return false;
  }
  return d === 0;
};

/**
 * The shortest linear recurrence with constant rational coefficients that the
 * given terms satisfy (Berlekamp–Massey over Q). It is reported only when the
 * terms pin it down: a recurrence of order k needs 2k terms. Otherwise null.
 */
export function guessRecurrence(terms) {
  const s = terms.map(R);
  const N = s.length;
  let C = [ONE];
  let B = [ONE];
  let L = 0;
  let m = 1;
  let b = ONE;
  for (let n = 0; n < N; n++) {
    let d = s[n];
    for (let i = 1; i <= L; i++) d = d.add((C[i] ?? ZERO).multiply(s[n - i]));
    if (isZero(d)) {
      m++;
      continue;
    }
    const coef = d.divide(b);
    const T = C.slice();
    const shifted = [...new Array(m).fill(ZERO), ...B];
    const len = Math.max(C.length, shifted.length);
    C = Array.from({ length: len }, (_, i) => (C[i] ?? ZERO).subtract(coef.multiply(shifted[i] ?? ZERO)));
    if (2 * L <= n) {
      L = n + 1 - L;
      B = T;
      b = d;
      m = 1;
    } else m++;
  }
  if (2 * L > N) return null;
  const coefficients = Array.from({ length: L }, (_, i) => (C[i + 1] ?? ZERO).negate());
  const rec = new LinearRecurrence({ coefficients, initial: s.slice(0, Math.max(L, 0)) });
  const got = rec.terms(N);
  if (!got.every((v, i) => v.equals(s[i]))) return null;
  return rec;
}

// ---- sums in closed form ----------------------------------------------------------------------------

const binomPoly = (j) => {
  // C(n + 1, j + 1) as a polynomial in n
  let p = [ONE];
  for (let i = 0; i <= j; i++) p = poly.mul(p, [new Rational(BigInt(1 - i)), ONE]);
  let f = 1n;
  for (let i = 2n; i <= BigInt(j + 1); i++) f *= i;
  return poly.scale(p, new Rational(1n, f));
};

/**
 * Σ_{k=0}^{n} p(k) r^k in closed form, for a polynomial p (coefficients,
 * constant first) and a rational r (1 unless given).
 *   r = 1:  a polynomial S(n) of degree deg p + 1 (by Newton's forward differences)
 *   r ≠ 1:  Q(n)·r^(n+1) − Q(−1), with Q of degree deg p, solving r·Q(k) − Q(k−1) = p(k)
 * Returns { polynomial | (Q, r), at(n), toString() }.
 */
export function closedSum(p, r = 1) {
  const P = poly.trim(p.map(R));
  const base = R(r);
  if (base.equals(ONE)) {
    // forward differences at 0
    const d = P.length;
    let vals = Array.from({ length: d + 1 }, (_, k) => poly.at(P, new Rational(BigInt(k))));
    let S = [];
    for (let j = 0; j <= d; j++) {
      S = poly.add(S, poly.scale(binomPoly(j), vals[0]));
      vals = vals.slice(1).map((v, i) => v.subtract(vals[i]));
    }
    return Object.freeze({
      polynomial: S,
      at: (n) => poly.at(S, R(n)),
      toString: () => `Σ_{k=0}^{n} ${poly.format(P, "k")} = ${poly.format(S, "n")}`,
    });
  }
  if (isZero(base)) refuse("bad-argument", "r is not 0");
  // r Q(k) − Q(k − 1) = p(k): match coefficients from the top degree down
  const d = Math.max(P.length - 1, 0);
  // Q(k−1) expanded: shift operator on coefficients
  const shiftMinus = (q) => {
    // q(k−1)
    let out = [];
    q.forEach((c, i) => {
      let t = [ONE];
      for (let s = 0; s < i; s++) t = poly.mul(t, [ONE.negate(), ONE]);
      out = poly.add(out, poly.scale(t, c));
    });
    return out;
  };
  // solve by unknown coefficients: linear system, upper triangular in practice
  const Q = new Array(d + 1).fill(ZERO);
  for (let i = d; i >= 0; i--) {
    // coefficient of k^i in r Q(k) − Q(k−1): (r − 1) q_i + (terms from higher q_j)
    const trial = Q.slice();
    trial[i] = ZERO;
    const lhs = poly.sub(poly.scale(trial, base), shiftMinus(trial));
    const want = (P[i] ?? ZERO).subtract(lhs[i] ?? ZERO);
    Q[i] = want.divide(base.subtract(ONE));
  }
  const Qt = poly.trim(Q);
  const c0 = poly.at(Qt, new Rational(-1n));
  const at = (n) => poly.at(Qt, R(n)).multiply(base.pow(BigInt(R(n).numerator) + 1n)).subtract(c0);
  return Object.freeze({
    quotient: Qt,
    ratio: base,
    constant: c0,
    at,
    toString: () => {
      const q = poly.format(Qt, "n");
      return `Σ_{k=0}^{n} ${P.length > 1 || !P[0]?.equals(ONE) ? `(${poly.format(P, "k")})·` : ""}${base}^k = (${q})·${base}^(n+1) ${c0.numerator < 0n ? "+" : "−"} ${c0.abs()}`;
    },
  });
}

// ---- divide and conquer ----------------------------------------------------------------------------

/**
 * The master theorem for T(n) = a·T(n/b) + f(n) with f(n) = Θ(n^d · log^j n).
 * Compares d with the critical exponent log_b a, exactly where it can (a and
 * b whole numbers: d = log_b a exactly when b^d = a for rational d = p/q,
 * i.e. b^p = a^q).
 *   { case: 1 | 2 | 3, critical: "log_b a" text, bound: "Θ(…)" text, reason }
 */
export function masterTheorem({ a, b, d = 0, j = 0 }) {
  const A = BigInt(a);
  const B = BigInt(b);
  if (A < 1n || B < 2n) refuse("bad-argument", "the master theorem needs a ≥ 1 and b ≥ 2");
  const D = R(d);
  if (D.numerator < 0n) refuse("bad-argument", "d ≥ 0");
  // compare b^d with a: b^(p/q) vs a  ⇔  b^p vs a^q
  const p = D.numerator;
  const q = D.denominator;
  const lhs = B ** p;
  const rhs = A ** q;
  const cmp = lhs < rhs ? -1 : lhs > rhs ? 1 : 0;
  const crit = A === 1n ? "0" : `log_${B} ${A}`;
  const exactCrit = (() => {
    // is log_b a rational? only if a and b are powers of a common base
    for (let e = 1n; e <= 64n; e++) for (let f = 1n; f <= 64n; f++) if (B ** e === A ** f) return new Rational(e, f);
    return A === 1n ? new Rational(0n) : null;
  })();
  const critText = exactCrit ? String(exactCrit) : `${crit} ≈ ${(Math.log(Number(A)) / Math.log(Number(B))).toFixed(4)}`;
  const nPow = (e) => (typeof e === "string" ? `n^(${e})` : e.equals(ONE) ? "n" : isZero(e) ? "1" : e.denominator === 1n ? `n^${e}` : `n^(${e})`);
  const logs = (k) => (k === 0 ? "" : k === 1 ? " log n" : ` log^${k} n`);
  if (cmp < 0) {
    return Object.freeze({ case: 1, critical: critText, bound: `Θ(${nPow(exactCrit ?? crit)})`, reason: `f(n) grows more slowly than n^(log_b a), since b^d = ${lhs} < a^q = ${rhs}: the leaves dominate` });
  }
  if (cmp === 0) {
    return Object.freeze({ case: 2, critical: critText, bound: `Θ(${nPow(D)}${logs(j + 1)})`.replace("Θ(1 log", "Θ(log"), reason: `f(n) matches n^(log_b a) exactly (b^d = a^q): every level of the recursion costs the same, and there are log n levels` });
  }
  return Object.freeze({ case: 3, critical: critText, bound: `Θ(${nPow(D)}${logs(j)})`, reason: `f(n) grows faster than n^(log_b a) (b^d = ${lhs} > a^q = ${rhs}), and a·f(n/b) ≤ (a/b^d)·f(n) with a/b^d < 1: the root dominates` });
}

/**
 * Exact values of T(n) = a·T(n/b) + f(n) at n = b^m, m = 0 … count − 1,
 * from T(1) = t1, with f a function n ↦ number or Rational. For checking a
 * bound by looking at the numbers.
 */
export function divideAndConquer({ a, b, f, t1 = 1 }, count = 10) {
  const A = R(a);
  const B = BigInt(b);
  const out = [{ n: 1n, value: R(t1) }];
  for (let m = 1; m < count; m++) {
    const n = B ** BigInt(m);
    out.push({ n, value: A.multiply(out[m - 1].value).add(R(f(n))) });
  }
  return out;
}
