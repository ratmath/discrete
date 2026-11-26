// Enumeration with ranking. Each family of combinatorial objects is listed in
// a fixed order, and the family knows how many objects it has, which object
// stands at a given place (unrank) and at which place a given object stands
// (rank), all without listing the others. So the millionth permutation of 20
// things costs a few hundred operations, and a uniformly random object is
// unrank(a uniform random place).

import { binomial, factorial, natural, partsBounded, refuse, size, whole, DiscreteError } from "./counting.js";
import { Random } from "./random.js";

const big = (x) => BigInt(x);

/** The things being arranged: 1…n for a number n, or the given distinct items. */
function ground(spec, what = "the set") {
  if (Array.isArray(spec)) {
    const index = new Map();
    spec.forEach((x, i) => {
      if (index.has(x)) throw new RangeError(`${what} lists ${String(x)} twice; items must be distinct`);
      index.set(x, i);
    });
    return { n: spec.length, item: (i) => spec[i], indexOf: (x) => (index.has(x) ? index.get(x) : refuse("not-in-family", `${String(x)} is not one of the items`)) };
  }
  const n = size(spec, what, 100000);
  return {
    n,
    item: (i) => i + 1,
    indexOf: (x) => {
      const v = Number(x);
      if (!Number.isInteger(v) || v < 1 || v > n) refuse("not-in-family", `${String(x)} is not one of 1…${n}`);
      return v - 1;
    },
  };
}

/**
 * A finite family of objects in a fixed order.
 *
 *   count          how many there are (a BigInt)
 *   unrank(i)      the object at place i, counting from 0
 *   rank(object)   the place of an object
 *   random(rng)    a uniformly random object
 *   for…of         all of them in order
 */
export class Family {
  constructor({ name, count, unrank, rank, order, iterate }) {
    this.name = name;
    this.count = count;
    this.order = order ?? "lexicographic";
    this._unrank = unrank;
    this._rank = rank;
    this._iterate = iterate;
    Object.freeze(this);
  }
  /** The object at place i (0 ≤ i < count). Negative i counts from the end. */
  unrank(i) {
    let k = whole(i, "the rank");
    if (k < 0n) k += this.count;
    if (k < 0n || k >= this.count) throw new RangeError(`rank ${i} is outside 0…${this.count - 1n} (${this.name})`);
    return this._unrank(k);
  }
  at(i) {
    return this.unrank(i);
  }
  /** The place of an object, a BigInt; refuses an object that is not in the family. */
  rank(object) {
    if (!this._rank) refuse("no-rank", `${this.name} has no ranking`);
    return this._rank(object);
  }
  /** True when the object belongs to the family. */
  has(object) {
    try {
      this._rank(object);
      return true;
    } catch (e) {
      if (e instanceof DiscreteError || e instanceof RangeError || e instanceof TypeError) return false;
      throw e;
    }
  }
  /** A uniformly random object: pass a Random, or a seed. */
  random(generator) {
    if (this.count === 0n) throw new RangeError(`${this.name} is empty`);
    const r = generator instanceof Random ? generator : new Random(generator ?? 0);
    return this._unrank(r.int(this.count));
  }
  /** The first n objects. */
  first(n = 10) {
    return this.slice(0, n);
  }
  /** The objects at places from ≤ i < to. */
  slice(from = 0, to = this.count) {
    let a = whole(from, "from");
    let b = whole(to, "to");
    if (a < 0n) a = 0n;
    if (b > this.count) b = this.count;
    if (b - a > 1000000n) refuse("too-large", `that is ${b - a} objects; take a smaller slice`);
    const out = [];
    if (this._iterate && a === 0n) {
      for (const x of this._iterate()) {
        if (big(out.length) >= b) break;
        out.push(x);
      }
      return out;
    }
    for (let i = a; i < b; i++) out.push(this._unrank(i));
    return out;
  }
  /** Every object, as an array; refuses more than a million. */
  toArray() {
    return this.slice(0n, this.count);
  }
  *[Symbol.iterator]() {
    if (this._iterate) yield* this._iterate();
    else for (let i = 0n; i < this.count; i++) yield this._unrank(i);
  }
  toString() {
    return `${this.name}: ${this.count} objects`;
  }
}

// ---- permutations ------------------------------------------------------------------------------

