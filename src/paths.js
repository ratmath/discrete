// Shortest paths with exact weights, Euler tours and Hamilton cycles.
//
// Weights are Core Rationals, so a distance is exact: 1/3 + 1/3 + 1/3 is 1,
// not 0.9999999999999999, and two routes of equal length are recognised as
// equal. Dijkstra's method serves graphs without negative weights;
// Bellman–Ford serves the rest, and reports a negative cycle (the reason no
// shortest path exists) instead of a number.

import { Rational } from "@ratmath/core";
import { DiscreteError, refuse } from "./counting.js";
import { vertexLabel } from "./graph.js";
import { indexOf, components, biconnected } from "./traverse.js";

const ZERO = new Rational(0n);

class Heap {
  constructor(less) {
    this.a = [];
    this.less = less;
  }
  get size() {
    return this.a.length;
  }
  push(x) {
    const a = this.a;
    a.push(x);
    for (let i = a.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (!this.less(a[i], a[p])) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && this.less(a[l], a[m])) m = l;
        if (r < a.length && this.less(a[r], a[m])) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}
export { Heap };

const weightOf = (X) => {
  const w = new Map(X.edges.map((e) => [e.id, e.weight]));
  return (id) => w.get(id);
};

function negativeCycleFrom(X, parent, parentEdge, start) {
  // walk back n steps to be sure of standing on the cycle, then go round it
  let v = start;
  for (let k = 0; k < X.vs.length; k++) v = parent[v];
  const cyc = [v];
  for (let u = parent[v]; u !== v; u = parent[u]) cyc.push(u);
  cyc.push(v);
  return cyc.reverse().map((i) => X.vs[i]);
}

/**
 * Shortest paths from one vertex to all others. Returns
 *   { source, distance: Map(vertex → Rational), parent: Map, method, pathTo(t), negativeCycle }
 * pathTo(t) gives { distance, path, edges } or null when t cannot be reached.
 * When a negative cycle can be reached, distance and pathTo are absent and
 * negativeCycle lists it as [v₁, …, v₁].
 * Options: weighted (false counts edges; default: the graph's own weights).
 */
export function shortestPaths(g, source, { weighted = g.weighted } = {}) {
  const X = indexOf(g);
  const s = X.at.get(vertexLabel(source));
  if (s === undefined) refuse("bad-argument", `${String(source)} is not a vertex of this graph`);
  const n = X.vs.length;
  const W = weightOf(X);
  const w = weighted ? W : () => new Rational(1n);
  const dist = Array(n).fill(null);
  const parent = new Int32Array(n).fill(-1);
  const parentEdge = new Float64Array(n).fill(-1);
  const negative = weighted && X.edges.some((e) => e.weight.lessThan(ZERO));
  let method;
  dist[s] = ZERO;
  if (negative && !g.directed) {
    const e = X.edges.find((x) => x.weight.lessThan(ZERO));
    return { source: X.vs[s], method: "refused", negativeCycle: [e.from, e.to, e.from] };
  }
  if (!negative) {
    method = weighted ? "dijkstra" : "breadth-first";
    const done = new Uint8Array(n);
    const heap = new Heap((a, b) => a[0].lessThan(b[0]) || (a[0].equals(b[0]) && a[1] < b[1]));
    heap.push([ZERO, s]);
    while (heap.size) {
      const [d, i] = heap.pop();
      if (done[i]) continue;
      done[i] = 1;
      for (const [j, id] of X.out[i]) {
        if (done[j]) continue;
        const nd = d.add(w(id));
        if (dist[j] === null || nd.lessThan(dist[j])) {
          dist[j] = nd;
          parent[j] = i;
          parentEdge[j] = id;
          heap.push([nd, j]);
        }
      }
    }
  } else {
    method = "bellman-ford";
    let changed = -1;
    for (let round = 0; round < n; round++) {
      changed = -1;
      for (let i = 0; i < n; i++) {
        if (dist[i] === null) continue;
        for (const [j, id] of X.out[i]) {
          const nd = dist[i].add(w(id));
          if (dist[j] === null || nd.lessThan(dist[j])) {
            dist[j] = nd;
            parent[j] = i;
            parentEdge[j] = id;
            changed = j;
          }
        }
      }
      if (changed < 0) break;
    }
    if (changed >= 0) return { source: X.vs[s], method, negativeCycle: negativeCycleFrom(X, parent, parentEdge, changed) };
  }
  const distance = new Map();
  const par = new Map();
  for (let i = 0; i < n; i++) {
    if (dist[i] === null) continue;
    distance.set(X.vs[i], dist[i]);
    par.set(X.vs[i], parent[i] >= 0 ? X.vs[parent[i]] : null);
  }
  const byId = new Map(X.edges.map((e) => [e.id, e]));
  const pathTo = (t) => {
    const j = X.at.get(vertexLabel(t));
    if (j === undefined) refuse("bad-argument", `${String(t)} is not a vertex of this graph`);
    if (dist[j] === null) return null;
    const path = [];
    const edges = [];
    for (let k = j; k >= 0; k = parent[k]) {
      path.push(X.vs[k]);
      if (parent[k] >= 0) {
        const e = byId.get(parentEdge[k]);
        edges.push(e.from === X.vs[parent[k]] ? e : { id: e.id, from: X.vs[parent[k]], to: X.vs[k], weight: e.weight });
      }
    }
    return { distance: dist[j], path: path.reverse(), edges: edges.reverse() };
  };
  return { source: X.vs[s], method, distance, parent: par, pathTo, negativeCycle: null };
}

/**
 * A shortest path from s to t: { distance, path, edges }, or null when t
 * cannot be reached. The distance is an exact Rational. Throws a
 * DiscreteError with code "negative-cycle" (and the cycle in `.cycle`) when
 * a negative cycle makes the question meaningless.
 */
export function shortestPath(g, s, t, options) {
  const r = shortestPaths(g, s, options);
  if (r.negativeCycle) {
    const err = new DiscreteError("negative-cycle", `no shortest path: the cycle ${r.negativeCycle.join(" → ")} has negative total weight`);
    err.cycle = r.negativeCycle;
    throw err;
  }
  return r.pathTo(t);
}

/**
 * Shortest distances between all pairs (Floyd–Warshall). Returns
 *   { vertices, matrix, distance(u, v), path(u, v), negativeCycle }
 * with matrix[i][j] a Rational or null (unreachable).
 */
export function allPairsShortestPaths(g, { weighted = g.weighted } = {}) {
  const X = indexOf(g);
  const n = X.vs.length;
  const W = weightOf(X);
  const D = X.vs.map(() => Array(n).fill(null));
  const next = X.vs.map(() => new Int32Array(n).fill(-1));
  for (let i = 0; i < n; i++) {
    D[i][i] = ZERO;
    next[i][i] = i;
  }
  for (let i = 0; i < n; i++) {
    for (const [j, id] of X.out[i]) {
      const w = weighted ? W(id) : new Rational(1n);
      if (i === j) {
        if (w.lessThan(ZERO)) D[i][i] = w;
        continue;
      }
      if (D[i][j] === null || w.lessThan(D[i][j])) {
        D[i][j] = w;
        next[i][j] = j;
      }
    }
  }
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      if (D[i][k] === null) continue;
      for (let j = 0; j < n; j++) {
        if (D[k][j] === null) continue;
        const nd = D[i][k].add(D[k][j]);
        if (D[i][j] === null || nd.lessThan(D[i][j])) {
          D[i][j] = nd;
          next[i][j] = next[i][k];
        }
      }
    }
  }
  const bad = D.findIndex((row, i) => row[i].lessThan(ZERO));
  if (bad >= 0) {
    const r = shortestPaths(g, X.vs[bad], { weighted });
    return { vertices: X.vs, negativeCycle: r.negativeCycle ?? [X.vs[bad], X.vs[bad]] };
  }
  const at = (v) => {
    const i = X.at.get(vertexLabel(v));
    if (i === undefined) refuse("bad-argument", `${String(v)} is not a vertex of this graph`);
    return i;
  };
  return {
    vertices: X.vs,
    matrix: D,
    negativeCycle: null,
    distance: (u, v) => D[at(u)][at(v)],
    path: (u, v) => {
      let i = at(u);
      const j = at(v);
      if (D[i][j] === null) return null;
      const p = [X.vs[i]];
      while (i !== j) {
        i = next[i][j];
        p.push(X.vs[i]);
      }
      return p;
    },
  };
}

