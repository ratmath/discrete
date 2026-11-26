// Generating functions: formal power series with exact rational coefficients,
// computed lazily (a coefficient is worked out the first time it is asked for
// and then kept), and rational generating functions P(x)/Q(x), kept in closed
// form, whose coefficients obey a linear recurrence.
//
// An exponential generating function is an ordinary power series whose n-th
// coefficient is aₙ/n!; `egf(seq)` builds one and `terms(n, { egf: true })`
// reads the sequence back, so products of EGFs are just products of series.

import { Rational } from "@ratmath/core";
import { refuse } from "./counting.js";
import { exact } from "./lp.js";
import { LinearRecurrence } from "./recurrence.js";

const ZERO = new Rational(0n);
const ONE = new Rational(1n);
const isZero = (r) => r.numerator === 0n;
const R = (v) => (v instanceof Rational ? v : exact(v, "coefficient"));
const factorialR = (n) => {
  let f = 1n;
  for (let k = 2n; k <= BigInt(n); k++) f *= k;
  return new Rational(f);
};

// ---- polynomials over Q, constant term first ---------------------------------------------------

export const poly = Object.freeze({
  trim(p) {
    const q = p.map(R);
    while (q.length && isZero(q[q.length - 1])) q.pop();
    return q;
  },
  add(a, b) {
    return poly.trim(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] ?? ZERO).add(b[i] ?? ZERO)));
  },
  sub(a, b) {
    return poly.trim(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] ?? ZERO).subtract(b[i] ?? ZERO)));
  },
  mul(a, b) {
    if (!a.length || !b.length) return [];
    const out = new Array(a.length + b.length - 1).fill(ZERO);
    a.forEach((x, i) => {
      if (!isZero(x)) b.forEach((y, j) => (out[i + j] = out[i + j].add(x.multiply(y))));
    });
    return poly.trim(out);
  },
  scale(p, s) {
    return poly.trim(p.map((c) => c.multiply(R(s))));
  },
  at(p, x) {
    const X = R(x);
    return p.reduceRight((acc, c) => acc.multiply(X).add(c), ZERO);
  },
  /** p(x) written in the variable v, highest power first. */
  format(p, v = "n", { ascending = false } = {}) {
    const q = poly.trim(p);
    if (!q.length) return "0";
    const parts = [];
    const order = q.map((_, i) => i);
    if (!ascending) order.reverse();
    for (const i of order) {
      const c = q[i];
      if (isZero(c)) continue;
      const neg = c.numerator < 0n;
      const a = neg ? c.negate() : c;
      const mono = i === 0 ? "" : i === 1 ? v : `${v}^${i}`;
      const coef = i === 0 ? String(a) : a.equals(ONE) ? "" : a.denominator === 1n ? `${a}` : `(${a})`;
      const term = coef && mono ? `${coef}·${mono}` : coef || mono;
      parts.push(parts.length ? `${neg ? " − " : " + "}${term}` : `${neg ? "−" : ""}${term}`);
    }
    return parts.join("");
  },
});

// ---- power series --------------------------------------------------------------------------------

/**
 * A formal power series a₀ + a₁x + a₂x² + … with exact rational coefficients.
 * Build one with `series(...)`, `egf(...)` or the constants in `PowerSeries`;
 * every operation returns a new series and computes nothing until a
 * coefficient is asked for.
 */