/**
 * Arrangements of all n things, or with k, of k out of n, in lexicographic
 * order. permutations(3) lists [1,2,3], [1,3,2], [2,1,3], …;
 * permutations(["a","b","c"], 2) lists ["a","b"], ["a","c"], ["b","a"], ….
 */
export function permutations(spec, k) {
  const g = ground(spec);
  const n = g.n;
  const kk = k === undefined ? n : size(k, "k");
  const count = kk > n ? 0n : factorial(n) / factorial(n - kk);
  // place value of position p: (n − p − 1)(n − p − 2)…(n − k + 1)
  const weight = (p) => factorial(n - p - 1) / factorial(n - kk);
  const unrank = (r) => {
    const pool = Array.from({ length: n }, (_, i) => i);
    const out = [];
    for (let p = 0; p < kk; p++) {
      const w = weight(p);
      const d = Number(r / w);
      r %= w;
      out.push(g.item(pool.splice(d, 1)[0]));
    }
    return out;
  };
  const rank = (obj) => {
    if (!Array.isArray(obj) || obj.length !== kk) refuse("not-in-family", `an arrangement of ${kk} items is needed`);
    const pool = Array.from({ length: n }, (_, i) => i);
    let r = 0n;
    obj.forEach((x, p) => {
      const d = pool.indexOf(g.indexOf(x));
      if (d < 0) refuse("not-in-family", `${String(x)} appears twice`);
      pool.splice(d, 1);
      r += big(d) * weight(p);
    });
    return r;
  };
  const iterate = kk !== n ? undefined : function* all() {
    // the classical next-permutation step
    const a = Array.from({ length: n }, (_, i) => i);
    for (;;) {
      yield a.map(g.item);
      let i = n - 2;
      while (i >= 0 && a[i] > a[i + 1]) i--;
      if (i < 0) return;
      let j = n - 1;
      while (a[j] < a[i]) j--;
      [a[i], a[j]] = [a[j], a[i]];
      for (let lo = i + 1, hi = n - 1; lo < hi; lo++, hi--) [a[lo], a[hi]] = [a[hi], a[lo]];
    }
  };
  return new Family({ name: kk === n ? `permutations of ${n}` : `arrangements of ${kk} out of ${n}`, count, unrank, rank, iterate });
}

/** How many fixed points remain possible decides how many derangements complete a prefix. */
function derangeCompletions(r, j) {
  // permutations of r things in which j particular ones must not stay put
  let s = 0n;
  for (let i = 0; i <= j; i++) {
    const t = binomial(j, i) * factorial(r - i);
    s += i % 2 ? -t : t;
  }
  return s;
}
/** Permutations with no fixed point, in lexicographic order. */
export function derangements(spec) {
  const g = ground(spec);
  const n = g.n;
  // after placing values at positions 0…p, count completions: among the
  // remaining positions, those whose own value is still unused are constrained
  const completions = (p, used) => {
    let j = 0;
    for (let q = p + 1; q < n; q++) if (!used[q]) j++;
    return derangeCompletions(n - p - 1, j);
  };
  const count = derangeCompletions(n, n);
  const unrank = (r) => {
    const used = Array(n).fill(false);
    const out = [];
    for (let p = 0; p < n; p++) {
      for (let v = 0; v < n; v++) {
        if (used[v] || v === p) continue;
        used[v] = true;
        const c = completions(p, used);
        if (r < c) {
          out.push(g.item(v));
          break;
        }
        r -= c;
        used[v] = false;
      }
    }
    return out;
  };
  const rank = (obj) => {
    if (!Array.isArray(obj) || obj.length !== n) refuse("not-in-family", `a permutation of ${n} items is needed`);
    const used = Array(n).fill(false);
    let r = 0n;
    obj.forEach((x, p) => {
      const target = g.indexOf(x);
      if (target === p) refuse("not-in-family", `${String(x)} is a fixed point`);
      if (used[target]) refuse("not-in-family", `${String(x)} appears twice`);
      for (let v = 0; v < target; v++) {
        if (used[v] || v === p) continue;
        used[v] = true;
        r += completions(p, used);
        used[v] = false;
      }
      used[target] = true;
    });
    return r;
  };
  return new Family({ name: `derangements of ${n}`, count, unrank, rank });
}

// ---- subsets -----------------------------------------------------------------------------------

/**
 * k-element subsets of n things, each listed in increasing order, the list in
 * lexicographic order: combinations(4, 2) is [1,2], [1,3], [1,4], [2,3], [2,4], [3,4].
 */