// ---- Euler ----

/**
 * An Euler tour: a walk using every edge exactly once. Returns
 *   { exists: true, closed, vertices, edges }
 * (closed: it ends where it starts), or { exists: false, reason, ... } with
 * the vertices of odd degree (or unbalanced in and out degree) or the
 * separate components as the evidence. Option closed: true asks for a
 * circuit only.
 */
export function eulerTour(g, { closed: wantClosed = false } = {}) {
  const X = indexOf(g);
  const n = X.vs.length;
  if (X.edges.length === 0) return { exists: true, closed: true, vertices: n ? [X.vs[0]] : [], edges: [] };
  const busy = X.vs.filter((v, i) => X.und[i].length > 0);
  const comps = components(g).filter((c) => c.some((v) => busy.includes(v)));
  if (comps.length > 1) return { exists: false, reason: "the edges lie in more than one component", components: comps.filter((c) => c.length > 1 || busy.includes(c[0])) };
  let start = X.vs.indexOf(busy[0]);
  let isClosed = true;
  if (g.directed) {
    const bal = X.vs.map((_, i) => X.out[i].length - X.inn[i].length);
    const plus = bal.flatMap((b, i) => (b === 1 ? [i] : []));
    const minus = bal.flatMap((b, i) => (b === -1 ? [i] : []));
    const off = bal.flatMap((b, i) => (b !== 0 ? [i] : []));
    if (off.length) {
      if (wantClosed || off.length !== 2 || plus.length !== 1 || minus.length !== 1) {
        return { exists: false, reason: wantClosed ? "a closed tour needs in-degree = out-degree at every vertex" : "a tour needs every vertex balanced, except possibly one with one more edge out and one with one more edge in", unbalanced: off.map((i) => ({ vertex: X.vs[i], out: X.out[i].length, in: X.inn[i].length })) };
      }
      start = plus[0];
      isClosed = false;
    }
  } else {
    const odd = X.vs.filter((v) => g.degree(v) % 2 === 1);
    if (odd.length) {
      if (wantClosed || odd.length !== 2) return { exists: false, reason: wantClosed ? "a closed tour needs every degree even" : `a tour needs 0 or 2 vertices of odd degree; this graph has ${odd.length}`, odd };
      start = X.at.get(odd[0]);
      isClosed = false;
    }
  }
  const adj = g.directed ? X.out : X.und;
  const used = new Set();
  const ptr = new Int32Array(n);
  const stack = [[start, -1]];
  const tour = [];
  while (stack.length) {
    const top = stack[stack.length - 1];
    const v = top[0];
    while (ptr[v] < adj[v].length && used.has(adj[v][ptr[v]][1])) ptr[v]++;
    if (ptr[v] < adj[v].length) {
      const [w, id] = adj[v][ptr[v]++];
      used.add(id);
      stack.push([w, id]);
    } else tour.push(stack.pop());
  }
  tour.reverse();
  const byId = new Map(X.edges.map((e) => [e.id, e]));
  const vertices = tour.map(([v]) => X.vs[v]);
  const edges = tour.slice(1).map(([v, id], k) => {
    const e = byId.get(id);
    const from = vertices[k];
    return e.from === from ? e : { id: e.id, from, to: X.vs[v], weight: e.weight };
  });
  return { exists: true, closed: isClosed, vertices, edges };
}

