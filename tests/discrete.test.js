import { describe, expect, test } from "bun:test";
import { Rational } from "@ratmath/core";
import * as D from "../index.js";

const S = (x) => JSON.stringify(x, (_, v) => (typeof v === "bigint" ? `${v}n` : v));

describe("counting", () => {
  test("factorials and binomials", () => {
    expect(D.factorial(0)).toBe(1n);
    expect(D.factorial(20)).toBe(2432902008176640000n);
    expect(D.factorial(30n)).toBe(265252859812191058636308480000000n);
    expect(D.doubleFactorial(7)).toBe(105n);
    expect(D.doubleFactorial(8)).toBe(384n);
    expect(D.fallingFactorial(5, 2)).toBe(20n);
    expect(D.risingFactorial(5, 2)).toBe(30n);
    expect(D.fallingFactorial(-2, 3)).toBe(-24n);
    expect(D.binomial(5, 2)).toBe(10n);
    expect(D.binomial(100, 50)).toBe(100891344545564193334812497256n);
    expect(D.binomial(5, 7)).toBe(0n);
    expect(D.binomial(5, -1)).toBe(0n);
    expect(D.binomial(-3, 2)).toBe(6n);
    expect(D.binomial(-3, 3)).toBe(-10n);
    expect(D.pascalRow(6)).toEqual([1n, 6n, 15n, 20n, 15n, 6n, 1n]);
    expect(D.multinomial(2, 1, 1)).toBe(12n);
    expect(D.multinomial([4, 4, 2, 1])).toBe(34650n); // MISSISSIPPI
    expect(D.multichoose(3, 2)).toBe(6n);
    expect(D.multichoose(0, 0)).toBe(1n);
    expect(() => D.factorial(-1)).toThrow(RangeError);
    expect(() => D.factorial(2.5)).toThrow(TypeError);
    expect(D.binomial(new Rational(6n), "2")).toBe(15n);
  });
  test("the named sequences", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((n) => D.bell(n))).toEqual([1n, 1n, 2n, 5n, 15n, 52n, 203n]);
    expect([0, 1, 2, 3, 4, 5].map((n) => D.catalan(n))).toEqual([1n, 1n, 2n, 5n, 14n, 42n]);
    expect([0, 1, 2, 3, 4, 5, 6].map((n) => D.derangementCount(n))).toEqual([1n, 0n, 1n, 2n, 9n, 44n, 265n]);
    expect([0, 1, 2, 3, 4, 5, 10].map((n) => D.fibonacci(n))).toEqual([0n, 1n, 1n, 2n, 3n, 5n, 55n]);
    expect(D.fibonacci(100)).toBe(354224848179261915075n);
    expect(D.fibonacci(-7)).toBe(13n);
    expect(D.fibonacci(-8)).toBe(-21n);
    expect(D.fibonacci(1000).toString().length).toBe(209);
    expect(D.lucas(10)).toBe(123n);
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((n) => D.partitionCount(n))).toEqual([1n, 1n, 2n, 3n, 5n, 7n, 11n, 15n]);
    expect(D.partitionCount(200)).toBe(3972999029388n);
    expect(D.partitionCount(8, 3)).toBe(5n);
    expect(D.compositionCount(5)).toBe(16n);
    expect(D.compositionCount(6, 3)).toBe(10n);
    expect(D.compositionCount(0)).toBe(1n);
  });
  test("Stirling and Eulerian numbers", () => {
    expect([0, 1, 2, 3, 4, 5].map((k) => D.stirling2(5, k))).toEqual([0n, 1n, 15n, 25n, 10n, 1n]);
    expect([0, 1, 2, 3, 4, 5].map((k) => D.stirling1(5, k))).toEqual([0n, 24n, 50n, 35n, 10n, 1n]);
    expect(D.stirling1(5, 2, { signed: true })).toBe(-50n);
    expect(D.stirling2(5, 9)).toBe(0n);
    expect(D.surjections(4, 2)).toBe(14n);
    expect([0, 1, 2, 3].map((k) => D.eulerian(4, k))).toEqual([1n, 11n, 11n, 1n]);
    // identities: Σ_k S(n,k) x^(falling k) = x^n at x = 7; rows sum to n! and Bell(n)
    for (const n of [0, 1, 4, 9]) {
      let s = 0n;
      for (let k = 0; k <= n; k++) s += D.stirling2(n, k) * D.fallingFactorial(7, k);
      expect(s).toBe(7n ** BigInt(n));
      let c = 0n;
      for (let k = 0; k <= n; k++) c += D.stirling1(n, k);
      expect(c).toBe(D.factorial(n));
    }
  });
  test("inclusion and exclusion on sets", () => {
    const r = D.inclusionExclusion([[1, 2, 3, 4], [3, 4, 5], new Set([4, 5, 6, 7])], { universe: 10 });
    expect(r.union).toBe(7n);
    expect(r.none).toBe(3n);
    expect(r.terms.map((t) => t.sum)).toEqual([11n, 5n, 1n]);
    expect(r.terms.map((t) => t.count)).toEqual([3n, 3n, 1n]);
    // multiples of 2, 3 or 5 up to 100
    const mult = (d) => Array.from({ length: Math.floor(100 / d) }, (_, i) => d * (i + 1));
    expect(D.inclusionExclusion([mult(2), mult(3), mult(5)], { universe: 100 }).none).toBe(26n);
    // disjoint sets: deeper terms are counted without being visited
    expect(D.inclusionExclusion([[1], [2], [3]]).terms.map((t) => t.count)).toEqual([3n, 3n, 1n]);
    expect(D.inclusionExclusion([]).union).toBe(0n);
  });
  test("the sieve formula", () => {
    const d = D.sieve(5, (k) => D.factorial(5 - k));
    expect(d.none).toBe(44n);
    expect(d.all).toBe(120n);
    expect(d.union).toBe(76n);
    expect(d.terms.length).toBe(6);
    // surjections from 6 onto 3: no box empty
    expect(D.sieve(3, (k) => BigInt(3 - k) ** 6n).none).toBe(D.surjections(6, 3));
    for (let n = 0; n <= 12; n++) expect(D.sieve(n, (k) => D.factorial(n - k)).none).toBe(D.derangementCount(n));
  });
  test("pigeonhole", () => {
    expect(D.pigeonhole(13, 12).atLeast).toBe(2n);
    expect(D.pigeonhole(13, 12).forced).toBe(true);
    expect(D.pigeonhole(12, 12).forced).toBe(false);
    expect(D.pigeonhole(100, 7).atLeast).toBe(15n);
    expect(D.pigeonhole(100, 7).atMost).toBe(14n);
    expect(() => D.pigeonhole(3, 0)).toThrow(RangeError);
    const c = D.collision([3, 14, 25, 7, 18], (x) => x % 11);
    expect(c.items).toEqual([3, 14]);
    expect(c.indices).toEqual([0, 1]);
    expect(D.collision([1, 2, 3])).toBe(null);
    expect(D.collision([[1, 2], [3, 4], [1, 2]]).indices).toEqual([0, 2]);
  });
});