export function combinations(spec, k) {
  const g = ground(spec);
  const n = g.n;
  const kk = size(k, "k");
  const count = binomial(n, kk);
  const unrankIdx = (r) => {
    const out = [];
    let v = 0;
    for (let p = 0; p < kk; p++) {
      // subsets that continue with v: choose the remaining k − p − 1 from the n − v − 1 after it
      for (;; v++) {
        const c = binomial(n - v - 1, kk - p - 1);
        if (r < c) break;
        r -= c;
      }
      out.push(v++);
    }
    return out;
  };
  const rankIdx = (idx) => {
    let r = 0n;
    let v = 0;
    idx.forEach((x, p) => {
      if (x < v) refuse("not-in-family", "the elements of a combination are listed in increasing order, without repeats");
      for (; v < x; v++) r += binomial(n - v - 1, kk - p - 1);
      v = x + 1;
    });
    return r;
  };
  const rank = (obj) => {
    if (!Array.isArray(obj) || obj.length !== kk) refuse("not-in-family", `a selection of ${kk} items is needed`);
    return rankIdx(obj.map(g.indexOf));
  };
  const iterate = function* all() {
    if (kk > n) return;
    const a = Array.from({ length: kk }, (_, i) => i);
    for (;;) {
      yield a.map(g.item);
      let i = kk - 1;
      while (i >= 0 && a[i] === n - kk + i) i--;
      if (i < 0) return;
      a[i]++;
      for (let j = i + 1; j < kk; j++) a[j] = a[j - 1] + 1;
    }
  };
  return new Family({ name: `${kk}-element subsets of ${n}`, count, unrank: (r) => unrankIdx(r).map(g.item), rank, iterate });
}

/**
 * Selections of k from n kinds with repetition allowed, each listed in
 * non-decreasing order: multisets(3, 2) is [1,1], [1,2], [1,3], [2,2], [2,3], [3,3].
 */
export function multisets(spec, k) {
  const g = ground(spec);
  const n = g.n;
  const kk = size(k, "k");
  // m₁ ≤ m₂ ≤ … ≤ m_k  ↔  the strictly increasing m_i + i, a k-subset of n + k − 1
  const inner = n === 0 ? null : combinations(n + kk - 1, kk);
  const count = n === 0 ? (kk === 0 ? 1n : 0n) : inner.count;
  const unrank = (r) => (inner ? inner._unrank(r).map((c, i) => g.item(c - 1 - i)) : []);
  const rank = (obj) => {
    if (!Array.isArray(obj) || obj.length !== kk) refuse("not-in-family", `a selection of ${kk} items is needed`);
    const idx = obj.map(g.indexOf);
    for (let i = 1; i < kk; i++) if (idx[i] < idx[i - 1]) refuse("not-in-family", "a multiset is listed in non-decreasing order");
    return inner ? inner._rank(idx.map((m, i) => m + i + 1)) : 0n;
  };
  return new Family({ name: `multisets of size ${kk} from ${n}`, count, unrank, rank });
}

/**
 * All subsets of n things. In the default order the rank is the binary number
 * whose bit i says whether item i is in; with { order: "gray" } neighbours in
 * the list differ by exactly one element; with { order: "size" } smaller
 * subsets come first.
 */
export function subsets(spec, { order = "binary" } = {}) {
  const g = ground(spec);
  const n = g.n;
  const count = 1n << big(n);
  const fromMask = (m) => {
    const out = [];
    for (let i = 0; i < n; i++) if ((m >> big(i)) & 1n) out.push(g.item(i));
    return out;
  };
  const toMask = (obj) => {
    if (!Array.isArray(obj)) refuse("not-in-family", "a subset is given as an array");
    let m = 0n;
    for (const x of obj) {
      const bit = 1n << big(g.indexOf(x));
      if (m & bit) refuse("not-in-family", `${String(x)} appears twice`);
      m |= bit;
    }
    return m;
  };
  if (order === "binary") return new Family({ name: `subsets of ${n}`, order, count, unrank: fromMask, rank: toMask });
  if (order === "gray") {
    const ungray = (gcode) => {
      let b = 0n;
      for (; gcode > 0n; gcode >>= 1n) b ^= gcode;
      return b;
    };
    return new Family({ name: `subsets of ${n}, one change at a time`, order, count, unrank: (r) => fromMask(r ^ (r >> 1n)), rank: (obj) => ungray(toMask(obj)) });
  }
  if (order === "size") {
    const before = (k) => {
      let s = 0n;
      for (let j = 0; j < k; j++) s += binomial(n, j);
      return s;
    };
    const unrank = (r) => {
      let k = 0;
      for (; ; k++) {
        const c = binomial(n, k);
        if (r < c) break;
        r -= c;
      }
      return combinations(spec, k)._unrank(r);
    };
    const rank = (obj) => {
      if (!Array.isArray(obj)) refuse("not-in-family", "a subset is given as an array");
      const sorted = [...obj].sort((a, b) => g.indexOf(a) - g.indexOf(b));
      return before(sorted.length) + combinations(spec, sorted.length)._rank(sorted);
    };
    return new Family({ name: `subsets of ${n}, by size`, order, count, unrank, rank });
  }
  throw new RangeError(`unknown order ${order}: use "binary", "gray" or "size"`);
}

