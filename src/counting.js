// Counting: the numbers a combinatorics course is built on, as exact
// integers of any size. Every function returns a BigInt and accepts whole
// numbers as numbers or BigInts.

export class DiscreteError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "DiscreteError";
    this.code = code;
  }
}
export const refuse = (code, message) => {
  throw new DiscreteError(code, message);
};

/** A whole number as a BigInt; refuses fractions. */
export function whole(x, what = "argument") {
  if (typeof x === "bigint") return x;
  if (typeof x === "number" && Number.isInteger(x)) return BigInt(x);
  if (typeof x === "string" && /^\s*-?\d+\s*$/.test(x)) return BigInt(x.trim());
  if (x && typeof x.numerator === "bigint" && x.denominator === 1n) return x.numerator;
  throw new TypeError(`${what} must be a whole number, not ${typeof x === "string" ? JSON.stringify(x) : String(x)}`);
}
/** A whole number ≥ 0 as a BigInt. */
export function natural(x, what = "argument") {
  const n = whole(x, what);
  if (n < 0n) throw new RangeError(`${what} must not be negative: ${n}`);
  return n;
}
/** A small whole number ≥ 0 as a number, for sizes that index arrays. */
export function size(x, what = "argument", max = 100000) {
  const n = natural(x, what);
  if (n > BigInt(max)) refuse("too-large", `${what} = ${n} is too large here (the limit is ${max})`);
  return Number(n);
}

const factCache = [1n];
/** n! */
export function factorial(n) {
  const m = size(n, "n");
  for (let i = factCache.length; i <= m; i++) factCache.push(factCache[i - 1] * BigInt(i));
  return factCache[m];
}
/** n!! = n(n − 2)(n − 4)… */
export function doubleFactorial(n) {
  let m = natural(n, "n");
  let out = 1n;
  for (; m > 1n; m -= 2n) out *= m;
  return out;
}
/** The falling factorial n(n − 1)…(n − k + 1): arrangements of k out of n. n may be negative. */
export function fallingFactorial(n, k) {
  let m = whole(n, "n");
  const j = size(k, "k");
  let out = 1n;
  for (let i = 0; i < j; i++, m -= 1n) out *= m;
  return out;
}
/** The rising factorial n(n + 1)…(n + k − 1). */
export function risingFactorial(n, k) {
  let m = whole(n, "n");
  const j = size(k, "k");
  let out = 1n;
  for (let i = 0; i < j; i++, m += 1n) out *= m;
  return out;
}

/**
 * The binomial coefficient: the number of k-element subsets of an n-element
 * set. 0 when k < 0 or k > n ≥ 0. For negative n it is the coefficient of
 * x^k in (1 + x)^n, namely (−1)^k·C(k − n − 1, k).
 */
export function binomial(n, k) {
  const m = whole(n, "n");
  let j = whole(k, "k");
  if (j < 0n) return 0n;
  if (m < 0n) return (j % 2n ? -1n : 1n) * binomial(j - m - 1n, j);
  if (j > m) return 0n;
  if (j > m - j) j = m - j;
  let out = 1n;
  for (let i = 1n; i <= j; i++) out = (out * (m - j + i)) / i;
  return out;
}
/** The multinomial coefficient (k₁ + … + k_r)!/(k₁!…k_r!): arrangements of a word with those letter counts. */
export function multinomial(...ks) {
  const parts = (ks.length === 1 && Array.isArray(ks[0]) ? ks[0] : ks).map((k) => natural(k, "each part"));
  let total = 0n;
  let out = 1n;
  for (const k of parts) {
    total += k;
    out *= binomial(total, k);
  }
  return out;
}
/** Multisets of size k from n kinds ("n multichoose k"): C(n + k − 1, k). */
export function multichoose(n, k) {
  const m = natural(n, "n");
  const j = natural(k, "k");
  if (m === 0n) return j === 0n ? 1n : 0n;
  return binomial(m + j - 1n, j);
}

