// Sets, relations and partial orders, and counting up to symmetry.
//
// A relation on a finite set is kept as the set of pairs. Its properties are
// answered with a witness when they fail (the pair that breaks symmetry, the
// three elements that break transitivity), closures are computed, and an
// equivalence relation gives its classes. A partial order gives its Hasse
// diagram, extremes, chains and antichains, linear extensions, its width with
// Dilworth's chain cover (via a bipartite matching, so the cover's size is
// proved by an antichain of the same size), its Möbius function, and whether
// it is a lattice.
//
// Pólya counting: the cycle index of a permutation group (algebraic's
// PermGroup) gives the number of colourings up to symmetry, and with weights
// the pattern inventory: how many orbits use each number of each colour.

import { Rational } from "@ratmath/core";
import { PermGroup, cycleType } from "@ratmath/algebraic";
import { refuse } from "./counting.js";
import { graph } from "./graph.js";
import { bipartiteMatching } from "./matching.js";

const k2 = (a, b) => `${a}\u0000${b}`;

/**
 * A relation on a finite set:
 *   relation([1, 2, 3], [[1, 2], [2, 3]])
 *   relation([1, …, 12], (a, b) => b % a === 0)
 */
export class Relation {
  constructor(elements, pairs) {
    this.elements = [...elements];
    const idx = new Map(this.elements.map((e, i) => [String(e), i]));
    if (idx.size !== this.elements.length) refuse("bad-argument", "an element is listed twice");
    this.index = idx;
    this.pairs = new Set();
    const list = typeof pairs === "function" ? this.elements.flatMap((a) => this.elements.filter((b) => pairs(a, b)).map((b) => [a, b])) : pairs;
    for (const [a, b] of list) {
      if (!idx.has(String(a)) || !idx.has(String(b))) refuse("bad-argument", `(${a}, ${b}) uses something outside the set`);
      this.pairs.add(k2(a, b));
    }
  }
  has(a, b) {
    return this.pairs.has(k2(a, b));
  }
  /** The pairs as [a, b], in the order of the elements. */
  list() {
    const E = this.elements;
    return E.flatMap((a) => E.filter((b) => this.has(a, b)).map((b) => [a, b]));
  }
  get size() {
    return this.pairs.size;
  }
  /** Each property is { holds: true } or { holds: false, witness }. */
  properties() {
    const E = this.elements;
    const no = (witness) => ({ holds: false, witness });
    const yes = { holds: true };
    const find = (f) => {
      for (const a of E) for (const b of E) {
        const w = f(a, b);
        if (w) return w;
      }
      return null;
    };
    const refl = E.find((a) => !this.has(a, a));
    const irr = E.find((a) => this.has(a, a));
    const sym = find((a, b) => this.has(a, b) && !this.has(b, a) && [a, b]);
    const anti = find((a, b) => String(a) !== String(b) && this.has(a, b) && this.has(b, a) && [a, b]);
    const asym = find((a, b) => this.has(a, b) && this.has(b, a) && [a, b]);
    let trans = null;
    outer: for (const a of E) for (const b of E) if (this.has(a, b)) for (const c of E) if (this.has(b, c) && !this.has(a, c)) {
      trans = [a, b, c];
      break outer;
    }
    const total = find((a, b) => !this.has(a, b) && !this.has(b, a) && String(a) !== String(b) && [a, b]);
    return {
      reflexive: refl === undefined ? yes : no(refl),
      irreflexive: irr === undefined ? yes : no(irr),
      symmetric: sym ? no(sym) : yes,
      antisymmetric: anti ? no(anti) : yes,
      asymmetric: asym ? no(asym) : yes,
      transitive: trans ? no(trans) : yes,
      total: total ? no(total) : yes,
    };
  }
  get isEquivalence() {
    const p = this.properties();
    return p.reflexive.holds && p.symmetric.holds && p.transitive.holds;
  }
  get isPartialOrder() {
    const p = this.properties();
    return p.reflexive.holds && p.antisymmetric.holds && p.transitive.holds;
  }
  inverse() {
    return new Relation(this.elements, this.list().map(([a, b]) => [b, a]));
  }
  /** R ∘ S: a (R∘S) c when a S b and b R c for some b (first S, then R). */
  compose(S) {
    const E = this.elements;
    return new Relation(E, (a, c) => E.some((b) => S.has(a, b) && this.has(b, c)));
  }
  union(S) {
    return new Relation(this.elements, [...this.list(), ...S.list()]);
  }
  reflexiveClosure() {
    return new Relation(this.elements, [...this.list(), ...this.elements.map((a) => [a, a])]);
  }
  symmetricClosure() {
    return this.union(this.inverse());
  }
  /** The transitive closure (Warshall). */
  transitiveClosure() {
    const E = this.elements;
    const n = E.length;
    const M = E.map((a) => E.map((b) => this.has(a, b)));
    for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) if (M[i][k]) for (let j = 0; j < n; j++) if (M[k][j]) M[i][j] = true;
    return new Relation(E, (a, b) => M[this.index.get(String(a))][this.index.get(String(b))]);
  }
  /** The smallest equivalence relation containing this one. */
  equivalenceClosure() {
    return this.reflexiveClosure().symmetricClosure().transitiveClosure();
  }
  /** The classes of an equivalence relation. */
  classes() {
    if (!this.isEquivalence) refuse("not-equivalence", "classes are for equivalence relations");
    const out = [];
    const seen = new Set();
    for (const a of this.elements) {
      if (seen.has(String(a))) continue;
      const cls = this.elements.filter((b) => this.has(a, b));
      cls.forEach((b) => seen.add(String(b)));
      out.push(cls);
    }
    return out;
  }
  toString() {
    return `{${this.list().map(([a, b]) => `(${a}, ${b})`).join(", ")}}`;
  }
}
export const relation = (elements, pairs) => new Relation(elements, pairs);
/** The equivalence relation whose classes are the given blocks. */
export function fromPartition(blocks) {
  const E = blocks.flat();
  const where = new Map(blocks.flatMap((b, i) => b.map((x) => [String(x), i])));
  return new Relation(E, (a, b) => where.get(String(a)) === where.get(String(b)));
}