/** Words of length k over n letters (k-tuples with repetition), in dictionary order: n^k of them. */
export function words(spec, k) {
  const g = ground(spec, "the alphabet");
  const n = big(g.n);
  const kk = size(k, "k");
  const count = n ** big(kk);
  const unrank = (r) => {
    const out = Array(kk);
    for (let p = kk - 1; p >= 0; p--) {
      out[p] = g.item(Number(r % n));
      r /= n;
    }
    return out;
  };
  const rank = (obj) => {
    const letters = typeof obj === "string" ? [...obj] : obj;
    if (!Array.isArray(letters) || letters.length !== kk) refuse("not-in-family", `a word of length ${kk} is needed`);
    return letters.reduce((r, x) => r * n + big(g.indexOf(x)), 0n);
  };
  return new Family({ name: `words of length ${kk} over ${g.n} letters`, count, unrank, rank });
}

/** The Cartesian product of arrays or families: every way to take one object from each, the last varying fastest. */
export function product(...factors) {
  const fs = factors.map((f) => (f instanceof Family ? f : Array.isArray(f) ? { count: big(f.length), _unrank: (r) => f[Number(r)], _rank: (x) => (f.indexOf(x) >= 0 ? big(f.indexOf(x)) : refuse("not-in-family", `${String(x)} is not in a factor`)) } : refuse("bad-argument", "product takes arrays and families")));
  const count = fs.reduce((c, f) => c * f.count, 1n);
  const unrank = (r) => {
    const out = Array(fs.length);
    for (let p = fs.length - 1; p >= 0; p--) {
      out[p] = fs[p]._unrank(r % fs[p].count);
      r /= fs[p].count;
    }
    return out;
  };
  const rank = (obj) => {
    if (!Array.isArray(obj) || obj.length !== fs.length) refuse("not-in-family", `one object from each of the ${fs.length} factors is needed`);
    return obj.reduce((r, x, p) => r * fs[p].count + fs[p]._rank(x), 0n);
  };
  return new Family({ name: `product of ${fs.length} families`, count, unrank, rank });
}

// ---- sums --------------------------------------------------------------------------------------

/**
 * Compositions of n: ordered lists of positive whole numbers adding to n, in
 * lexicographic order. With k, exactly k parts. With { zero: true } (and k)
 * parts may be 0: the ways to put n identical things in k boxes.
 */