// ---- Hamilton ----

const HAMILTON_LIMIT = 20;

function hamilton(g, cycle) {
  const X = indexOf(g);
  const n = X.vs.length;
  if (n === 0) refuse("bad-argument", "the empty graph has no Hamilton path or cycle");
  if (n > HAMILTON_LIMIT) refuse("too-large", `the exhaustive search is limited to ${HAMILTON_LIMIT} vertices; this graph has ${n}`);
  if (cycle && !g.directed && n < 3) return { exists: false, reason: "a Hamilton cycle needs at least 3 vertices" };
  if (cycle && n === 1) return { exists: false, reason: "a Hamilton cycle needs at least 2 vertices" };
  // quick certificates
  const strongOrWeak = components(g);
  if (strongOrWeak.length > 1) return { exists: false, reason: "the graph is not connected", components: strongOrWeak };
  if (cycle && !g.directed) {
    const low = X.vs.find((v) => g.neighbors(v).filter((u) => u !== v).length < 2);
    if (low !== undefined) return { exists: false, reason: `${String(low)} has fewer than two neighbours`, vertex: low };
    const cut = biconnected(g).cutVertices;
    if (cut.length) return { exists: false, reason: `${String(cut[0])} is a cut vertex, and a cycle through every vertex has none`, vertex: cut[0] };
  }
  const adjSrc = g.directed ? X.out : X.und;
  const adj = new Int32Array(n);
  for (let i = 0; i < n; i++) for (const [j] of adjSrc[i]) if (i !== j) adj[i] |= 1 << j;
  const full = (1 << n) - 1;
  const dp = new Int32Array(1 << n); // dp[mask]: the possible end vertices of a path covering mask
  if (cycle) dp[1] = 1;
  else for (let i = 0; i < n; i++) dp[1 << i] = 1 << i;
  for (let mask = 1; mask <= full; mask++) {
    let ends = dp[mask];
    if (!ends) continue;
    while (ends) {
      const b = ends & -ends;
      ends ^= b;
      const v = 31 - Math.clz32(b);
      let nxt = adj[v] & ~mask;
      while (nxt) {
        const c = nxt & -nxt;
        nxt ^= c;
        dp[mask | c] |= c;
      }
    }
  }
  let last = -1;
  for (let v = 0; v < n; v++) {
    if (!(dp[full] & (1 << v))) continue;
    if (!cycle || adj[v] & 1) {
      last = v;
      break;
    }
  }
  if (last < 0) return { exists: false, reason: `no ${cycle ? "cycle" : "path"} through every vertex: an exhaustive search over all ${2 ** n} vertex sets found none` };
  const order = [last];
  let mask = full;
  let v = last;
  while (mask !== (cycle ? 1 : 1 << v)) {
    const prev = mask ^ (1 << v);
    let u = 0;
    for (; u < n; u++) if (dp[prev] & (1 << u) && adj[u] & (1 << v)) break;
    order.push(u);
    mask = prev;
    v = u;
  }
  order.reverse();
  const vs = order.map((i) => X.vs[i]);
  return cycle ? { exists: true, cycle: [...vs, vs[0]] } : { exists: true, path: vs };
}
/** A Hamilton cycle (through every vertex once), by exhaustive search for up to 20 vertices: { exists, cycle } or { exists: false, reason }. */
export function hamiltonCycle(g) {
  return hamilton(g, true);
}
/** A Hamilton path, by exhaustive search for up to 20 vertices: { exists, path } or { exists: false, reason }. */
export function hamiltonPath(g) {
  return hamilton(g, false);
}