const rowCache = { s2: [[1n]], s1: [[1n]] };
function stirlingRow(kind, n) {
  const rows = rowCache[kind];
  for (let i = rows.length; i <= n; i++) {
    const prev = rows[i - 1];
    const row = Array(i + 1).fill(0n);
    for (let k = 1; k <= i; k++) row[k] = (prev[k - 1] ?? 0n) + (kind === "s2" ? BigInt(k) : BigInt(i - 1)) * (prev[k] ?? 0n);
    rows.push(row);
  }
  return rows[n];
}
/** Stirling numbers of the second kind: partitions of an n-set into k non-empty blocks. */
export function stirling2(n, k) {
  const m = size(n, "n", 3000);
  const j = whole(k, "k");
  return j < 0n || j > BigInt(m) ? 0n : stirlingRow("s2", m)[Number(j)];
}
/** Unsigned Stirling numbers of the first kind: permutations of n with exactly k cycles. { signed: true } gives the coefficient of x^k in x(x − 1)…(x − n + 1). */
export function stirling1(n, k, { signed = false } = {}) {
  const m = size(n, "n", 3000);
  const j = whole(k, "k");
  if (j < 0n || j > BigInt(m)) return 0n;
  const v = stirlingRow("s1", m)[Number(j)];
  return signed && (m - Number(j)) % 2 ? -v : v;
}
/** Bell numbers: all partitions of an n-set. */
export function bell(n) {
  const m = size(n, "n", 3000);
  return stirlingRow("s2", m).reduce((a, b) => a + b, 0n);
}
/** Surjections from an n-set onto a k-set: k!·S(n, k). */
export function surjections(n, k) {
  const j = size(k, "k", 3000);
  return factorial(j) * stirling2(n, j);
}
/** Catalan numbers: C(2n, n)/(n + 1). */
export function catalan(n) {
  const m = natural(n, "n");
  return binomial(2n * m, m) / (m + 1n);
}
/** Fibonacci numbers with F(0) = 0, F(1) = 1, by fast doubling; negative indices too. */
export function fibonacci(n) {
  const m = whole(n, "n");
  if (m < 0n) return (-m % 2n ? 1n : -1n) * fibonacci(-m);
  // (F(k), F(k+1)) → (F(2k), F(2k+1))
  let a = 0n;
  let b = 1n;
  for (const bit of m.toString(2)) {
    const c = a * (2n * b - a);
    const d = a * a + b * b;
    [a, b] = bit === "1" ? [d, c + d] : [c, d];
  }
  return a;
}
/** Lucas numbers: L(0) = 2, L(1) = 1. */
export function lucas(n) {
  const m = whole(n, "n");
  return fibonacci(m - 1n) + fibonacci(m + 1n);
}
/** Derangements: permutations of n with no fixed point. */
export function derangements(n) {
  const m = size(n, "n");
  let a = 1n; // D(0)
  let b = 0n; // D(1)
  if (m === 0) return a;
  for (let i = 2; i <= m; i++) [a, b] = [b, BigInt(i - 1) * (a + b)];
  return b;
}
/** Eulerian numbers: permutations of n with exactly k descents. */
export function eulerian(n, k) {
  const m = size(n, "n", 3000);
  const j = whole(k, "k");
  if (m === 0) return j === 0n ? 1n : 0n;
  if (j < 0n || j >= BigInt(m)) return 0n;
  let row = [1n];
  for (let i = 2; i <= m; i++) {
    const next = Array(i).fill(0n);
    for (let t = 0; t < i; t++) next[t] = BigInt(t + 1) * (row[t] ?? 0n) + BigInt(i - t) * (row[t - 1] ?? 0n);
    row = next;
  }
  return row[Number(j)];
}

// Partitions of n into exactly k parts, each at most m. Kept in one table
// because the enumeration (enumerate.js) ranks with the same numbers.
const partCache = new Map();
export function partsBounded(n, k, m) {
  if (k === 0) return n === 0 ? 1n : 0n;
  if (n < k || m < 1 || n > k * m) return 0n;
  if (m > n - k + 1) m = n - k + 1; // no part can be larger
  if (k === 1) return 1n;
  const key = `${n},${k},${m}`;
  let v = partCache.get(key);
  if (v !== undefined) return v;
  // the largest part is f; the rest is a partition of n − f into k − 1 parts ≤ f
  v = 0n;
  for (let f = m; f * k >= n; f--) v += partsBounded(n - f, k - 1, f);
  if (partCache.size > 400000) partCache.clear();
  partCache.set(key, v);
  return v;
}
const pCache = [1n];
/** Partitions of the integer n: ways to write it as a sum of positive whole numbers, order ignored. With k: into exactly k parts. */
export function partitionCount(n, k) {
  if (k !== undefined) {
    const m = size(n, "n", 2000);
    const j = whole(k, "k");
    return j < 0n || j > BigInt(m) ? 0n : partsBounded(m, Number(j), m);
  }
  const m = size(n, "n", 20000);
  // Euler's pentagonal number theorem
  for (let i = pCache.length; i <= m; i++) {
    let s = 0n;
    for (let j = 1; ; j++) {
      const g1 = (j * (3 * j - 1)) / 2;
      if (g1 > i) break;
      const g2 = (j * (3 * j + 1)) / 2;
      const t = pCache[i - g1] + (g2 <= i ? pCache[i - g2] : 0n);
      s += j % 2 ? t : -t;
    }
    pCache.push(s);
  }
  return pCache[m];
}
/** Compositions of n: ordered sums of positive parts, 2^(n−1) of them; with k, into exactly k parts: C(n − 1, k − 1). */
export function compositionCount(n, k) {
  const m = natural(n, "n");
  if (k === undefined) return m === 0n ? 1n : 1n << (m - 1n);
  const j = whole(k, "k");
  if (m === 0n) return j === 0n ? 1n : 0n;
  return binomial(m - 1n, j - 1n);
}

