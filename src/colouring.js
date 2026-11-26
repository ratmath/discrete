// Colouring, cliques and independent sets, for small graphs where exact
// answers are possible. The chromatic number comes with a colouring that
// uses that many colours (checked) and the reason no fewer will do: a clique
// of that size when there is one, otherwise the exhaustive search that found
// no colouring with one colour fewer. The chromatic polynomial is computed by
// deletion and contraction, with the shortcuts for forests, complete graphs
// and disconnected pieces.

import { refuse } from "./counting.js";
import { indexOf, bipartition } from "./traverse.js";

const adjacency = (g) => {
  const X = indexOf(g);
  const n = X.vs.length;
  const adj = X.vs.map(() => new Set());
  for (const e of X.edges) {
    const i = X.at.get(e.from);
    const j = X.at.get(e.to);
    if (i === j) refuse("loop", `${e.from} has a loop, so no proper colouring exists`);
    adj[i].add(j);
    adj[j].add(i);
  }
  return { vs: X.vs, n, adj };
};

/** Is `colours` (vertex → colour, as a Map or object) a proper colouring of g? { ok, clash } */
export function isProperColouring(g, colours) {
  const get = (v) => (colours instanceof Map ? colours.get(v) : colours[v]);
  for (const e of g.edges()) {
    if (get(e.from) === undefined || get(e.to) === undefined) return { ok: false, clash: [e.from, e.to], reason: "an end has no colour" };
    if (e.from !== e.to && get(e.from) === get(e.to)) return { ok: false, clash: [e.from, e.to] };
  }
  return { ok: true, clash: null };
}

/** Greedy colouring in the given order (or largest degree first): colours 0, 1, 2, … as a Map. */
export function greedyColouring(g, { order } = {}) {
  const { vs, n, adj } = adjacency(g);
  const at = new Map(vs.map((v, i) => [v, i]));
  const seq = order ? order.map((v) => at.get(v)) : [...Array(n).keys()].sort((a, b) => adj[b].size - adj[a].size);
  const col = new Array(n).fill(-1);
  for (const v of seq) {
    const used = new Set([...adj[v]].map((t) => col[t]));
    let c = 0;
    while (used.has(c)) c++;
    col[v] = c;
  }
  return new Map(vs.map((v, i) => [v, col[i]]));
}

/** A largest clique (Bron–Kerbosch with pivoting). Returns the vertices. */
export function maximumClique(g) {
  const { vs, n, adj } = adjacency(g);
  let best = [];
  const bk = (R, P, X) => {
    if (!P.length && !X.length) {
      if (R.length > best.length) best = R;
      return;
    }
    if (R.length + P.length <= best.length) return;
    const u = [...P, ...X].reduce((a, b) => ([...adj[b]].filter((t) => P.includes(t)).length > [...adj[a]].filter((t) => P.includes(t)).length ? b : a));
    for (const v of P.filter((t) => !adj[u].has(t))) {
      bk([...R, v], P.filter((t) => adj[v].has(t)), X.filter((t) => adj[v].has(t)));
      P = P.filter((t) => t !== v);
      X = [...X, v];
    }
  };
  bk([], [...Array(n).keys()], []);
  return best.map((i) => vs[i]);
}
/** Every maximal clique (Bron–Kerbosch). */
export function maximalCliques(g) {
  const { vs, n, adj } = adjacency(g);
  const out = [];
  const bk = (R, P, X) => {
    if (!P.length && !X.length) {
      out.push(R.map((i) => vs[i]));
      return;
    }
    const u = [...P, ...X][0];
    for (const v of P.filter((t) => !adj[u].has(t))) {
      bk([...R, v], P.filter((t) => adj[v].has(t)), X.filter((t) => adj[v].has(t)));
      P = P.filter((t) => t !== v);
      X = [...X, v];
    }
  };
  bk([], [...Array(n).keys()], []);
  return out;
}
/** A largest independent set: a largest clique of the complement. */
export function maximumIndependentSet(g) {
  return maximumClique(g.underlying ? g.underlying().complement() : g.complement());
}

