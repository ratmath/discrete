// A seeded random generator. The same seed gives the same stream on every
// machine and in every JavaScript engine, because everything is integer
// arithmetic: no floating-point number is involved unless float() is asked for.
//
// Uniform whole numbers of any size are drawn by rejection, so they are
// exactly uniform, with no bias from a remainder. Probabilities are exact
// fractions.
//
// The generator is xoshiro128**, seeded through SplitMix32. It is meant for
// simulations, sampling and reproducible examples, not for secrets.

import { Rational } from "@ratmath/core";
import { natural, whole } from "./counting.js";

const rotl = (x, k) => ((x << k) | (x >>> (32 - k))) >>> 0;

/** Four 32-bit words from any seed: a whole number of any size, or text. */
function seedWords(seed) {
  let bytes;
  if (typeof seed === "string") bytes = new TextEncoder().encode(seed);
  else {
    let n = whole(seed, "the seed");
    const neg = n < 0n;
    if (neg) n = -n;
    const out = [neg ? 1 : 0];
    do {
      out.push(Number(n & 0xffn));
      n >>= 8n;
    } while (n > 0n);
    bytes = Uint8Array.from(out);
  }
  // FNV-1a over the bytes, then SplitMix32 to spread it over the state
  let h = 0x811c9dc5;
  for (const b of bytes) h = Math.imul(h ^ b, 0x01000193) >>> 0;
  h = (h ^ bytes.length) >>> 0;
  const words = [];
  for (let i = 0; i < 4; i++) {
    h = (h + 0x9e3779b9) >>> 0;
    let z = h;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    words.push((z ^ (z >>> 16)) >>> 0);
  }
  if (words.every((w) => w === 0)) words[0] = 1;
  return words;
}

const asFraction = (p) => {
  if (p instanceof Rational) return p;
  if (typeof p === "bigint") return new Rational(p);
  if (typeof p === "number") return new Rational(String(p));
  if (typeof p === "string") return new Rational(p.trim());
  if (p && typeof p.numerator === "bigint") return new Rational(p.numerator, p.denominator);
  throw new TypeError(`cannot read ${p} as a fraction`);
};

export class Random {
  #s;
  constructor(seed = 0) {
    this.#s = Array.isArray(seed) && seed.length === 4 ? seed.map((w) => w >>> 0) : seedWords(seed);
    if (this.#s.every((w) => w === 0)) throw new RangeError("the state must not be all zeros");
  }
  /** The next 32 random bits, as a number from 0 to 2³² − 1. */
  u32() {
    const s = this.#s;
    const result = Math.imul(rotl(Math.imul(s[1], 5) >>> 0, 7), 9) >>> 0;
    const t = (s[1] << 9) >>> 0;
    s[2] = (s[2] ^ s[0]) >>> 0;
    s[3] = (s[3] ^ s[1]) >>> 0;
    s[1] = (s[1] ^ s[2]) >>> 0;
    s[0] = (s[0] ^ s[3]) >>> 0;
    s[2] = (s[2] ^ t) >>> 0;
    s[3] = rotl(s[3], 11);
    return result;
  }
  /** k random bits as a BigInt in [0, 2^k). */
  bits(k) {
    let out = 0n;
    let left = k;
    while (left >= 32) {
      out = (out << 32n) | BigInt(this.u32());
      left -= 32;
    }
    if (left > 0) out = (out << BigInt(left)) | BigInt(this.u32() >>> (32 - left));
    return out;
  }
  /**
   * A uniform whole number in [0, n): exactly uniform, for n of any size.
   * A number in gives a number out, a BigInt in gives a BigInt out.
   */
  int(n) {
    const big = typeof n === "bigint";
    const m = natural(n, "n");
    if (m === 0n) throw new RangeError("int(n) needs n ≥ 1");
    if (!big && m <= 0x100000000n) {
      // one word at a time, rejecting the incomplete last block
      const mm = Number(m);
      const limit = 0x100000000 - (0x100000000 % mm);
      for (;;) {
        const r = this.u32();
        if (r < limit) return r % mm;
      }
    }
    const k = (m - 1n).toString(2).length;
    for (;;) {
      const r = this.bits(m === 1n ? 0 : k);
      if (r < m) return big ? r : Number(r);
    }
  }
  /** A uniform whole number from lo to hi, both included. */
  between(lo, hi) {
    const a = whole(lo, "lo");
    const b = whole(hi, "hi");
    if (b < a) throw new RangeError("between(lo, hi) needs lo ≤ hi");
    const r = a + this.int(b - a + 1n);
    return typeof lo === "bigint" || typeof hi === "bigint" ? r : Number(r);
  }
  /** True with probability p, an exact fraction (default 1/2). */
  bool(p = "1/2") {
    const q = asFraction(p);
    if (q.numerator < 0n || q.numerator > q.denominator) throw new RangeError("a probability lies between 0 and 1");
    return this.int(q.denominator) < q.numerator;
  }
  /** A uniform fraction k/denominator with 0 ≤ k < denominator, as a Core Rational. */
  rational(denominator = 1n << 53n) {
    const d = natural(denominator, "the denominator");
    return new Rational(this.int(d), d);
  }
  /** A double in [0, 1) with 53 random bits. The one method here that is not exact. */
  float() {
    return Number(this.bits(53)) / 2 ** 53;
  }
  /** One element of an array, uniformly. */
  pick(items) {
    if (!items.length) throw new RangeError("cannot pick from nothing");
    return items[this.int(items.length)];
  }
  /** A new array with the same elements in a uniformly random order (Fisher–Yates). */
  shuffle(items) {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  /** k distinct elements, in random order: a uniform arrangement of k out of the array. */
  sample(items, k) {
    const a = [...items];
    if (k > a.length) throw new RangeError(`cannot take ${k} distinct elements from ${a.length}`);
    for (let i = 0; i < k; i++) {
      const j = i + this.int(a.length - i);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, k);
  }
  /**
   * The index of one of the weights, chosen with probability proportional to
   * it. Weights are exact fractions (numbers, text or Rationals), not all 0.
   */
  weightedIndex(weights) {
    const ws = weights.map(asFraction);
    if (ws.some((w) => w.numerator < 0n)) throw new RangeError("weights must not be negative");
    const den = ws.reduce((l, w) => (l * w.denominator) / gcd(l, w.denominator), 1n);
    const ints = ws.map((w) => (w.numerator * den) / w.denominator);
    const total = ints.reduce((a, b) => a + b, 0n);
    if (total === 0n) throw new RangeError("the weights are all zero");
    let r = this.int(total);
    for (let i = 0; i < ints.length; i++) {
      if (r < ints[i]) return i;
      r -= ints[i];
    }
    /* c8 ignore next */
    throw new Error("unreachable");
  }
  /** One of the items, with probability proportional to its weight. */
  weighted(items, weights) {
    if (items.length !== weights.length) throw new RangeError("one weight for each item");
    return items[this.weightedIndex(weights)];
  }
  /**
   * An independent generator derived from this one's seed state and a label,
   * without advancing this one: give each part of a simulation its own
   * stream, so that changing one part does not change the numbers another sees.
   */
  fork(label = "") {
    return new Random(`${this.#s.join(",")}/${label}`);
  }
  /** The state: four 32-bit words. new Random(state) resumes from it. */
  get state() {
    return [...this.#s];
  }
  clone() {
    return new Random(this.state);
  }
}
const gcd = (a, b) => {
  while (b) [a, b] = [b, a % b];
  return a;
};

/** A seeded generator: rng(2026), rng("experiment 3"), rng(12345678901234567890n). */
export const rng = (seed = 0) => new Random(seed);