export function compositions(n, k, { zero = false } = {}) {
  const total = size(n, "n");
  if (k === undefined) {
    if (zero) throw new RangeError("compositions with zero parts need a number of parts k");
    // a composition of n is a choice of which of the n − 1 gaps are cuts; lexicographic order
    // puts small first parts first, so an early cut (bit set) comes before no cut
    const count = total === 0 ? 1n : 1n << big(total - 1);
    const unrank = (r) => {
      const out = [];
      let part = 1;
      for (let gap = total - 2; gap >= 0; gap--) {
        // the higher bit decides the earlier gap; 0 = cut here
        if ((r >> big(gap)) & 1n) part++;
        else {
          out.push(part);
          part = 1;
        }
      }
      if (total > 0) out.push(part);
      return out;
    };
    const rank = (obj) => {
      checkParts(obj, total, 1);
      let r = 0n;
      let gap = total - 2;
      obj.forEach((part, i) => {
        for (let j = 1; j < part; j++, gap--) r |= 1n << big(gap);
        if (i < obj.length - 1) gap--;
      });
      return r;
    };
    return new Family({ name: `compositions of ${total}`, count, unrank, rank });
  }
  const kk = size(k, "k");
  const min = zero ? 0 : 1;
  // compositions of `rest` into `parts` parts, each ≥ min
  const ways = (rest, parts) => {
    if (parts === 0) return rest === 0 ? 1n : 0n;
    const free = rest - parts * min;
    return free < 0 ? 0n : binomial(free + parts - 1, parts - 1);
  };
  const count = ways(total, kk);
  const unrank = (r) => {
    const out = [];
    let rest = total;
    for (let p = 0; p < kk; p++) {
      for (let v = min; ; v++) {
        const c = ways(rest - v, kk - p - 1);
        if (r < c) {
          out.push(v);
          rest -= v;
          break;
        }
        r -= c;
      }
    }
    return out;
  };
  const rank = (obj) => {
    checkParts(obj, total, min);
    if (obj.length !== kk) refuse("not-in-family", `exactly ${kk} parts are needed`);
    let r = 0n;
    let rest = total;
    obj.forEach((part, p) => {
      for (let v = min; v < part; v++) r += ways(rest - v, kk - p - 1);
      rest -= part;
    });
    return r;
  };
  return new Family({ name: `compositions of ${total} into ${kk} parts${zero ? ", zeros allowed" : ""}`, count, unrank, rank });
}
function checkParts(obj, total, min) {
  if (!Array.isArray(obj) || obj.some((p) => !Number.isInteger(p) || p < min)) refuse("not-in-family", `parts must be whole numbers ≥ ${min}`);
  if (obj.reduce((a, b) => a + b, 0) !== total) refuse("not-in-family", `the parts must add to ${total}`);
}

/**
 * Partitions of the integer n: non-increasing lists of positive whole numbers
 * adding to n, largest first part first ([n] comes first, [1,1,…,1] last).
 * With k, exactly k parts.
 */
export function partitions(n, k) {
  const total = size(n, "n", 2000);
  const exact = k === undefined ? null : size(k, "k");
  // partitions of `rest` with every part ≤ cap, into exactly `parts` parts or any number
  const ways = (rest, cap, parts) => {
    if (parts !== null) return partsBounded(rest, parts, cap);
    let s = 0n;
    for (let j = rest === 0 ? 0 : 1; j <= rest; j++) s += partsBounded(rest, j, cap);
    return s;
  };
  const anyCache = new Map();
  const waysAny = (rest, cap) => {
    const key = rest * 4096 + Math.min(cap, rest);
    if (!anyCache.has(key)) anyCache.set(key, ways(rest, cap, null));
    return anyCache.get(key);
  };
  const w = (rest, cap, parts) => (parts === null ? waysAny(rest, cap) : ways(rest, cap, parts));
  const count = w(total, total, exact);
  const unrank = (r) => {
    const out = [];
    let rest = total;
    let cap = total;
    let parts = exact;
    while (rest > 0) {
      for (let f = Math.min(cap, rest); ; f--) {
        const c = w(rest - f, f, parts === null ? null : parts - 1);
        if (r < c) {
          out.push(f);
          rest -= f;
          cap = f;
          if (parts !== null) parts--;
          break;
        }
        r -= c;
      }
    }
    return out;
  };
  const rank = (obj) => {
    checkParts(obj, total, 1);
    if (exact !== null && obj.length !== exact) refuse("not-in-family", `exactly ${exact} parts are needed`);
    let r = 0n;
    let rest = total;
    let cap = total;
    let parts = exact;
    for (const part of obj) {
      if (part > cap) refuse("not-in-family", "the parts of a partition are listed largest first");
      for (let f = Math.min(cap, rest); f > part; f--) r += w(rest - f, f, parts === null ? null : parts - 1);
      rest -= part;
      cap = part;
      if (parts !== null) parts--;
    }
    return r;
  };
  return new Family({ name: exact === null ? `partitions of ${total}` : `partitions of ${total} into ${exact} parts`, order: "largest part first", count, unrank, rank });
}

/**
 * Partitions of a set into non-empty blocks; with k, into exactly k blocks.
 * Each partition is an array of blocks, the blocks ordered by their smallest
 * element. The order is that of restricted growth strings: element i goes in
 * an existing block or opens the next new one.
 */