/**
 * A partial order: poset(elements, leq) with leq(a, b) meaning a ≤ b, or a
 * list of pairs (made reflexive and transitive). Checked to be a partial
 * order; the reason is given when it is not.
 */
export class Poset {
  constructor(elements, leq) {
    let R = new Relation(elements, leq);
    if (typeof leq !== "function") R = R.reflexiveClosure().transitiveClosure();
    const p = R.properties();
    if (!p.reflexive.holds) refuse("not-order", `${p.reflexive.witness} ≤ ${p.reflexive.witness} fails`);
    if (!p.antisymmetric.holds) refuse("not-order", `${p.antisymmetric.witness[0]} ≤ ${p.antisymmetric.witness[1]} and back, but they differ`);
    if (!p.transitive.holds) refuse("not-order", `${p.transitive.witness.join(" ≤ ")} but not ${p.transitive.witness[0]} ≤ ${p.transitive.witness[2]}`);
    this.relation = R;
    this.elements = R.elements;
  }
  leq(a, b) {
    return this.relation.has(a, b);
  }
  lt(a, b) {
    return String(a) !== String(b) && this.leq(a, b);
  }
  comparable(a, b) {
    return this.leq(a, b) || this.leq(b, a);
  }
  /** The covering pairs [a, b]: a < b with nothing strictly between (the edges of the Hasse diagram). */
  hasse() {
    const E = this.elements;
    return E.flatMap((a) => E.filter((b) => this.lt(a, b) && !E.some((c) => this.lt(a, c) && this.lt(c, b))).map((b) => [a, b]));
  }
  minimal() {
    return this.elements.filter((a) => !this.elements.some((b) => this.lt(b, a)));
  }
  maximal() {
    return this.elements.filter((a) => !this.elements.some((b) => this.lt(a, b)));
  }
  least() {
    return this.elements.find((a) => this.elements.every((b) => this.leq(a, b))) ?? null;
  }
  greatest() {
    return this.elements.find((a) => this.elements.every((b) => this.leq(b, a))) ?? null;
  }
  /** The levels by rank from the minimal elements (longest chain below), as arrays. */
  levels() {
    const E = this.elements;
    const h = new Map();
    const height = (a) => {
      if (h.has(String(a))) return h.get(String(a));
      const below = E.filter((b) => this.lt(b, a));
      const v = below.length ? 1 + Math.max(...below.map(height)) : 0;
      h.set(String(a), v);
      return v;
    };
    const out = [];
    for (const a of E) (out[height(a)] ??= []).push(a);
    return out;
  }
  /** A longest chain. */
  longestChain() {
    const lv = this.levels();
    let top = lv[lv.length - 1][0];
    const chain = [top];
    for (let k = lv.length - 2; k >= 0; k--) {
      top = lv[k].find((b) => this.lt(b, top));
      chain.unshift(top);
    }
    return chain;
  }
  /**
   * The width (the largest antichain) with Dilworth's proof: a cover by that
   * many chains, from a maximum matching in the bipartite graph a → b for
   * a < b, and an antichain of the same size, from König's vertex cover.
   * { width, antichain, chains }
   */
  width() {
    const E = this.elements;
    if (!E.length) return { width: 0, antichain: [], chains: [] };
    const L = E.map((_, i) => `L${i}`);
    const pairs = [];
    E.forEach((a, i) => E.forEach((b, j) => this.lt(a, b) && pairs.push([L[i], `R${j}`])));
    const g = graph({ vertices: [...L, ...E.map((_, j) => `R${j}`)], edges: pairs });
    const m = bipartiteMatching(g, { left: L });
    const next = new Map(m.edges.map(([l, r]) => [+l.slice(1), +r.slice(1)]));
    const hasPrev = new Set(next.values());
    const chains = [];
    E.forEach((_, i) => {
      if (hasPrev.has(i)) return;
      const c = [];
      for (let k = i; k !== undefined; k = next.get(k)) c.push(E[k]);
      chains.push(c);
    });
    // antichain: elements with neither copy in the cover
    const cover = new Set(m.cover);
    const antichain = E.filter((_, i) => !cover.has(`L${i}`) && !cover.has(`R${i}`));
    if (antichain.length !== chains.length) throw new Error("internal: Dilworth's antichain and chain cover differ in size");
    for (const a of antichain) for (const b of antichain) if (String(a) !== String(b) && this.comparable(a, b)) throw new Error("internal: the antichain has comparable elements");
    return { width: chains.length, antichain, chains };
  }
  /** Every linear extension, as arrays (up to `limit`). */
  linearExtensions({ limit = 100000 } = {}) {
    const E = this.elements;
    const out = [];
    const go = (placed, rest) => {
      if (out.length >= limit) return;
      if (!rest.length) {
        out.push(placed);
        return;
      }
      for (const a of rest) if (!rest.some((b) => this.lt(b, a))) go([...placed, a], rest.filter((x) => x !== a));
    };
    go([], E);
    return out;
  }
  /** The number of linear extensions, by dynamic programming over down-sets (up to about 25 elements). */
  countLinearExtensions() {
    const E = this.elements;
    const n = E.length;
    if (n > 30) refuse("too-large", "counting linear extensions here is for at most 30 elements");
    const below = E.map((a) => E.reduce((m, b, j) => (this.lt(b, a) ? m | (1 << j) : m), 0));
    const memo = new Map([[0, 1n]]);
    const f = (mask) => {
      if (memo.has(mask)) return memo.get(mask);
      // the last element placed is a maximal element of the down-set
      let s = 0n;
      for (let i = 0; i < n; i++) if (mask & (1 << i)) {
        const rest = mask & ~(1 << i);
        if (E.every((_, j) => !(rest & (1 << j)) || !(below[j] & (1 << i)))) s += f(rest);
      }
      memo.set(mask, s);
      return s;
    };
    return n === 0 ? 1n : f(2 ** n - 1);
  }
  /** The Möbius function μ(a, b): μ(a, a) = 1, μ(a, b) = −Σ_{a ≤ c < b} μ(a, c). */
  mobius(a, b) {
    if (!this.leq(a, b)) return 0n;
    const memo = new Map();
    const mu = (c) => {
      if (memo.has(String(c))) return memo.get(String(c));
      let v;
      if (String(c) === String(a)) v = 1n;
      else v = -this.elements.filter((x) => this.leq(a, x) && this.lt(x, c)).reduce((s, x) => s + mu(x), 0n);
      memo.set(String(c), v);
      return v;
    };
    return mu(b);
  }
  /** The meet (greatest lower bound) of a and b, or null when there is none. */
  meet(a, b) {
    const lower = this.elements.filter((x) => this.leq(x, a) && this.leq(x, b));
    return lower.find((x) => lower.every((y) => this.leq(y, x))) ?? null;
  }
  join(a, b) {
    const upper = this.elements.filter((x) => this.leq(a, x) && this.leq(b, x));
    return upper.find((x) => upper.every((y) => this.leq(x, y))) ?? null;
  }
  /** Is every pair given a meet and a join? { lattice: true } or { lattice: false, pair, missing } */
  isLattice() {
    for (const a of this.elements) for (const b of this.elements) {
      if (this.meet(a, b) === null) return { lattice: false, pair: [a, b], missing: "meet" };
      if (this.join(a, b) === null) return { lattice: false, pair: [a, b], missing: "join" };
    }
    return { lattice: true };
  }
  /** Distributive: a ∧ (b ∨ c) = (a ∧ b) ∨ (a ∧ c) for all a, b, c (checked directly). */
  isDistributive() {
    if (!this.isLattice().lattice) return { distributive: false, reason: "not a lattice" };
    const E = this.elements;
    for (const a of E) for (const b of E) for (const c of E) {
      const l = this.meet(a, this.join(b, c));
      const r = this.join(this.meet(a, b), this.meet(a, c));
      if (String(l) !== String(r)) return { distributive: false, witness: [a, b, c] };
    }
    return { distributive: true };
  }
}
export const poset = (elements, leq) => new Poset(elements, leq);
/** The divisors of n ordered by divisibility. */
export function divisorLattice(n) {
  const N = Number(n);
  const ds = [];
  for (let d = 1; d <= N; d++) if (N % d === 0) ds.push(d);
  return new Poset(ds, (a, b) => b % a === 0);
}
/** The subsets of {1, …, n} ordered by inclusion, each written as a string such as "13" or "∅". */
export function booleanLattice(n) {
  const sets = [];
  for (let m = 0; m < 1 << n; m++) sets.push(m);
  const name = (m) => [...Array(n).keys()].filter((i) => (m >> i) & 1).map((i) => i + 1).join("") || "∅";
  const names = sets.map(name);
  return new Poset(names, (a, b) => {
    const ma = sets[names.indexOf(a)];
    const mb = sets[names.indexOf(b)];
    return (ma & mb) === ma;
  });
}
/** The set partitions of {1, …, n} ordered by refinement (finer below). */
export function partitionLattice(n) {
  const parts = [];
  const gen = (i, blocks) => {
    if (i > n) {
      parts.push(blocks.map((b) => b.slice()));
      return;
    }
    for (const b of blocks) {
      b.push(i);
      gen(i + 1, blocks);
      b.pop();
    }
    blocks.push([i]);
    gen(i + 1, blocks);
    blocks.pop();
  };
  gen(1, []);
  const name = (p) => p.map((b) => b.join("")).join("|");
  const names = parts.map(name);
  const refines = (p, q) => p.every((b) => q.some((c) => b.every((x) => c.includes(x))));
  return new Poset(names, (a, b) => refines(parts[names.indexOf(a)], parts[names.indexOf(b)]));
}

