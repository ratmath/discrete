// Isomorphism and automorphisms of small graphs, by backtracking with colour
// refinement: vertices are first split by degree, then by the multiset of
// their neighbours' classes, until the split stops changing; a vertex can only
// go to a vertex of the same class. A "no" comes with the invariant that
// differs when one does (degree sequences, refined class sizes), and
// otherwise with the record that the search was complete.
//
// The automorphism group is found as a chain of stabilisers: for each vertex
// in turn, one automorphism to every vertex of its orbit (fixing the earlier
// ones), so the generators are few and the order is the product of the orbit
// sizes. It is returned with algebraic's `PermGroup` when the order allows.

import { PermGroup } from "@ratmath/algebraic";
import { refuse } from "./counting.js";
import { indexOf } from "./traverse.js";

function simple(g) {
  const X = indexOf(g);
  const n = X.vs.length;
  const adj = X.vs.map(() => new Set());
  const directed = g.directed;
  const outA = X.vs.map(() => new Set());
  for (const e of X.edges) {
    const i = X.at.get(e.from);
    const j = X.at.get(e.to);
    if (directed) outA[i].add(j);
    adj[i].add(j);
    adj[j].add(i);
  }
  return { vs: X.vs, n, adj, outA, directed };
}

/** Refine an initial colouring (array of class numbers) until stable; classes are renumbered canonically. */
function refine(G, colour) {
  let col = colour.slice();
  for (;;) {
    const sigs = col.map((c, v) => {
      const nb = [...G.adj[v]].map((t) => col[t]).sort((a, b) => a - b).join(",");
      const out = G.directed ? "|" + [...G.outA[v]].map((t) => col[t]).sort((a, b) => a - b).join(",") : "";
      return `${c}:${nb}${out}`;
    });
    const uniq = [...new Set(sigs)].sort();
    const next = sigs.map((s) => uniq.indexOf(s));
    if (new Set(next).size === new Set(col).size) return { colour: next, signatures: uniq };
    col = next;
  }
}

const edgeOK = (G, H, i, j, a, b) => {
  if (G.adj[i].has(j) !== H.adj[a].has(b)) return false;
  if (G.directed && (G.outA[i].has(j) !== H.outA[a].has(b) || G.outA[j].has(i) !== H.outA[b].has(a))) return false;
  return true;
};

/** Backtracking for a map G → H respecting colours and the partial map; returns an array or null. */
function search(G, H, cg, ch, fixed = [], budget = { left: 5_000_000 }) {
  const n = G.n;
  const map = new Array(n).fill(-1);
  const used = new Array(n).fill(false);
  for (const [i, a] of fixed) {
    if (cg[i] !== ch[a]) return null;
    map[i] = a;
    used[a] = true;
  }
  for (const [i] of fixed) for (const [j] of fixed) if (!edgeOK(G, H, i, j, map[i], map[j])) return null;
  // order: vertices adjacent to already-mapped ones first, smaller classes first
  const order = [];
  const placed = new Set(fixed.map(([i]) => i));
  const classSize = new Map();
  cg.forEach((c) => classSize.set(c, (classSize.get(c) ?? 0) + 1));
  while (placed.size < n) {
    let best = -1;
    let bestScore = -Infinity;
    for (let v = 0; v < n; v++) {
      if (placed.has(v)) continue;
      const touch = [...G.adj[v]].filter((t) => placed.has(t)).length;
      const score = touch * 1000 - classSize.get(cg[v]);
      if (score > bestScore) {
        bestScore = score;
        best = v;
      }
    }
    order.push(best);
    placed.add(best);
  }
  const byClass = new Map();
  ch.forEach((c, a) => byClass.set(c, [...(byClass.get(c) ?? []), a]));
  const go = (k) => {
    if (--budget.left < 0) refuse("budget", "the isomorphism search passed its budget");
    if (k === order.length) return true;
    const v = order[k];
    for (const a of byClass.get(cg[v]) ?? []) {
      if (used[a]) continue;
      let ok = true;
      for (const t of G.adj[v]) if (map[t] !== -1 && !edgeOK(G, H, v, t, a, map[t])) {
        ok = false;
        break;
      }
      if (ok) for (let t = 0; t < n && ok; t++) if (map[t] !== -1 && !G.adj[v].has(t) && H.adj[a].has(map[t])) ok = false;
      if (!ok) continue;
      map[v] = a;
      used[a] = true;
      if (go(k + 1)) return true;
      map[v] = -1;
      used[a] = false;
    }
    return false;
  };
  return go(0) ? map : null;
}

/**
 * An isomorphism from g to h, or the reason there is none.
 *   { isomorphic: true, map: Map(g vertex → h vertex) }   (checked edge by edge)
 *   { isomorphic: false, reason }
 */