export function setPartitions(spec, k) {
  const g = ground(spec);
  const n = g.n;
  const exact = k === undefined ? null : size(k, "k");
  // completions when r elements remain and m blocks are open
  const cache = new Map();
  const ways = (r, m) => {
    if (exact !== null && m > exact) return 0n;
    if (r === 0) return exact === null || m === exact ? 1n : 0n;
    const key = r * 65536 + m;
    let v = cache.get(key);
    if (v === undefined) {
      v = big(m) * ways(r - 1, m) + ways(r - 1, m + 1);
      cache.set(key, v);
    }
    return v;
  };
  if (n > 3000) refuse("too-large", "set partitions of more than 3000 elements are not ranked here");
  const count = ways(n, 0);
  const unrank = (r) => {
    const blocks = [];
    for (let i = 0; i < n; i++) {
      const m = blocks.length;
      const each = ways(n - i - 1, m);
      const into = m === 0 || each === 0n ? big(m) : r / each;
      if (into < big(m)) {
        blocks[Number(into)].push(g.item(i));
        r -= into * each;
      } else {
        r -= big(m) * each;
        blocks.push([g.item(i)]);
      }
    }
    return blocks;
  };
  const rank = (obj) => {
    if (!Array.isArray(obj) || obj.some((b) => !Array.isArray(b) || b.length === 0)) refuse("not-in-family", "a set partition is an array of non-empty blocks");
    const blockOf = Array(n).fill(-1);
    obj.forEach((b, j) => b.forEach((x) => {
      const i = g.indexOf(x);
      if (blockOf[i] !== -1) refuse("not-in-family", `${String(x)} is in two blocks`);
      blockOf[i] = j;
    }));
    if (blockOf.includes(-1)) refuse("not-in-family", "every element must be in a block");
    if (exact !== null && obj.length !== exact) refuse("not-in-family", `exactly ${exact} blocks are needed`);
    // relabel blocks in order of first appearance: the restricted growth string
    const label = new Map();
    let r = 0n;
    for (let i = 0; i < n; i++) {
      const m = label.size;
      if (!label.has(blockOf[i])) {
        r += big(m) * ways(n - i - 1, m);
        label.set(blockOf[i], m);
      } else r += big(label.get(blockOf[i])) * ways(n - i - 1, m);
    }
    return r;
  };
  return new Family({ name: exact === null ? `partitions of a ${n}-set` : `partitions of a ${n}-set into ${exact} blocks`, order: "restricted growth", count, unrank, rank });
}

/**
 * Balanced strings of n pairs of brackets (Dyck words), "(" before ")":
 * dyckWords(3) is "((()))", "(()())", "(())()", "()(())", "()()()". There are
 * Catalan(n) of them, and they stand for binary trees, triangulations and
 * every other Catalan family.
 */
export function dyckWords(n, { open = "(", close = ")" } = {}) {
  const pairs = size(n, "n", 5000);
  // ways to finish with `left` opening brackets still to place and `height` brackets open:
  // the ballot numbers
  const cache = new Map();
  const ways = (left, height) => {
    if (left === 0) return 1n;
    const key = left * 16384 + height;
    let v = cache.get(key);
    if (v === undefined) {
      v = ways(left - 1, height + 1) + (height > 0 ? ways(left, height - 1) : 0n);
      cache.set(key, v);
    }
    return v;
  };
  const count = ways(pairs, 0);
  const unrank = (r) => {
    let out = "";
    let left = pairs;
    let height = 0;
    while (left > 0 || height > 0) {
      const c = left > 0 ? ways(left - 1, height + 1) : 0n;
      if (r < c) {
        out += open;
        left--;
        height++;
      } else {
        r -= c;
        out += close;
        height--;
      }
    }
    return out;
  };
  const rank = (obj) => {
    const s = Array.isArray(obj) ? obj.join("") : String(obj);
    if (s.length !== 2 * pairs) refuse("not-in-family", `a string of ${pairs} pairs of brackets is needed`);
    let r = 0n;
    let left = pairs;
    let height = 0;
    for (const ch of s) {
      if (ch === open) {
        if (left === 0) refuse("not-in-family", "too many opening brackets");
        left--;
        height++;
      } else if (ch === close) {
        if (height === 0) refuse("not-in-family", "a closing bracket with nothing open");
        if (left > 0) r += ways(left - 1, height + 1);
        height--;
      } else refuse("not-in-family", `unexpected character ${ch}`);
    }
    return r;
  };
  return new Family({ name: `balanced strings of ${pairs} pairs of brackets`, count, unrank, rank });
}