/**
 * The chromatic number, exactly, by backtracking (DSATUR order) for small graphs.
 *   { number, colouring: Map, lowerBound: { kind: "clique", clique, note } | { kind: "odd-cycle", cycle, note } | { kind: "search", tried, note } }
 * The colouring is checked; the lower bound is a clique of the same size, or,
 * when the largest clique is smaller, the record that a complete search found
 * no colouring with one colour fewer.
 */
export function chromaticNumber(g, { budget = 2_000_000 } = {}) {
  const { vs, n, adj } = adjacency(g);
  if (n === 0) return Object.freeze({ number: 0, colouring: new Map(), lowerBound: { kind: "clique", clique: [] } });
  const clique = maximumClique(g);
  const greedy = greedyColouring(g);
  let upper = Math.max(...greedy.values()) + 1;
  let bestCol = [...vs].map((v) => greedy.get(v));
  let steps = 0;
  const tryK = (k) => {
    const col = new Array(n).fill(-1);
    const sat = () => {
      // pick the uncoloured vertex with most distinct neighbour colours, then degree
      let best = -1;
      let bs = -1;
      let bd = -1;
      for (let v = 0; v < n; v++) {
        if (col[v] !== -1) continue;
        const s = new Set([...adj[v]].map((t) => col[t]).filter((c) => c !== -1)).size;
        if (s > bs || (s === bs && adj[v].size > bd)) {
          best = v;
          bs = s;
          bd = adj[v].size;
        }
      }
      return best;
    };
    const go = (coloured, maxUsed) => {
      if (++steps > budget) refuse("budget", `the search for a ${k}-colouring passed its budget of ${budget} steps`);
      if (coloured === n) return true;
      const v = sat();
      const used = new Set([...adj[v]].map((t) => col[t]));
      for (let c = 0; c < Math.min(k, maxUsed + 2); c++) {
        if (used.has(c)) continue;
        col[v] = c;
        if (go(coloured + 1, Math.max(maxUsed, c))) return true;
      }
      col[v] = -1;
      return false;
    };
    return go(0, -1) ? col : null;
  };
  for (let k = upper - 1; k >= clique.length; k--) {
    const c = tryK(k);
    if (!c) break;
    upper = k;
    bestCol = c;
  }
  const colouring = new Map(vs.map((v, i) => [v, bestCol[i]]));
  if (!isProperColouring(g, colouring).ok) throw new Error("internal: the colouring found is not proper");
  let lowerBound;
  if (upper === clique.length) lowerBound = { kind: "clique", clique, note: `${clique.length} vertices that are pairwise adjacent need ${clique.length} colours` };
  else if (upper === 3) {
    const b = bipartition(g);
    lowerBound = { kind: "odd-cycle", cycle: b.oddCycle, note: "an odd cycle cannot be coloured with two colours" };
  } else lowerBound = { kind: "search", tried: upper - 1, note: `no ${upper - 1}-colouring exists: a complete search found none` };
  return Object.freeze({ number: upper, colouring, lowerBound: Object.freeze(lowerBound) });
}

// ---- the chromatic polynomial ----------------------------------------------------------------------

const pAdd = (a, b) => Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] ?? 0n) + (b[i] ?? 0n));
const pSub = (a, b) => Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] ?? 0n) - (b[i] ?? 0n));
const pMul = (a, b) => {
  const out = new Array(a.length + b.length - 1).fill(0n);
  a.forEach((x, i) => b.forEach((y, j) => (out[i + j] += x * y)));
  return out;
};
const trimP = (p) => {
  const q = p.slice();
  while (q.length > 1 && q[q.length - 1] === 0n) q.pop();
  return q;
};
/** k(k−1)…(k−m+1) */
const falling = (m) => {
  let p = [1n];
  for (let i = 0; i < m; i++) p = pMul(p, [BigInt(-i), 1n]);
  return p;
};

