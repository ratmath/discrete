import { expect, test } from "bun:test";
import { Rational } from "@ratmath/core";
import {
  series, egf, knownSeries as known, rationalSeries, recurrence, guessRecurrence, closedSum, masterTheorem,
  divideAndConquer, binomial, catalan, partitionCount, bell, fibonacci,
} from "../index.js";
import * as alg from "@ratmath/algebraic";

const S = (xs) => xs.map(String);

test("power series arithmetic agrees with the counting functions", () => {
  expect(S(series([1, 1]).pow(6).terms(8))).toEqual(["1", "6", "15", "20", "15", "6", "1", "0"]);
  expect(S(known.catalan().terms(10))).toEqual(Array.from({ length: 10 }, (_, n) => String(catalan(n))));
  expect(S(known.partitions().terms(20))).toEqual(Array.from({ length: 20 }, (_, n) => String(partitionCount(n))));
  // Bell numbers: exp(e^x − 1) as an EGF
  expect(S(series([0, 1]).exp().subtract(1).exp().terms(9, { egf: true }))).toEqual(Array.from({ length: 9 }, (_, n) => String(bell(n))));
  // e^x · e^x = e^{2x}
  expect(S(egf(() => 1).multiply(egf(() => 1)).terms(8, { egf: true }))).toEqual(Array.from({ length: 8 }, (_, n) => String(2 ** n)));
});

test("identities: reciprocal, log∘exp, sqrt², compose, derivative and integral", () => {
  const f = series([1, 2, 0, -1, 5]);
  const one = f.multiply(f.reciprocal()).terms(12);
  expect(S(one)).toEqual(["1", ...Array(11).fill("0")]);
  const g = series([0, 1, 3, -2]);
  expect(S(g.exp().log().terms(10))).toEqual(S(g.terms(10)));
  const h = series([1, 3, 1]);
  expect(S(h.sqrt().multiply(h.sqrt()).terms(10))).toEqual(S(h.terms(10)));
  expect(S(f.derivative().integral().terms(8))).toEqual(S(f.subtract(1).terms(8)));
  // 1/(1−x) ∘ (x + x²) = 1/(1 − x − x²): Fibonacci shifted
  const comp = known.geometric(1).compose(series([0, 1, 1])).terms(10);
  expect(S(comp)).toEqual(Array.from({ length: 10 }, (_, n) => String(fibonacci(n + 1))));
  // (1+x)^{1/2} squared
  const b = known.binomial("1/2");
  expect(S(b.multiply(b).terms(8))).toEqual(["1", "1", ...Array(6).fill("0")]);
});

test("rational series and the recurrence they satisfy", () => {
  const r = rationalSeries([0, 1], [1, -1, -1]);
  expect(S(r.terms(12))).toEqual(Array.from({ length: 12 }, (_, n) => String(fibonacci(n))));
  const rec = r.recurrence();
  expect(S(rec.terms(20))).toEqual(Array.from({ length: 20 }, (_, n) => String(fibonacci(n))));
});

test("linear recurrences: terms, fast term, generating function", () => {
  const fib = recurrence({ coefficients: [1, 1], initial: [0, 1] });
  expect(S(fib.terms(30))).toEqual(Array.from({ length: 30 }, (_, n) => String(fibonacci(n))));
  expect(String(fib.term(200))).toBe(String(fibonacci(200)));
  expect(S(fib.generatingFunction().terms(15))).toEqual(S(fib.terms(15)));
  const h = recurrence({ coefficients: [2], initial: [0], plus: [1] });
  expect(S(h.terms(8))).toEqual(["0", "1", "3", "7", "15", "31", "63", "127"]);
});

test("closed forms are checked against the terms, independently here", () => {
  const cases = [
    recurrence({ coefficients: [1, 1], initial: [0, 1] }),
    recurrence({ coefficients: [4, -4], initial: [1, 4] }),
    recurrence({ coefficients: [0, -1], initial: [1, 0] }),
    recurrence({ coefficients: [2], initial: [0], plus: [1] }),
    recurrence({ coefficients: [3], initial: [1], plus: { poly: [0, 1], base: 2 } }),
  ];
  for (const r of cases) {
    const cf = r.closedForm();
    const ts = r.terms(14);
    for (let n = cf.validFrom ?? 0; n < 14; n++) {
      expect(alg.equals(cf.at(n), alg.fromRational(ts[n]))).toBe(true);
    }
  }
  expect(recurrence({ coefficients: [1, 1], initial: [0, 1] }).closedForm().toString()).toContain("√5");
});

test("guessing a recurrence from terms (Berlekamp–Massey)", () => {
  const g = guessRecurrence([0, 1, 1, 2, 3, 5, 8, 13, 21, 34]);
  expect(S(g.terms(10))).toEqual(["0", "1", "1", "2", "3", "5", "8", "13", "21", "34"]);
  expect(g.coefficients.map(String)).toEqual(["1", "1"]);
  const p = guessRecurrence([1, 2, 4, 8, 16, 32]);
  expect(p.coefficients.map(String)).toEqual(["2"]);
});

test("closed sums: Σ k² and Σ k·2^k", () => {
  const sq = closedSum([0, 0, 1]);
  for (let n = 0; n < 12; n++) {
    let s = 0;
    for (let k = 0; k <= n; k++) s += k * k;
    expect(String(sq.at(n))).toBe(String(s));
  }
  const geo = closedSum([0, 1], 2);
  for (let n = 0; n < 12; n++) {
    let s = 0;
    for (let k = 0; k <= n; k++) s += k * 2 ** k;
    expect(String(geo.at(n))).toBe(String(s));
  }
});

test("master theorem and divide-and-conquer recurrences", () => {
  expect(masterTheorem({ a: 2, b: 2, d: 1 }).case).toBe(2);
  expect(masterTheorem({ a: 8, b: 2, d: 2 }).case).toBe(1);
  expect(masterTheorem({ a: 1, b: 2, d: 0 }).case).toBe(2);
  expect(masterTheorem({ a: 2, b: 4, d: 1 }).case).toBe(3);
  expect(masterTheorem({ a: 3, b: 2, d: 1 }).bound).toBe("Θ(n^(log_2 3))");
  expect(masterTheorem({ a: 8, b: 2, d: 2 }).bound).toBe("Θ(n^3)");
  // merge sort: T(n) = 2T(n/2) + n, T(1) = 1 gives n·log₂n + n exactly at powers of 2
  const t = divideAndConquer({ a: 2, b: 2, f: (n) => n, t1: 1 }, 8);
  t.forEach(({ n, value }, m) => expect(String(value)).toBe(String(n * BigInt(m) + n)));
});