describe("enumeration", () => {
  const families = {
    "permutations(4)": [D.permutations(4), 24n],
    "permutations(5, 2)": [D.permutations(5, 2), 20n],
    "permutations of items": [D.permutations(["a", "b", "c"]), 6n],
    "derangements(5)": [D.derangements(5), 44n],
    "derangements(0)": [D.derangements(0), 1n],
    "derangements(1)": [D.derangements(1), 0n],
    "combinations(6, 3)": [D.combinations(6, 3), 20n],
    "combinations(5, 0)": [D.combinations(5, 0), 1n],
    "combinations(3, 5)": [D.combinations(3, 5), 0n],
    "multisets(3, 3)": [D.multisets(3, 3), 10n],
    "multisets(0, 2)": [D.multisets(0, 2), 0n],
    "subsets(4)": [D.subsets(4), 16n],
    "subsets gray": [D.subsets(4, { order: "gray" }), 16n],
    "subsets by size": [D.subsets(["x", "y", "z", "w"], { order: "size" }), 16n],
    "words": [D.words(["a", "b", "c"], 3), 27n],
    "product": [D.product([1, 2], ["a", "b", "c"], D.combinations(3, 2)), 18n],
    "compositions(6)": [D.compositions(6), 32n],
    "compositions(0)": [D.compositions(0), 1n],
    "compositions(7, 3)": [D.compositions(7, 3), 15n],
    "compositions with zeros": [D.compositions(4, 3, { zero: true }), 15n],
    "partitions(9)": [D.partitions(9), 30n],
    "partitions(0)": [D.partitions(0), 1n],
    "partitions(10, 4)": [D.partitions(10, 4), 9n],
    "setPartitions(5)": [D.setPartitions(5), 52n],
    "setPartitions(6, 3)": [D.setPartitions(6, 3), 90n],
    "setPartitions(0)": [D.setPartitions(0), 1n],
    "dyckWords(5)": [D.dyckWords(5), 42n],
    "dyckWords(0)": [D.dyckWords(0), 1n],
  };
  test.each(Object.entries(families))("%s: count, unrank and rank agree, and nothing repeats", (_name, [f, count]) => {
    expect(f.count).toBe(count);
    const all = [];
    for (let i = 0n; i < f.count; i++) all.push(f.unrank(i));
    expect(new Set(all.map(S)).size).toBe(all.length);
    all.forEach((x, i) => expect(f.rank(x)).toBe(BigInt(i)));
    expect([...f].map(S)).toEqual(all.map(S));
    expect(f.toArray().map(S)).toEqual(all.map(S));
  });
  test("the orders are the ones documented", () => {
    expect(S(D.permutations(3).toArray())).toBe("[[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]]");
    expect(S(D.combinations(4, 2).toArray())).toBe("[[1,2],[1,3],[1,4],[2,3],[2,4],[3,4]]");
    expect(S(D.multisets(3, 2).toArray())).toBe("[[1,1],[1,2],[1,3],[2,2],[2,3],[3,3]]");
    expect(S(D.subsets(2).toArray())).toBe("[[],[1],[2],[1,2]]");
    expect(S(D.compositions(3).toArray())).toBe("[[1,1,1],[1,2],[2,1],[3]]");
    expect(S(D.partitions(4).toArray())).toBe("[[4],[3,1],[2,2],[2,1,1],[1,1,1,1]]");
    expect(S(D.setPartitions(3).toArray())).toBe("[[[1,2,3]],[[1,2],[3]],[[1,3],[2]],[[1],[2,3]],[[1],[2],[3]]]");
    expect(D.dyckWords(3).toArray()).toEqual(["((()))", "(()())", "(())()", "()(())", "()()()"]);
    expect(D.dyckWords(2, { open: "[", close: "]" }).toArray()).toEqual(["[[]]", "[][]"]);
    expect(S(D.derangements(3).toArray())).toBe("[[2,3,1],[3,1,2]]");
  });
  test("a Gray code changes one element at a time", () => {
    const g = D.subsets(6, { order: "gray" }).toArray();
    for (let i = 1; i < g.length; i++) {
      const a = new Set(g[i - 1]);
      const b = new Set(g[i]);
      const diff = [...a].filter((x) => !b.has(x)).length + [...b].filter((x) => !a.has(x)).length;
      expect(diff).toBe(1);
    }
  });
  test("far places without listing", () => {
    const p = D.permutations(20);
    expect(p.count).toBe(2432902008176640000n);
    expect(p.unrank(999999).join(",")).toBe("1,2,3,4,5,6,7,8,9,10,13,18,19,14,20,12,16,15,17,11");
    expect(p.rank(p.unrank(10n ** 18n))).toBe(10n ** 18n);
    expect(p.unrank(-1).join(",")).toBe(Array.from({ length: 20 }, (_, i) => 20 - i).join(","));
    const c = D.combinations(60, 30);
    expect(c.rank(c.unrank(c.count - 1n))).toBe(c.count - 1n);
    const parts = D.partitions(100);
    expect(parts.count).toBe(D.partitionCount(100));
    const x = parts.unrank(123456789);
    expect(x.reduce((a, b) => a + b, 0)).toBe(100);
    expect(parts.rank(x)).toBe(123456789n);
    const sp = D.setPartitions(30);
    expect(sp.count).toBe(D.bell(30));
    expect(sp.rank(sp.unrank(10n ** 20n))).toBe(10n ** 20n);
    const dw = D.dyckWords(40);
    expect(dw.count).toBe(D.catalan(40));
    expect(dw.rank(dw.unrank(10n ** 20n))).toBe(10n ** 20n);
    const d = D.derangements(25);
    expect(d.count).toBe(D.derangementCount(25));
    const y = d.unrank(d.count / 3n);
    expect(y.every((v, i) => v !== i + 1)).toBe(true);
    expect(d.rank(y)).toBe(d.count / 3n);
  });
  test("membership and refusals", () => {
    const p = D.permutations(5);
    expect(p.has([5, 4, 3, 2, 1])).toBe(true);
    expect(p.has([1, 2, 3, 4, 4])).toBe(false);
    expect(p.has([1, 2, 3])).toBe(false);
    expect(D.combinations(5, 2).has([2, 1])).toBe(false);
    expect(D.partitions(5).has([2, 3])).toBe(false);
    expect(D.partitions(5).has([3, 2])).toBe(true);
    expect(D.derangements(3).has([1, 3, 2])).toBe(false);
    expect(D.dyckWords(2).has("())(")).toBe(false);
    expect(D.setPartitions(3).has([[1], [2]])).toBe(false);
    expect(D.setPartitions(3).rank([[3], [2, 1]])).toBe(D.setPartitions(3).rank([[1, 2], [3]]));
    expect(() => p.unrank(120)).toThrow(RangeError);
    expect(() => p.rank([1, 2, 3, 4, 6])).toThrow(D.DiscreteError);
    expect(() => D.permutations(["a", "a"])).toThrow(RangeError);
    expect(() => D.permutations(25).toArray()).toThrow(/smaller slice/);
    expect(() => D.subsets(3, { order: "odd" })).toThrow(RangeError);
    expect(S(D.combinations(5, 2).first(3))).toBe("[[1,2],[1,3],[1,4]]");
    expect(S(D.combinations(5, 2).slice(8, 99))).toBe("[[3,5],[4,5]]");
    expect(String(D.permutations(5))).toBe("permutations of 5: 120 objects");
    expect(D.words(["a", "b"], 3).rank("bab")).toBe(5n);
  });
});