export function isomorphism(g, h) {
  const G = simple(g);
  const H = simple(h);
  if (G.directed !== H.directed) return Object.freeze({ isomorphic: false, reason: "one graph is directed and the other is not" });
  if (G.n !== H.n) return Object.freeze({ isomorphic: false, reason: `${G.n} vertices against ${H.n}` });
  const eg = G.adj.reduce((s, a) => s + a.size, 0);
  const eh = H.adj.reduce((s, a) => s + a.size, 0);
  if (eg !== eh) return Object.freeze({ isomorphic: false, reason: `${eg / 2} edges against ${eh / 2}` });
  const dg = G.adj.map((a) => a.size).sort((a, b) => b - a);
  const dh = H.adj.map((a) => a.size).sort((a, b) => b - a);
  if (dg.join() !== dh.join()) return Object.freeze({ isomorphic: false, reason: `degree sequences differ: (${dg.join(", ")}) against (${dh.join(", ")})` });
  // refine both together so class numbers are comparable
  const U = { n: G.n + H.n, adj: [...G.adj, ...H.adj.map((s) => new Set([...s].map((x) => x + G.n)))], outA: [...G.outA, ...H.outA.map((s) => new Set([...s].map((x) => x + G.n)))], directed: G.directed };
  const { colour } = refine(U, U.adj.map((a) => a.size));
  const cg = colour.slice(0, G.n);
  const ch = colour.slice(G.n);
  const count = (c) => {
    const m = new Map();
    c.forEach((x) => m.set(x, (m.get(x) ?? 0) + 1));
    return [...m].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(" ");
  };
  if (count(cg) !== count(ch)) return Object.freeze({ isomorphic: false, reason: "colour refinement (degrees, then neighbours' degrees, and so on) splits the vertices differently" });
  const map = search(G, H, cg, ch);
  if (!map) return Object.freeze({ isomorphic: false, reason: "a complete search found no bijection that keeps the edges" });
  const m = new Map(G.vs.map((v, i) => [v, H.vs[map[i]]]));
  for (const e of g.edges()) if (!h.hasEdge(m.get(e.from), m.get(e.to))) throw new Error("internal: the isomorphism found does not keep the edges");
  return Object.freeze({ isomorphic: true, map: m });
}
export const isIsomorphic = (g, h) => isomorphism(g, h).isomorphic;

/**
 * The automorphism group of g, as permutations of its vertices in the order
 * g.vertices() lists them (0-based).
 *   { order: BigInt, generators: [[…], …], orbits: [[vertices], …], group: PermGroup | null, vertices }
 * `group` is built when the order is at most 50,000; above that the
 * generators and order are still exact.
 */
export function automorphisms(g) {
  const G = simple(g);
  const n = G.n;
  const base = refine(G, G.adj.map((a) => a.size)).colour;
  const gens = [];
  let order = 1n;
  // stabiliser chain: level i fixes vertices 0..i−1 (in a good order)
  const seq = [...Array(n).keys()].sort((a, b) => base[a] - base[b] || a - b);
  const orbitOf = (v, generators) => {
    const orb = new Set([v]);
    const q = [v];
    for (let h = 0; h < q.length; h++) for (const p of generators) if (!orb.has(p[q[h]])) {
      orb.add(p[q[h]]);
      q.push(p[q[h]]);
    }
    return orb;
  };
  const levelGens = [];
  for (let lvl = n - 1; lvl >= 0; lvl--) {
    const fixedVs = seq.slice(0, lvl);
    const v = seq[lvl];
    // generators that fix all of fixedVs
    const stab = levelGens.flat();
    let orb = orbitOf(v, stab);
    const mine = [];
    // candidates: same refined class with fixedVs individualised
    const col = base.slice();
    let next = Math.max(...col) + 1;
    for (const f of fixedVs) col[f] = next++;
    const rc = refine(G, col).colour;
    for (let w = 0; w < n; w++) {
      if (orb.has(w) || rc[w] !== rc[v]) continue;
      const map = search(G, G, rc, rc, [...fixedVs.map((f) => [f, f]), [v, w]]);
      if (map) {
        mine.push(map);
        orb = orbitOf(v, [...stab, ...mine]);
      }
    }
    levelGens.push(mine);
    gens.push(...mine);
    order *= BigInt(orb.size);
  }
  for (const p of gens) for (const e of g.edges()) {
    const a = G.vs[p[G.vs.indexOf(e.from)]];
    const b = G.vs[p[G.vs.indexOf(e.to)]];
    if (!g.hasEdge(a, b)) throw new Error("internal: an automorphism found does not keep the edges");
  }
  const orbits = [];
  const seen = new Set();
  for (let v = 0; v < n; v++) {
    if (seen.has(v)) continue;
    const o = orbitOf(v, gens);
    o.forEach((x) => seen.add(x));
    orbits.push([...o].sort((a, b) => a - b).map((i) => G.vs[i]));
  }
  let group = null;
  if (order <= 50000n && n > 0) group = new PermGroup(gens.length ? gens : [[...Array(n).keys()]], n);
  if (group && BigInt(group.order) !== order) throw new Error("internal: the group generated does not have the order the chain gives");
  return Object.freeze({ order, generators: gens, orbits, group, vertices: G.vs });
}