// ---- Pólya counting ----------------------------------------------------------------------------------

/**
 * The cycle index of a permutation group: the average over its elements of
 * the monomial Π s_k^(number of k-cycles). Returned as terms
 * [{ coefficient: Rational, exponents: [e₁, e₂, …] }] and printed.
 */
export function cycleIndex(group) {
  const G = group instanceof PermGroup ? group : new PermGroup(group.generators ?? group, group.degree);
  const counts = new Map();
  for (const g of G.elements) {
    const ct = cycleType(g);
    const e = new Array(G.degree).fill(0);
    for (const len of ct) e[len - 1]++;
    while (e.length && e[e.length - 1] === 0) e.pop();
    const k = e.join(",");
    counts.set(k, (counts.get(k) ?? 0n) + 1n);
  }
  const ord = BigInt(G.order);
  const terms = [...counts].map(([k, c]) => ({ coefficient: new Rational(c, ord), exponents: k.split(",").map(Number) }));
  terms.sort((a, b) => b.exponents.length - a.exponents.length || b.exponents.join().localeCompare(a.exponents.join()));
  return Object.freeze({
    terms,
    order: ord,
    degree: G.degree,
    toString: () =>
      terms
        .map(({ coefficient, exponents }) => {
          const mono = exponents.map((e, i) => (e === 0 ? "" : e === 1 ? `s${i + 1}` : `s${i + 1}^${e}`)).filter(Boolean).join(" ");
          return `${coefficient.equals(new Rational(1n)) ? "" : `(${coefficient}) `}${mono}`;
        })
        .join(" + "),
  });
}