describe("the seeded generator", () => {
  test("the same seed gives the same stream, everywhere", () => {
    // these values are part of the contract: a change here breaks every saved simulation
    const r = D.rng(2026);
    expect([r.u32(), r.u32()]).toEqual([3023761063, 2983606895]);
    expect(D.rng("abc").u32()).toBe(1119727010);
    expect(D.rng("abd").u32()).toBe(1706170242);
    expect(D.rng(2026n).u32()).toBe(3023761063);
    expect(D.rng(-1).u32()).not.toBe(D.rng(1).u32());
    expect(D.rng().u32()).toBe(D.rng(0).u32());
  });
  test("whole numbers of any size are in range and close to uniform", () => {
    const g = D.rng(1);
    const counts = Array(6).fill(0);
    for (let i = 0; i < 60000; i++) counts[g.int(6)]++;
    for (const c of counts) expect(Math.abs(c - 10000)).toBeLessThan(400);
    const big = Array(7).fill(0);
    for (let i = 0; i < 70000; i++) big[Number(g.int(7n))]++;
    for (const c of big) expect(Math.abs(c - 10000)).toBeLessThan(400);
    const huge = g.int(10n ** 40n);
    expect(typeof huge).toBe("bigint");
    expect(huge >= 0n && huge < 10n ** 40n).toBe(true);
    expect(typeof g.int(10)).toBe("number");
    expect(g.int(1)).toBe(0);
    expect(g.int(1n)).toBe(0n);
    expect(typeof g.int(2 ** 40)).toBe("number");
    expect(() => g.int(0)).toThrow(RangeError);
    for (let i = 0; i < 200; i++) {
      const v = g.between(-3, 3);
      expect(v >= -3 && v <= 3).toBe(true);
    }
    expect(typeof g.between(1n, 6n)).toBe("bigint");
    expect(g.bits(0)).toBe(0n);
    expect(g.bits(70) < 1n << 70n).toBe(true);
  });
  test("exact probabilities", () => {
    const g = D.rng("coins");
    let heads = 0;
    for (let i = 0; i < 30000; i++) if (g.bool("1/3")) heads++;
    expect(Math.abs(heads - 10000)).toBeLessThan(400);
    expect(g.bool(0)).toBe(false);
    expect(g.bool(1)).toBe(true);
    expect(() => g.bool("3/2")).toThrow(RangeError);
    const q = g.rational(100);
    expect(q).toBeInstanceOf(Rational);
    expect(q.denominator <= 100n && q.numerator >= 0n).toBe(true);
    const f = g.float();
    expect(f >= 0 && f < 1).toBe(true);
    const tally = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 20000; i++) tally[g.weighted(["x", "y", "z"], ["1/10", "9/10", 0])]++;
    expect(tally.z).toBe(0);
    expect(Math.abs(tally.x - 2000)).toBeLessThan(250);
    expect(() => g.weightedIndex([0, 0])).toThrow(RangeError);
    expect(() => g.weighted(["a"], [1, 2])).toThrow(RangeError);
  });
  test("shuffles, samples and picks", () => {
    const g = D.rng(7);
    const s = g.shuffle([1, 2, 3, 4, 5, 6]);
    expect([...s].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    const k = g.sample([1, 2, 3, 4, 5, 6], 3);
    expect(k.length).toBe(3);
    expect(new Set(k).size).toBe(3);
    expect(() => g.sample([1, 2], 3)).toThrow(RangeError);
    expect(["a", "b"]).toContain(g.pick(["a", "b"]));
    expect(() => g.pick([])).toThrow(RangeError);
    // every one of the 24 orders of 4 things turns up about equally often
    const seen = new Map();
    for (let i = 0; i < 24000; i++) {
      const key = g.shuffle([1, 2, 3, 4]).join("");
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    expect(seen.size).toBe(24);
    for (const c of seen.values()) expect(Math.abs(c - 1000)).toBeLessThan(150);
  });
  test("forks, clones and saved state", () => {
    const g = D.rng(2026);
    const a = g.fork("a");
    const b = g.fork("b");
    expect(a.u32()).not.toBe(b.u32());
    expect(g.fork("a").u32()).toBe(D.rng(2026).fork("a").u32());
    // forking does not advance the parent
    expect(g.u32()).toBe(D.rng(2026).u32());
    const c = g.clone();
    expect(c.u32()).toBe(g.u32());
    const resumed = new D.Random(g.state);
    expect(resumed.u32()).toBe(g.u32());
    expect(() => new D.Random([0, 0, 0, 0])).toThrow(RangeError);
  });
  test("random objects from a family", () => {
    const g = D.rng("objects");
    const p = D.permutations(8).random(g);
    expect([...p].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(D.partitions(50).random(g).reduce((x, y) => x + y, 0)).toBe(50);
    expect(D.permutations(8).random(5)).toEqual(D.permutations(8).random(5));
    expect(() => D.combinations(3, 5).random(g)).toThrow(RangeError);
    // uniform over the 5 partitions of a 3-set
    const sp = D.setPartitions(3);
    const tally = Array(5).fill(0);
    for (let i = 0; i < 10000; i++) tally[Number(sp.rank(sp.random(g)))]++;
    for (const c of tally) expect(Math.abs(c - 2000)).toBeLessThan(250);
  });
});