/** Row n of Pascal's triangle. */
export function pascalRow(n) {
  const m = size(n, "n", 5000);
  const row = [1n];
  for (let k = 1; k <= m; k++) row.push((row[k - 1] * BigInt(m - k + 1)) / BigInt(k));
  return row;
}

// ---- inclusion and exclusion --------------------------------------------------------------

/**
 * Inclusion and exclusion on actual sets (arrays or Sets of values compared
 * with ===): the size of the union as the alternating sum, level by level.
 *
 *   { union, terms: [{ size, sign, sum, count }], none }
 *
 * terms[j] is the sum of the sizes of all intersections of j + 1 of the sets.
 * `none` is how many elements of `universe` (an array, a Set or a count) are
 * in none of them, when a universe is given.
 */
export function inclusionExclusion(sets, { universe } = {}) {
  const list = sets.map((s) => (s instanceof Set ? s : new Set(s)));
  const m = list.length;
  if (m > 20) refuse("too-large", "inclusion and exclusion over more than 20 sets has over a million terms; use sieve() with a formula for the intersections");
  const sums = Array(m).fill(0n);
  const counts = Array(m).fill(0n);
  // every non-empty choice of sets, by bitmask, with its intersection carried down
  const walk = (start, chosen, inter) => {
    for (let i = start; i < m; i++) {
      const next = [];
      for (const x of inter ?? list[i]) if (list[i].has(x)) next.push(x);
      sums[chosen] += BigInt(next.length);
      counts[chosen] += 1n;
      if (next.length) walk(i + 1, chosen + 1, next);
      else {
        // empty from here on: count the deeper terms without visiting them
        for (let extra = 1; extra <= m - i - 1; extra++) counts[chosen + extra] += binomial(m - i - 1, extra);
      }
    }
  };
  walk(0, 0, null);
  const terms = sums.map((sum, j) => ({ size: j + 1, sign: j % 2 ? -1 : 1, sum, count: counts[j] }));
  const union = terms.reduce((s, t) => s + BigInt(t.sign) * t.sum, 0n);
  const out = { union, terms };
  if (universe !== undefined) {
    const total = typeof universe === "number" || typeof universe === "bigint" ? natural(universe, "universe") : BigInt(universe instanceof Set ? universe.size : universe.length);
    out.none = total - union;
  }
  return out;
}

/**
 * The sieve formula when the intersections are known by a rule instead of
 * listed: m properties, and `sizeOf(k)` the number of objects having any
 * particular k of them (the same for every choice of k: the usual case).
 * Returns { all, none, union, terms } where all = sizeOf(0),
 * none = Σ (−1)^k C(m, k) sizeOf(k) and union = all − none.
 *
 *   sieve(5, (k) => factorial(5 - k)).none   // 44n: derangements of 5
 */
export function sieve(m, sizeOf) {
  const count = size(m, "the number of properties", 10000);
  const terms = [];
  let none = 0n;
  for (let k = 0; k <= count; k++) {
    const each = whole(sizeOf(k), "sizeOf(k)");
    const sum = binomial(count, k) * each;
    terms.push({ size: k, sign: k % 2 ? -1 : 1, each, choices: binomial(count, k), sum });
    none += k % 2 ? -sum : sum;
  }
  const all = terms[0].sum;
  return { all, none, union: all - none, terms };
}

// ---- pigeonhole ------------------------------------------------------------------------------

/**
 * The pigeonhole principle in numbers: with `items` things in `holes` boxes,
 * some box holds at least ⌈items/holes⌉ and some box at most ⌊items/holes⌋.
 */
export function pigeonhole(items, holes) {
  const n = natural(items, "items");
  const h = natural(holes, "holes");
  if (h === 0n) throw new RangeError("there must be at least one hole");
  const atLeast = (n + h - 1n) / h;
  return { atLeast, atMost: n / h, forced: atLeast >= 2n, statement: `${n} items in ${h} boxes: some box holds at least ${atLeast}` };
}
/**
 * The principle on an example: the first two items that land in the same box,
 * where `key(item)` names the box. Returns { key, items: [a, b], indices } or
 * null when every item has a box of its own.
 */
export function collision(items, key = (x) => x) {
  const seen = new Map();
  let i = 0;
  for (const item of items) {
    const k = key(item);
    const id = typeof k === "object" && k !== null ? JSON.stringify(k, (_, v) => (typeof v === "bigint" ? `${v}n` : v)) : k;
    if (seen.has(id)) {
      const first = seen.get(id);
      return { key: k, items: [first.item, item], indices: [first.i, i] };
    }
    seen.set(id, { item, i });
    i++;
  }
  return null;
}
