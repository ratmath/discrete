// Trees: recognising them, spanning trees of least weight, counting spanning
// trees exactly, Prüfer codes, and the family of all labelled trees.

import { Rational } from "@ratmath/core";
import { refuse, size } from "./counting.js";
import { Family } from "./enumerate.js";
import { Graph, vertexLabel } from "./graph.js";
import { indexOf, components, findCycle } from "./traverse.js";
import { Heap } from "./paths.js";
import { Random } from "./random.js";

/** No cycle (directions ignored, parallel edges and loops count as cycles). */
export function isForest(g) {
  return findCycle(g.directed ? g.underlying({ multi: true }) : g) === null;
}
/** Connected with no cycle; equivalently n − 1 edges and connected. */
export function isTree(g) {
  return g.order > 0 && g.size === g.order - 1 && components(g).length === 1;
}

class UnionFind {
  constructor(n) {
    this.p = Int32Array.from({ length: n }, (_, i) => i);
  }
  find(x) {
    while (this.p[x] !== x) x = this.p[x] = this.p[this.p[x]];
    return x;
  }
  union(a, b) {
    a = this.find(a);
    b = this.find(b);
    if (a === b) return false;
    this.p[a] = b;
    return true;
  }
}

/**
 * A spanning tree of least total weight (a spanning forest when the graph is
 * not connected). Returns { weight, edges, tree, connected, method }.
 * Options: method "kruskal" (default) or "prim"; maximum: true for the
 * heaviest. Ties are broken by the order the edges were added, so the answer
 * is the same every time.
 */
export function minimumSpanningTree(g, { method = "kruskal", maximum = false } = {}) {
  if (g.directed) refuse("bad-argument", "spanning trees here are for undirected graphs (a directed graph needs an arborescence)");
  const X = indexOf(g);
  const n = X.vs.length;
  const less = (a, b) => {
    const c = a.weight.compareTo(b.weight) * (maximum ? -1 : 1);
    return c < 0 || (c === 0 && a.id < b.id);
  };
  const chosen = [];
  if (method === "kruskal") {
    const uf = new UnionFind(n);
    const sorted = [...X.edges].sort((a, b) => (less(a, b) ? -1 : less(b, a) ? 1 : 0));
    for (const e of sorted) if (uf.union(X.at.get(e.from), X.at.get(e.to))) chosen.push(e);
  } else if (method === "prim") {
    const inTree = new Uint8Array(n);
    const byId = new Map(X.edges.map((e) => [e.id, e]));
    for (let r = 0; r < n; r++) {
      if (inTree[r]) continue;
      inTree[r] = 1;
      const heap = new Heap((a, b) => less(a, b));
      for (const [, id] of X.und[r]) heap.push(byId.get(id));
      while (heap.size) {
        const e = heap.pop();
        const a = X.at.get(e.from);
        const b = X.at.get(e.to);
        const fresh = inTree[a] ? (inTree[b] ? -1 : b) : a;
        if (fresh < 0) continue;
        inTree[fresh] = 1;
        chosen.push(e);
        for (const [, id] of X.und[fresh]) heap.push(byId.get(id));
      }
    }
  } else refuse("bad-argument", `method is "kruskal" or "prim", not ${JSON.stringify(method)}`);
  const tree = new Graph();
  tree.addVertex(...X.vs);
  for (const e of chosen) tree.addEdge(e.from, e.to, g.weighted ? e.weight : undefined);
  const weight = chosen.reduce((s, e) => s.add(e.weight), new Rational(0n));
  return { weight, edges: chosen, tree, connected: chosen.length === n - 1 && n > 0, method };
}

/** Exact determinant of a square BigInt matrix (Bareiss elimination: every division is exact). */
export function determinant(rows) {
  const a = rows.map((r) => r.map((x) => BigInt(x)));
  const n = a.length;
  if (n === 0) return 1n;
  let sign = 1n;
  let prev = 1n;
  for (let k = 0; k < n - 1; k++) {
    if (a[k][k] === 0n) {
      const s = a.findIndex((r, i) => i > k && r[k] !== 0n);
      if (s < 0) return 0n;
      [a[k], a[s]] = [a[s], a[k]];
      sign = -sign;
    }
    for (let i = k + 1; i < n; i++) {
      for (let j = k + 1; j < n; j++) a[i][j] = (a[i][j] * a[k][k] - a[i][k] * a[k][j]) / prev;
    }
    prev = a[k][k];
  }
  return sign * a[n - 1][n - 1];
}

/**
 * The number of spanning trees, exactly, by Kirchhoff's matrix-tree theorem:
 * any cofactor of the Laplacian. Parallel edges count separately; loops do
 * not count; directions are ignored. 0 for a disconnected graph.
 */
export function spanningTreeCount(g) {
  const X = indexOf(g);
  const n = X.vs.length;
  if (n === 0) refuse("bad-argument", "the empty graph has no spanning tree");
  const L = X.vs.map(() => Array(n).fill(0n));
  for (const e of X.edges) {
    const i = X.at.get(e.from);
    const j = X.at.get(e.to);
    if (i === j) continue;
    L[i][i] += 1n;
    L[j][j] += 1n;
    L[i][j] -= 1n;
    L[j][i] -= 1n;
  }
  return determinant(L.slice(1).map((r) => r.slice(1)));
}

