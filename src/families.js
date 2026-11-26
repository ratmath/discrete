// The standard families of graphs, and random graphs from the seeded generator.
// Vertices are numbered from 1 unless a family has natural names (the
// hypercube's bit strings, the grid's "row,column", Kneser's subsets).

import { Graph, graph } from "./graph.js";
import { refuse, size } from "./counting.js";
import { combinations } from "./enumerate.js";
import { Random } from "./random.js";

const range = (n, from = 1) => Array.from({ length: n }, (_, i) => i + from);
const make = (n, edges, directed = false) => {
  const g = new Graph({ directed });
  g.addVertex(...range(n));
  for (const [u, v] of edges) g.addEdge(u, v);
  return g;
};

/** Kₙ: every pair joined. */
export function complete(n) {
  const m = size(n, "n", 2000);
  const es = [];
  for (let i = 1; i <= m; i++) for (let j = i + 1; j <= m; j++) es.push([i, j]);
  return make(m, es);
}
/** n vertices, no edges. */
export function emptyGraph(n) {
  return make(size(n, "n", 1000000), []);
}
/** Pₙ: the path on n vertices 1–2–…–n. */
export function pathGraph(n) {
  const m = size(n, "n", 1000000);
  return make(m, range(m - 1).map((i) => [i, i + 1]));
}
/** Cₙ: the cycle on n ≥ 3 vertices. */
export function cycleGraph(n) {
  const m = size(n, "n", 1000000);
  if (m < 3) refuse("bad-argument", "a cycle needs at least 3 vertices");
  return make(m, [...range(m - 1).map((i) => [i, i + 1]), [m, 1]]);
}
/** K₁,ₙ: a centre 0 joined to leaves 1…n. */
export function star(n) {
  const m = size(n, "n", 1000000);
  const g = new Graph();
  g.addVertex(0, ...range(m));
  for (const i of range(m)) g.addEdge(0, i);
  return g;
}
/** Wₙ: the cycle 1…n with a hub 0 joined to all of it. */
export function wheel(n) {
  const g = cycleGraph(n);
  const out = new Graph();
  out.addVertex(0, ...g.vertices());
  for (const e of g.edges()) out.addEdge(e.from, e.to);
  for (const v of g.vertices()) out.addEdge(0, v);
  return out;
}
/** K_{a,b,…}: parts of the given sizes, every two vertices in different parts joined. Vertices 1…total, part by part. */
export function completeMultipartite(...sizes) {
  const ss = (sizes.length === 1 && Array.isArray(sizes[0]) ? sizes[0] : sizes).map((s) => size(s, "a part size", 2000));
  const part = [];
  ss.forEach((s, p) => {
    for (let i = 0; i < s; i++) part.push(p);
  });
  const es = [];
  for (let i = 0; i < part.length; i++) for (let j = i + 1; j < part.length; j++) if (part[i] !== part[j]) es.push([i + 1, j + 1]);
  return make(part.length, es);
}
/** K_{m,n}: parts 1…m and m+1…m+n. */
export function completeBipartite(m, n) {
  return completeMultipartite(m, n);
}
/** The Turán graph T(n, r): n vertices in r parts as equal as possible; the most edges with no K_{r+1}. */
export function turan(n, r) {
  const m = size(n, "n", 2000);
  const k = size(r, "r", 2000);
  if (k < 1) refuse("bad-argument", "r must be at least 1");
  return completeMultipartite(range(k, 0).map((i) => Math.floor(m / k) + (i < m % k ? 1 : 0)));
}
/** Qd: the d-dimensional cube, vertices the bit strings of length d, joined when they differ in one bit. */
export function hypercube(d) {
  const k = size(d, "d", 16);
  const names = range(2 ** k, 0).map((i) => i.toString(2).padStart(k, "0") || "ε");
  const g = new Graph();
  g.addVertex(...names);
  for (let i = 0; i < 2 ** k; i++) for (let b = 0; b < k; b++) if (!(i & (1 << b))) g.addEdge(names[i], names[i | (1 << b)]);
  return g;
}
/** The m × n grid; vertices "r,c" with 1 ≤ r ≤ m, 1 ≤ c ≤ n. */
export function grid(m, n) {
  const a = size(m, "m", 2000);
  const b = size(n, "n", 2000);
  const g = new Graph();
  const at = (r, c) => `${r},${c}`;
  for (let r = 1; r <= a; r++) for (let c = 1; c <= b; c++) g.addVertex(at(r, c));
  for (let r = 1; r <= a; r++) {
    for (let c = 1; c <= b; c++) {
      if (c < b) g.addEdge(at(r, c), at(r, c + 1));
      if (r < a) g.addEdge(at(r, c), at(r + 1, c));
    }
  }
  return g;
}
/** The circulant graph: vertices 0…n−1, i joined to i ± j (mod n) for each jump j. */
export function circulant(n, jumps) {
  const m = size(n, "n", 100000);
  const g = new Graph();
  g.addVertex(...range(m, 0));
  for (const j0 of jumps) {
    const j = ((size(j0, "a jump") % m) + m) % m;
    if (j === 0) continue;
    for (let i = 0; i < m; i++) {
      const k = (i + j) % m;
      if (!g.hasEdge(i, k)) g.addEdge(i, k);
    }
  }
  return g;
}
/** The Kneser graph K(n, k): the k-subsets of {1…n}, joined when disjoint. Vertices are named like "1,2,3". */
export function kneser(n, k) {
  const fam = combinations(size(n, "n", 30), size(k, "k", 30));
  if (fam.count > 5000n) refuse("too-large", `K(${n}, ${k}) has ${fam.count} vertices; the limit here is 5000`);
  const sets = fam.toArray();
  const name = (s) => s.join(",");
  const g = new Graph();
  g.addVertex(...sets.map(name));
  for (let i = 0; i < sets.length; i++) {
    const a = new Set(sets[i]);
    for (let j = i + 1; j < sets.length; j++) if (sets[j].every((x) => !a.has(x))) g.addEdge(name(sets[i]), name(sets[j]));
  }
  return g;
}
/** The Petersen graph, as the Kneser graph K(5, 2). */
export function petersen() {
  return kneser(5, 2);
}
const PLATONIC = {
  tetrahedron: "1-2 1-3 1-4 2-3 2-4 3-4",
  cube: "1-2 2-3 3-4 4-1 5-6 6-7 7-8 8-5 1-5 2-6 3-7 4-8",
  octahedron: "1-2 1-3 1-4 1-5 6-2 6-3 6-4 6-5 2-3 3-4 4-5 5-2",
  dodecahedron:
    "1-2 2-3 3-4 4-5 5-1 1-6 2-7 3-8 4-9 5-10 6-11 11-7 7-12 12-8 8-13 13-9 9-14 14-10 10-15 15-6 11-16 12-17 13-18 14-19 15-20 16-17 17-18 18-19 19-20 20-16",
  icosahedron:
    "1-2 1-3 1-4 1-5 1-6 2-3 3-4 4-5 5-6 6-2 2-7 3-7 3-8 4-8 4-9 5-9 5-10 6-10 6-11 2-11 7-8 8-9 9-10 10-11 11-7 12-7 12-8 12-9 12-10 12-11",
};
/** The skeleton of a Platonic solid: "tetrahedron", "cube", "octahedron", "dodecahedron" or "icosahedron". */
export function platonic(name) {
  const text = PLATONIC[name];
  if (!text) refuse("bad-argument", `the Platonic solids are ${Object.keys(PLATONIC).join(", ")}`);
  return graph(text);
}
/** The complete directed graph: every ordered pair. */
export function completeDigraph(n) {
  const m = size(n, "n", 2000);
  const es = [];
  for (let i = 1; i <= m; i++) for (let j = 1; j <= m; j++) if (i !== j) es.push([i, j]);
  return make(m, es, true);
}
/** The transitive tournament: i → j whenever i < j. */
export function transitiveTournament(n) {
  const m = size(n, "n", 2000);
  const es = [];
  for (let i = 1; i <= m; i++) for (let j = i + 1; j <= m; j++) es.push([i, j]);
  return make(m, es, true);
}
/** The directed cycle 1 → 2 → … → n → 1. */
export function directedCycle(n) {
  const m = size(n, "n", 1000000);
  if (m < 2) refuse("bad-argument", "a directed cycle needs at least 2 vertices");
  return make(m, [...range(m - 1).map((i) => [i, i + 1]), [m, 1]], true);
}

// ---- random graphs ----

const gen = (r) => (r instanceof Random ? r : new Random(r ?? 0));

/**
 * G(n, p): each of the possible edges present independently with exact
 * probability p (a fraction such as "1/3"). Options: directed.
 */
export function randomGraph(n, p, generator, { directed = false } = {}) {
  const m = size(n, "n", 5000);
  const r = gen(generator);
  const g = new Graph({ directed });
  g.addVertex(...range(m));
  for (let i = 1; i <= m; i++) {
    for (let j = directed ? 1 : i + 1; j <= m; j++) {
      if (i !== j && r.bool(p)) g.addEdge(i, j);
    }
  }
  return g;
}
/** G(n, m): a graph chosen uniformly among those with n vertices and exactly m edges. */
export function randomGraphWithEdges(n, m, generator, { directed = false } = {}) {
  const k = size(n, "n", 5000);
  const e = size(m, "m");
  const pairs = [];
  for (let i = 1; i <= k; i++) for (let j = directed ? 1 : i + 1; j <= k; j++) if (i !== j) pairs.push([i, j]);
  if (e > pairs.length) refuse("bad-argument", `${k} vertices allow at most ${pairs.length} edges`);
  return make(k, gen(generator).sample(pairs, e), directed);
}