/**
 * The chromatic polynomial P(k): the number of proper colourings with k
 * colours. Coefficients as BigInts, constant first, with `at(k)` and
 * `toString()`. Deletion–contraction, P(G) = P(G − e) − P(G / e), memoised
 * on the graph's shape, with closed forms for empty, complete and forest
 * pieces. Practical up to about 12 vertices and 30 edges.
 */
export function chromaticPolynomial(g) {
  const { n, adj } = adjacency(g);
  const memo = new Map();
  // a graph here: number of vertices and a sorted list of edges [i, j], i < j, on 0..m−1
  const key = (m, E) => `${m}|${E.map(([a, b]) => a * 64 + b).join(",")}`;
  const normal = (m, E) => {
    const s = new Set();
    const out = [];
    for (let [a, b] of E) {
      if (a === b) return null; // a loop: no colourings
      if (a > b) [a, b] = [b, a];
      const k = a * 4096 + b;
      if (!s.has(k)) {
        s.add(k);
        out.push([a, b]);
      }
    }
    out.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    return out;
  };
  const P = (m, E) => {
    if (E === null) return [0n];
    if (!E.length) {
      const p = new Array(m + 1).fill(0n);
      p[m] = 1n;
      return p;
    }
    const k = key(m, E);
    if (memo.has(k)) return memo.get(k);
    let res;
    if (E.length === (m * (m - 1)) / 2) res = falling(m);
    else {
      // components
      const parent = [...Array(m).keys()];
      const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
      for (const [a, b] of E) parent[find(a)] = find(b);
      const roots = new Set([...Array(m).keys()].map(find));
      if (roots.size > 1) {
        res = [1n];
        for (const r of roots) {
          const vsr = [...Array(m).keys()].filter((v) => find(v) === r);
          const map = new Map(vsr.map((v, i) => [v, i]));
          const Er = E.filter(([a]) => find(a) === r).map(([a, b]) => [map.get(a), map.get(b)]);
          res = pMul(res, P(vsr.length, normal(vsr.length, Er)));
        }
      } else if (E.length === m - 1) {
        // a tree: k(k−1)^(m−1)
        res = [0n, 1n];
        for (let i = 0; i < m - 1; i++) res = pMul(res, [-1n, 1n]);
      } else {
        // delete and contract an edge at a vertex of largest degree
        const deg = new Array(m).fill(0);
        for (const [a, b] of E) {
          deg[a]++;
          deg[b]++;
        }
        const ei = E.reduce((best, [a, b], i) => (deg[a] + deg[b] > deg[E[best][0]] + deg[E[best][1]] ? i : best), 0);
        const [a, b] = E[ei];
        const del = E.filter((_, i) => i !== ei);
        // contract b into a; relabel vertices above b down by one
        const re = (v) => (v === b ? a : v > b ? v - 1 : v);
        const con = normal(m - 1, del.map(([x, y]) => [re(x), re(y)]));
        res = pSub(P(m, del), P(m - 1, con));
      }
    }
    res = trimP(res);
    memo.set(k, res);
    return res;
  };
  const E0 = [];
  for (let i = 0; i < n; i++) for (const j of adj[i]) if (i < j) E0.push([i, j]);
  const coeffs = trimP(P(n, normal(n, E0)));
  return Object.freeze({
    coefficients: Object.freeze(coeffs),
    at: (k) => coeffs.reduceRight((acc, c) => acc * BigInt(k) + c, 0n),
    toString: () => formatInt(coeffs, "k"),
  });
}

/** A polynomial with BigInt coefficients (constant first), highest power first. */
export function formatInt(p, v = "x") {
  const parts = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const c = p[i];
    if (c === 0n) continue;
    const neg = c < 0n;
    const a = neg ? -c : c;
    const mono = i === 0 ? "" : i === 1 ? v : `${v}^${i}`;
    const t = i === 0 ? `${a}` : a === 1n ? mono : `${a}${mono}`;
    parts.push(parts.length ? `${neg ? " − " : " + "}${t}` : `${neg ? "−" : ""}${t}`);
  }
  return parts.join("") || "0";
}