/**
 * The number of colourings of the points with k colours, counting two the
 * same when a group element carries one to the other: the cycle index with
 * every s_i = k (Burnside's lemma). A BigInt.
 */
export function countColourings(group, k) {
  const Z = cycleIndex(group);
  const K = BigInt(k);
  const total = Z.terms.reduce((s, { coefficient, exponents }) => s.add(coefficient.multiply(new Rational(K ** BigInt(exponents.reduce((a, b) => a + b, 0))))), new Rational(0n));
  if (total.denominator !== 1n) throw new Error("internal: Burnside's count is not whole");
  return total.numerator;
}

/**
 * The pattern inventory: for colours c₁ … c_m, how many orbits of colourings
 * use each colour a given number of times. Substitutes s_i = c₁^i + … + c_m^i
 * in the cycle index. Returns [{ counts: [n₁, …, n_m], orbits: BigInt }] for
 * every split of the points among the colours that occurs, and a printout.
 */
export function patternInventory(group, colours = ["r", "b"]) {
  const Z = cycleIndex(group);
  const m = colours.length;
  // polynomials in m variables: Map "e1,e2,…" → Rational
  const mul = (A, B) => {
    const out = new Map();
    for (const [ka, va] of A) for (const [kb, vb] of B) {
      const ea = ka.split(",").map(Number);
      const eb = kb.split(",").map(Number);
      const k = ea.map((x, i) => x + eb[i]).join(",");
      out.set(k, (out.get(k) ?? new Rational(0n)).add(va.multiply(vb)));
    }
    return out;
  };
  const powerSum = (i) => new Map(colours.map((_, c) => [Array.from({ length: m }, (_, j) => (j === c ? i : 0)).join(","), new Rational(1n)]));
  let total = new Map();
  for (const { coefficient, exponents } of Z.terms) {
    let term = new Map([[new Array(m).fill(0).join(","), coefficient]]);
    exponents.forEach((e, i) => {
      for (let t = 0; t < e; t++) term = mul(term, powerSum(i + 1));
    });
    for (const [k, v] of term) total.set(k, (total.get(k) ?? new Rational(0n)).add(v));
  }
  const rows = [...total]
    .filter(([, v]) => v.numerator !== 0n)
    .map(([k, v]) => {
      if (v.denominator !== 1n) throw new Error("internal: an inventory count is not whole");
      return { counts: k.split(",").map(Number), orbits: v.numerator };
    })
    .sort((a, b) => b.counts.join().localeCompare(a.counts.join(), undefined, { numeric: true }));
  return Object.freeze({
    rows,
    toString: () => rows.map(({ counts, orbits }) => `${orbits === 1n ? "" : orbits}${counts.map((e, i) => (e === 0 ? "" : e === 1 ? colours[i] : `${colours[i]}^${e}`)).join("")}`).join(" + "),
  });
}

/** Symmetry groups that come up in counting: rotations of an n-gon (cyclic), rotations and reflections (dihedral). */
export const symmetry = Object.freeze({
  cyclic: (n) => new PermGroup([Array.from({ length: n }, (_, i) => (i + 1) % n)], n),
  dihedral: (n) => (n <= 2 ? new PermGroup([Array.from({ length: n }, (_, i) => (n - i) % n)].concat(n === 2 ? [[1, 0]] : []), n) : new PermGroup([Array.from({ length: n }, (_, i) => (i + 1) % n), Array.from({ length: n }, (_, i) => (n - i) % n)], n)),
  symmetric: (n) => PermGroup.symmetric(n),
  /** The rotations of a cube acting on its 6 faces (order 24). */
  cubeFaces: () => new PermGroup([[0, 2, 3, 4, 1, 5], [1, 5, 2, 0, 4, 3]], 6),
});