// ---- Prüfer codes ----

const natural = (a, b) => (typeof a === typeof b ? (a < b ? -1 : a > b ? 1 : 0) : typeof a === "string" ? 1 : -1);

/**
 * The Prüfer code of a labelled tree: repeatedly remove the smallest leaf and
 * write down its neighbour, until two vertices remain. A tree on n vertices
 * gives a sequence of n − 2 labels, and every such sequence comes from
 * exactly one tree. "Smallest" is numeric order, then text; pass
 * `{ vertices }` to fix another order.
 */
export function prufer(tree, { vertices } = {}) {
  if (tree.directed || !isTree(tree)) refuse("bad-argument", "a Prüfer code is defined for an undirected tree");
  const vs = vertices ? vertices.map(vertexLabel) : [...tree.vertices()].sort(natural);
  if (vs.length !== tree.order || vs.some((v) => !tree.hasVertex(v))) refuse("bad-argument", "vertices must list exactly the vertices of the tree");
  const n = vs.length;
  if (n < 2) return [];
  const at = new Map(vs.map((v, i) => [v, i]));
  const deg = vs.map((v) => tree.degree(v));
  const nb = vs.map((v) => tree.neighbors(v).map((u) => at.get(u)));
  const removed = new Uint8Array(n);
  const code = [];
  let ptr = deg.findIndex((d) => d === 1);
  let leaf = ptr;
  for (let k = 0; k < n - 2; k++) {
    removed[leaf] = 1;
    const p = nb[leaf].find((u) => !removed[u]);
    code.push(vs[p]);
    if (--deg[p] === 1 && p < ptr) leaf = p;
    else {
      ptr++;
      while (deg[ptr] !== 1 || removed[ptr]) ptr++;
      leaf = ptr;
    }
  }
  return code;
}

/** The tree with a given Prüfer code, on the vertices 1…n (n = code length + 2) or on the labels given, smallest first. */
export function fromPrufer(code, vertices) {
  const n = vertices ? vertices.length : code.length + 2;
  if (n !== code.length + 2) refuse("bad-argument", `a code of length ${code.length} names a tree on ${code.length + 2} vertices`);
  const vs = vertices ? vertices.map(vertexLabel) : Array.from({ length: n }, (_, i) => i + 1);
  const at = new Map(vs.map((v, i) => [v, i]));
  if (at.size !== n) refuse("bad-argument", "the vertex labels must be distinct");
  const c = code.map((x) => {
    const i = at.get(vertexLabel(x));
    if (i === undefined) refuse("not-in-family", `${String(x)} is not one of the vertices`);
    return i;
  });
  const deg = new Int32Array(n).fill(1);
  for (const i of c) deg[i]++;
  const t = new Graph();
  t.addVertex(...vs);
  let ptr = deg.findIndex((d) => d === 1);
  let leaf = ptr;
  for (const p of c) {
    t.addEdge(vs[leaf], vs[p]);
    deg[leaf] = 0;
    if (--deg[p] === 1 && p < ptr) leaf = p;
    else {
      ptr++;
      while (deg[ptr] !== 1) ptr++;
      leaf = ptr;
    }
  }
  const rest = [...deg.keys()].filter((i) => deg[i] === 1);
  if (n >= 2) t.addEdge(vs[rest[0]], vs[rest[1]]);
  return t;
}

/**
 * All labelled trees on n vertices (or on the given labels) as a Family:
 * there are n^(n−2) of them (Cayley), numbered through their Prüfer codes.
 */
export function labelledTrees(spec) {
  const vs = Array.isArray(spec) ? spec.map(vertexLabel) : Array.from({ length: size(spec, "n", 100000) }, (_, i) => i + 1);
  const sorted = [...vs].sort(natural);
  const n = vs.length;
  if (n === 0) refuse("bad-argument", "there are no trees on no vertices");
  const N = BigInt(n);
  const k = Math.max(0, n - 2);
  const count = n === 1 ? 1n : N ** BigInt(k);
  const at = new Map(sorted.map((v, i) => [v, BigInt(i)]));
  const unrank = (r) => {
    if (n === 1) return new Graph().addVertex(sorted[0]);
    const code = Array(k);
    for (let p = k - 1; p >= 0; p--) {
      code[p] = sorted[Number(r % N)];
      r /= N;
    }
    return fromPrufer(code, sorted);
  };
  const rank = (t) => {
    if (!(t instanceof Graph) || t.order !== n || sorted.some((v) => !t.hasVertex(v))) refuse("not-in-family", `not a tree on these ${n} vertices`);
    if (!isTree(t)) refuse("not-in-family", "not a tree");
    if (n === 1) return 0n;
    return prufer(t, { vertices: sorted }).reduce((r, x) => r * N + at.get(x), 0n);
  };
  return new Family({ name: `labelled trees on ${n} vertices`, count, unrank, rank, order: "by Prüfer code" });
}

/** A labelled tree chosen uniformly among all n^(n−2), on 1…n or the given labels. */
export function randomTree(spec, generator) {
  return labelledTrees(spec).random(generator instanceof Random ? generator : new Random(generator ?? 0));
}