export class PowerSeries {
  #memo = [];
  #rule;
  constructor(rule, name = "series") {
    this.#rule = rule;
    this.name = name;
  }
  /** The coefficient of xⁿ, a Rational. */
  coefficient(n) {
    if (!Number.isInteger(n) || n < 0) refuse("bad-argument", "a coefficient index is a whole number ≥ 0");
    for (let k = this.#memo.length; k <= n; k++) this.#memo.push(R(this.#rule(k, this.#memo)));
    return this.#memo[n];
  }
  /** The first n coefficients (or, with { egf: true }, n!·coefficient: the sequence an EGF counts). */
  terms(n, { egf = false } = {}) {
    return Array.from({ length: n }, (_, k) => (egf ? this.coefficient(k).multiply(factorialR(k)) : this.coefficient(k)));
  }
  add(other) {
    const b = series(other);
    return new PowerSeries((n) => this.coefficient(n).add(b.coefficient(n)), `(${this.name} + ${b.name})`);
  }
  subtract(other) {
    const b = series(other);
    return new PowerSeries((n) => this.coefficient(n).subtract(b.coefficient(n)), `(${this.name} − ${b.name})`);
  }
  negate() {
    return new PowerSeries((n) => this.coefficient(n).negate(), `−${this.name}`);
  }
  scale(s) {
    const c = R(s);
    return new PowerSeries((n) => this.coefficient(n).multiply(c), `${c}·${this.name}`);
  }
  /** The Cauchy product: the coefficient of xⁿ is Σ aₖ bₙ₋ₖ. */
  multiply(other) {
    const b = series(other);
    return new PowerSeries((n) => {
      let s = ZERO;
      for (let k = 0; k <= n; k++) s = s.add(this.coefficient(k).multiply(b.coefficient(n - k)));
      return s;
    }, `${this.name}·${b.name}`);
  }
  /** xᵏ times the series. */
  shift(k = 1) {
    return new PowerSeries((n) => (n < k ? ZERO : this.coefficient(n - k)), `x^${k}·${this.name}`);
  }
  /** 1/A, when a₀ ≠ 0: b₀ = 1/a₀ and bₙ = −(a₁bₙ₋₁ + … + aₙb₀)/a₀. */
  reciprocal() {
    const a0 = this.coefficient(0);
    if (isZero(a0)) refuse("not-invertible", "1/A needs a non-zero constant term");
    return new PowerSeries((n, b) => {
      if (n === 0) return ONE.divide(a0);
      let s = ZERO;
      for (let k = 1; k <= n; k++) s = s.add(this.coefficient(k).multiply(b[n - k]));
      return s.negate().divide(a0);
    }, `1/${this.name}`);
  }
  divide(other) {
    return this.multiply(series(other).reciprocal());
  }
  derivative() {
    return new PowerSeries((n) => this.coefficient(n + 1).multiply(new Rational(BigInt(n + 1))), `${this.name}′`);
  }
  /** The integral with constant term c (0 unless given). */
  integral(c = 0) {
    const c0 = R(c);
    return new PowerSeries((n) => (n === 0 ? c0 : this.coefficient(n - 1).divide(new Rational(BigInt(n)))), `∫${this.name}`);
  }
  /** A(B(x)), when B has constant term 0. */
  compose(other) {
    const b = series(other);
    if (!isZero(b.coefficient(0))) refuse("bad-argument", "A(B(x)) needs B(0) = 0, so that each coefficient is a finite sum");
    // powers of B, kept as they are made
    const powers = [series([1])];
    const pw = (k) => {
      while (powers.length <= k) powers.push(powers[powers.length - 1].multiply(b));
      return powers[k];
    };
    return new PowerSeries((n) => {
      let s = ZERO;
      for (let k = 0; k <= n; k++) {
        const ak = this.coefficient(k);
        if (!isZero(ak)) s = s.add(ak.multiply(pw(k).coefficient(n)));
      }
      return s;
    }, `${this.name}∘${b.name}`);
  }
  /** Aᵏ for a whole k ≥ 0 (or k < 0 when a₀ ≠ 0). */
  pow(k) {
    if (!Number.isInteger(k)) refuse("bad-argument", "the power is a whole number");
    if (k < 0) return this.reciprocal().pow(-k);
    let out = series([1]);
    let base = this;
    let e = k;
    while (e > 0) {
      if (e & 1) out = out.multiply(base);
      base = base.multiply(base);
      e >>= 1;
    }
    return out;
  }
  /** exp(A), when a₀ = 0: B′ = A′B, so nbₙ = Σ k aₖ bₙ₋ₖ. */
  exp() {
    if (!isZero(this.coefficient(0))) refuse("bad-argument", "exp(A) as a series with rational coefficients needs A(0) = 0");
    return new PowerSeries((n, b) => {
      if (n === 0) return ONE;
      let s = ZERO;
      for (let k = 1; k <= n; k++) s = s.add(new Rational(BigInt(k)).multiply(this.coefficient(k)).multiply(b[n - k]));
      return s.divide(new Rational(BigInt(n)));
    }, `exp(${this.name})`);
  }
  /** log(A), when a₀ = 1: the integral of A′/A. */
  log() {
    if (!this.coefficient(0).equals(ONE)) refuse("bad-argument", "log(A) as a series with rational coefficients needs A(0) = 1");
    const s = this.derivative().divide(this).integral(0);
    s.name = `log(${this.name})`;
    return s;
  }
  /** √A, when a₀ is the square of a rational: b₀² = a₀ and 2b₀bₙ = aₙ − Σ bₖbₙ₋ₖ. */
  sqrt() {
    const a0 = this.coefficient(0);
    const root = (x) => {
      const s = (v) => {
        if (v < 0n) return null;
        let r = BigInt(Math.floor(Math.sqrt(Number(v))));
        while (r * r > v) r--;
        while ((r + 1n) * (r + 1n) <= v) r++;
        return r * r === v ? r : null;
      };
      const n = s(x.numerator);
      const d = s(x.denominator);
      return n === null || d === null ? null : new Rational(n, d);
    };
    const b0 = root(a0);
    if (!b0 || isZero(b0)) refuse("bad-argument", "√A here needs a constant term that is the square of a non-zero rational");
    return new PowerSeries((n, b) => {
      if (n === 0) return b0;
      let s = this.coefficient(n);
      for (let k = 1; k < n; k++) s = s.subtract(b[k].multiply(b[n - k]));
      return s.divide(b0.add(b0));
    }, `√${this.name}`);
  }
  /** The series written out to n terms. */
  toString(n = 8) {
    const parts = [];
    for (let k = 0; k < n; k++) {
      const c = this.coefficient(k);
      if (isZero(c)) continue;
      const neg = c.numerator < 0n;
      const a = neg ? c.negate() : c;
      const mono = k === 0 ? "" : k === 1 ? "x" : `x^${k}`;
      const coef = k === 0 ? String(a) : a.equals(ONE) ? "" : a.denominator === 1n ? String(a) : `(${a})`;
      const t = coef && mono ? `${coef}${mono}` : coef || mono;
      parts.push(parts.length ? `${neg ? " − " : " + "}${t}` : `${neg ? "−" : ""}${t}`);
    }
    return `${parts.join("") || "0"} + O(x^${n})`;
  }
}

/**
 * A power series from
 *   an array of coefficients (a polynomial),
 *   a function n ↦ aₙ (an ordinary generating function of that sequence),
 *   or a PowerSeries (returned as it is).
 */
export function series(input, name) {
  if (input instanceof PowerSeries) return input;
  if (Array.isArray(input)) {
    const c = input.map(R);
    return new PowerSeries((n) => c[n] ?? ZERO, name ?? `(${poly.format(c, "x")})`);
  }
  if (typeof input === "function") return new PowerSeries((n) => input(n), name ?? "A");
  return series([input], name);
}
/** The exponential generating function Σ aₙxⁿ/n! of a sequence given as a function or an array. */
export function egf(seq, name = "E") {
  const at = Array.isArray(seq) ? (n) => seq[n] ?? 0 : seq;
  return new PowerSeries((n) => R(at(n)).divide(factorialR(n)), name);
}

/** Series that come up again and again. */
export const known = Object.freeze({
  /** 1/(1 − x) = 1 + x + x² + … */
  geometric: (r = 1) => rationalSeries([1], [ONE, R(r).negate()]).series,
  /** eˣ */
  exp: () => new PowerSeries((n) => ONE.divide(factorialR(n)), "exp(x)"),
  /** log(1/(1 − x)) = x + x²/2 + x³/3 + … */
  logInverse: () => new PowerSeries((n) => (n === 0 ? ZERO : new Rational(1n, BigInt(n))), "log(1/(1−x))"),
  /** (1 + x)^a for a rational a: the binomial series. */
  binomial: (a) => {
    const A = R(a);
    return new PowerSeries((n, b) => (n === 0 ? ONE : b[n - 1].multiply(A.subtract(new Rational(BigInt(n - 1)))).divide(new Rational(BigInt(n)))), `(1+x)^${A}`);
  },
  /** The Catalan numbers: C(x) = (1 − √(1 − 4x))/(2x). */
  catalan: () => {
    const s = series([1, -4]).sqrt();
    return new PowerSeries((n) => s.coefficient(n + 1).divide(new Rational(-2n)), "C(x)");
  },
  /** Partitions of n: Π 1/(1 − xᵏ). */
  partitions: () =>
    new PowerSeries((n, p) => {
      // Euler's pentagonal recurrence
      if (n === 0) return ONE;
      let s = ZERO;
      for (let k = 1; ; k++) {
        const g1 = (k * (3 * k - 1)) / 2;
        const g2 = (k * (3 * k + 1)) / 2;
        if (g1 > n) break;
        const sign = k % 2 ? 1 : -1;
        const t = p[n - g1].add(g2 <= n ? p[n - g2] : ZERO);
        s = sign > 0 ? s.add(t) : s.subtract(t);
      }
      return s;
    }, "P(x)"),
});

// ---- rational generating functions ------------------------------------------------------------------

/**
 * A rational generating function P(x)/Q(x) with Q(0) ≠ 0, kept as its two
 * polynomials. Its coefficients satisfy the linear recurrence read off from Q,
 * so `recurrence()` gives it, `series` expands it, and `closedForm()` (from
 * the recurrence) writes aₙ as a sum of powers of the roots.
 */
export class RationalSeries {
  constructor(numerator, denominator) {
    this.numerator = poly.trim(numerator.map(R));
    this.denominator = poly.trim(denominator.map(R));
    if (!this.denominator.length || isZero(this.denominator[0])) refuse("bad-argument", "P(x)/Q(x) as a power series needs Q(0) ≠ 0");
    const P = this.numerator;
    const Q = this.denominator;
    this.series = new PowerSeries((n, a) => {
      let s = P[n] ?? ZERO;
      for (let k = 1; k < Q.length && k <= n; k++) s = s.subtract(Q[k].multiply(a[n - k]));
      return s.divide(Q[0]);
    }, `(${poly.format(P, "x")})/(${poly.format(Q, "x")})`);
  }
  coefficient(n) {
    return this.series.coefficient(n);
  }
  terms(n) {
    return this.series.terms(n);
  }
  add(o) {
    return new RationalSeries(poly.add(poly.mul(this.numerator, o.denominator), poly.mul(o.numerator, this.denominator)), poly.mul(this.denominator, o.denominator));
  }
  multiply(o) {
    return new RationalSeries(poly.mul(this.numerator, o.numerator), poly.mul(this.denominator, o.denominator));
  }
  /** The linear recurrence the coefficients satisfy, with enough initial values. */
  recurrence() {
    const Q = this.denominator;
    const k = Q.length - 1;
    const coefficients = Q.slice(1).map((q) => q.negate().divide(Q[0]));
    const start = Math.max(k, this.numerator.length);
    return new LinearRecurrence({ coefficients, initial: this.terms(start) });
  }
  toString() {
    const f = (p) => {
      const t = poly.format(p, "x", { ascending: true });
      return p.filter((c) => !isZero(c)).length > 1 ? `(${t})` : t;
    };
    return `${f(this.numerator)}/${f(this.denominator)}`;
  }
}
export const rationalSeries = (numerator, denominator) => new RationalSeries(numerator, denominator);
export { factorialR as _factorialR, R as _R, ZERO as _ZERO, ONE as _ONE };
