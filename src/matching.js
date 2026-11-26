// Matchings and flows, each answer with the certificate that proves it best.
//
//   maximumMatching      Edmonds' blossom method; optimality is shown by a
//                        Tutte–Berge set U: no matching is larger than
//                        (n + |U| − odd(G − U))/2, and this one reaches it.
//   bipartiteMatching    augmenting paths; a perfect matching of one side, or
//                        Hall's violator S with |N(S)| < |S|, and a König
//                        vertex cover the same size as the matching.
//   assignment           the cheapest (or dearest) perfect matching in a cost
//                        matrix, by exact linear programming, with the dual
//                        prices that prove it.
//   stableMatching       Gale and Shapley, checked for blocking pairs.
//   maxFlow              Edmonds and Karp on exact rational capacities, with a
//                        cut of the same capacity.

import { Rational } from "@ratmath/core";
import { refuse } from "./counting.js";
import { Graph, graph, vertexLabel } from "./graph.js";
import { indexOf } from "./traverse.js";
import { linearProgram } from "./lp.js";

const ZERO = new Rational(0n);
const simpleAdj = (g) => {
  const X = indexOf(g);
  const n = X.vs.length;
  const adj = X.vs.map(() => new Set());
  for (const e of X.edges) {
    const i = X.at.get(e.from);
    const j = X.at.get(e.to);
    if (i !== j) {
      adj[i].add(j);
      adj[j].add(i);
    }
  }
  return { X, n, adj: adj.map((s) => [...s]) };
};

/** Edmonds' blossom algorithm on an adjacency list: match[v] = partner or −1. */
function blossom(n, adj, initial) {
  const match = initial ? initial.slice() : new Array(n).fill(-1);
  const p = new Array(n);
  const base = new Array(n);
  const used = new Array(n);
  const inBlossom = new Array(n);
  const q = [];
  const lca = (a, b) => {
    const seen = new Array(n).fill(false);
    for (;;) {
      a = base[a];
      seen[a] = true;
      if (match[a] === -1) break;
      a = p[match[a]];
    }
    for (;;) {
      b = base[b];
      if (seen[b]) return b;
      b = p[match[b]];
    }
  };
  const markPath = (v, b, child) => {
    while (base[v] !== b) {
      inBlossom[base[v]] = inBlossom[base[match[v]]] = true;
      p[v] = child;
      child = match[v];
      v = p[match[v]];
    }
  };
  const findPath = (root) => {
    used.fill(false);
    p.fill(-1);
    for (let i = 0; i < n; i++) base[i] = i;
    used[root] = true;
    q.length = 0;
    q.push(root);
    let qh = 0;
    while (qh < q.length) {
      const v = q[qh++];
      for (const to of adj[v]) {
        if (base[v] === base[to] || match[v] === to) continue;
        if (to === root || (match[to] !== -1 && p[match[to]] !== -1)) {
          const cur = lca(v, to);
          inBlossom.fill(false);
          markPath(v, cur, to);
          markPath(to, cur, v);
          for (let i = 0; i < n; i++) {
            if (inBlossom[base[i]]) {
              base[i] = cur;
              if (!used[i]) {
                used[i] = true;
                q.push(i);
              }
            }
          }
        } else if (p[to] === -1) {
          p[to] = v;
          if (match[to] === -1) return to;
          used[match[to]] = true;
          q.push(match[to]);
        }
      }
    }
    return -1;
  };
  for (let v = 0; v < n; v++) {
    if (match[v] !== -1) continue;
    const u = findPath(v);
    if (u === -1) continue;
    let x = u;
    while (x !== -1) {
      const pv = p[x];
      const ppv = match[pv];
      match[x] = pv;
      match[pv] = x;
      x = ppv;
    }
  }
  return match;
}

/** Odd components of the graph with the vertices in `remove` deleted. */
function oddComponents(n, adj, remove) {
  const gone = new Array(n).fill(false);
  for (const v of remove) gone[v] = true;
  const seen = new Array(n).fill(false);
  const odd = [];
  for (let s = 0; s < n; s++) {
    if (gone[s] || seen[s]) continue;
    const comp = [s];
    seen[s] = true;
    for (let i = 0; i < comp.length; i++) for (const t of adj[comp[i]]) if (!gone[t] && !seen[t]) {
      seen[t] = true;
      comp.push(t);
    }
    if (comp.length % 2) odd.push(comp);
  }
  return odd;
}

/**
 * A maximum matching of an undirected graph (directions and weights ignored).
 *   { size, edges: [[u, v], …], perfect, unmatched,
 *     certificate: { set: U, oddComponents, bound } }   (Tutte–Berge)
 * The set U is the Gallai–Edmonds set A: the neighbours of the vertices that
 * some maximum matching misses. Deleting U leaves odd(G − U) odd components,
 * each of which can be matched into U at most once, so no matching is larger
 * than (n + |U| − odd(G − U))/2. `check()` recomputes that bound.
 */
export function maximumMatching(g) {
  const { X, n, adj } = simpleAdj(g);
  const match = blossom(n, adj);
  const size = match.filter((m) => m !== -1).length / 2;
  // Gallai–Edmonds: D = vertices missed by some maximum matching
  const D = new Set();
  for (let v = 0; v < n; v++) {
    if (match[v] === -1) {
      D.add(v);
      continue;
    }
    // is there a maximum matching missing v? remove v and see whether the size stays
    const adj2 = adj.map((a, i) => (i === v ? [] : a.filter((t) => t !== v)));
    const m2 = match.slice();
    m2[m2[v]] = -1;
    m2[v] = -1;
    const r = blossom(n, adj2, m2);
    if (r.filter((m) => m !== -1).length / 2 === size) D.add(v);
  }
  const A = new Set();
  for (const d of D) for (const t of adj[d]) if (!D.has(t)) A.add(t);
  const U = [...A];
  const odd = oddComponents(n, adj, U);
  const bound = (n + U.length - odd.length) / 2;
  if (bound !== size) throw new Error("internal: the Tutte–Berge bound does not meet the matching");
  const edges = [];
  for (let v = 0; v < n; v++) if (match[v] > v) edges.push([X.vs[v], X.vs[match[v]]]);
  return Object.freeze({
    size,
    edges,
    perfect: 2 * size === n,
    unmatched: X.vs.filter((_, v) => match[v] === -1),
    certificate: Object.freeze({ set: U.map((i) => X.vs[i]), oddComponents: odd.map((c) => c.map((i) => X.vs[i])), bound }),
    check: () => checkMatching(g, edges, U.map((i) => X.vs[i])),
  });
}

/**
 * Check a matching and a Tutte–Berge set by direct counting: the edges are
 * edges of g and share no ends, and (n + |U| − odd(G − U))/2 equals the
 * matching's size. { ok, size, bound, errors }.
 */
export function checkMatching(g, edges, U) {
  const { X, n, adj } = simpleAdj(g);
  const errors = [];
  const used = new Set();
  for (const [u, v] of edges) {
    if (!g.hasEdge(u, v) && !g.hasEdge(v, u)) errors.push(`${u}–${v} is not an edge`);
    for (const w of [u, v]) {
      const k = String(vertexLabel(w));
      if (used.has(k)) errors.push(`${w} is matched twice`);
      used.add(k);
    }
  }
  const idx = U.map((u) => X.at.get(vertexLabel(u)));
  const bound = (n + idx.length - oddComponents(n, adj, idx).length) / 2;
  if (bound !== edges.length) errors.push(`the Tutte–Berge bound is ${bound}, the matching has ${edges.length} edges`);
  return { ok: errors.length === 0, size: edges.length, bound, errors };
}

/**
 * A maximum matching of a bipartite graph, from the left side (found by
 * two-colouring when not given).
 *   { size, edges, perfect (every left vertex matched), cover,
 *     hall: null or { set: S, neighbours: N(S) } with |N(S)| < |S| }
 * The vertex cover (König) has as many vertices as the matching has edges, and
 * every edge has an end in it, so no matching is larger. When some left
 * vertex is unmatched, the left vertices reachable from it by alternating
 * paths form a set S whose neighbourhood is smaller than S: Hall's condition
 * fails, which is why no matching covers the left side.
 */
export function bipartiteMatching(g, { left } = {}) {
  const { X, n, adj } = simpleAdj(g);
  let L;
  if (left) L = left.map((v) => X.at.get(vertexLabel(v)));
  else {
    const side = new Array(n).fill(-1);
    for (let s = 0; s < n; s++) {
      if (side[s] !== -1) continue;
      side[s] = 0;
      const st = [s];
      while (st.length) {
        const v = st.pop();
        for (const t of adj[v]) {
          if (side[t] === -1) {
            side[t] = 1 - side[v];
            st.push(t);
          } else if (side[t] === side[v]) refuse("not-bipartite", "the graph is not bipartite: use maximumMatching");
        }
      }
    }
    L = [...Array(n).keys()].filter((v) => side[v] === 0);
  }
  const isLeft = new Array(n).fill(false);
  for (const v of L) isLeft[v] = true;
  for (const v of L) for (const t of adj[v]) if (isLeft[t]) refuse("not-bipartite", `${X.vs[v]} and ${X.vs[t]} are both on the left`);
  const mate = new Array(n).fill(-1);
  const tryAug = (v, seen) => {
    for (const t of adj[v]) {
      if (seen[t]) continue;
      seen[t] = true;
      if (mate[t] === -1 || tryAug(mate[t], seen)) {
        mate[t] = v;
        mate[v] = t;
        return true;
      }
    }
    return false;
  };
  for (const v of L) if (mate[v] === -1) tryAug(v, new Array(n).fill(false));
  // alternating reachability from unmatched left vertices
  const reachL = new Set();
  const reachR = new Set();
  const stack = L.filter((v) => mate[v] === -1);
  stack.forEach((v) => reachL.add(v));
  while (stack.length) {
    const v = stack.pop();
    for (const t of adj[v]) if (!reachR.has(t)) {
      reachR.add(t);
      const m = mate[t];
      if (m !== -1 && !reachL.has(m)) {
        reachL.add(m);
        stack.push(m);
      }
    }
  }
  const cover = [...L.filter((v) => !reachL.has(v)), ...reachR];
  const edges = L.filter((v) => mate[v] !== -1).map((v) => [X.vs[v], X.vs[mate[v]]]);
  if (cover.length !== edges.length) throw new Error("internal: König's cover does not match the matching");
  const unmatched = L.filter((v) => mate[v] === -1);
  let hall = null;
  if (unmatched.length) {
    const S = [...reachL];
    const NS = new Set(S.flatMap((v) => adj[v]));
    hall = Object.freeze({ set: S.map((i) => X.vs[i]), neighbours: [...NS].map((i) => X.vs[i]) });
  }
  return Object.freeze({
    size: edges.length,
    edges,
    perfect: unmatched.length === 0,
    cover: cover.map((i) => X.vs[i]),
    hall,
  });
}

/**
 * The best assignment of rows to columns in a square cost matrix: a perfect
 * matching of least total cost (or greatest, with { maximize: true }). Solved
 * as a linear program, whose optimal vertex is a permutation (the assignment
 * polytope's vertices are), so the dual prices u (rows) and v (columns), with
 * uᵢ + vⱼ ≤ cᵢⱼ and Σu + Σv equal to the cost, prove that nothing is cheaper.
 *   { assignment: [column of row 0, …], cost, rowPrices, columnPrices, check() }
 */
export function assignment(costs, { maximize = false } = {}) {
  const n = costs.length;
  if (!n || costs.some((r) => r.length !== n)) refuse("bad-argument", "a cost matrix is square");
  const C = costs.map((r) => r.map((c) => (c instanceof Rational ? c : new Rational(String(c)))));
  const name = (i, j) => `x${i}_${j}`;
  const names = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) names.push(name(i, j));
  const obj = Object.fromEntries(names.map((k) => [k, C[+k.slice(1).split("_")[0]][+k.split("_")[1]]]));
  const constraints = [];
  for (let i = 0; i < n; i++) constraints.push({ coefficients: Object.fromEntries([...Array(n).keys()].map((j) => [name(i, j), 1])), relation: "=", rhs: 1, name: `row${i}` });
  for (let j = 0; j < n; j++) constraints.push({ coefficients: Object.fromEntries([...Array(n).keys()].map((i) => [name(i, j), 1])), relation: "=", rhs: 1, name: `col${j}` });
  const r = linearProgram({ [maximize ? "maximize" : "minimize"]: obj, constraints, names });
  if (r.status !== "optimal") throw new Error("internal: the assignment problem is always feasible and bounded");
  const sol = r.solution;
  const perm = [];
  for (let i = 0; i < n; i++) {
    const j = [...Array(n).keys()].find((j) => sol[name(i, j)].equals(new Rational(1n)));
    if (j === undefined) throw new Error("internal: the optimal vertex is not a permutation");
    perm.push(j);
  }
  const prices = r.prices;
  const u = [...Array(n).keys()].map((i) => prices[`row${i}`]);
  const v = [...Array(n).keys()].map((j) => prices[`col${j}`]);
  const cost = perm.reduce((s, j, i) => s.add(C[i][j]), ZERO);
  const check = () => {
    const errors = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const s = u[i].add(v[j]);
      if (maximize ? s.lessThan(C[i][j]) : s.greaterThan(C[i][j])) errors.push(`u${i} + v${j} = ${s} ${maximize ? "<" : ">"} c = ${C[i][j]}`);
    }
    const total = [...u, ...v].reduce((s, x) => s.add(x), ZERO);
    if (!total.equals(cost)) errors.push(`the prices add to ${total}, the assignment costs ${cost}`);
    if (new Set(perm).size !== n) errors.push("not a permutation");
    return { ok: errors.length === 0, errors };
  };
  return Object.freeze({ assignment: perm, cost, rowPrices: u, columnPrices: v, check });
}

/**
 * Stable matching by Gale and Shapley: the proposers propose in order of
 * preference, and each receiver holds the best offer so far. The result is
 * the stable matching best for every proposer.
 *   stableMatching({ a: ["x", "y"], b: ["y", "x"] }, { x: ["b", "a"], y: ["a", "b"] })
 *   { matching: { proposer: receiver }, rounds, blockingPairs: [] }
 * Preference lists may be incomplete; someone left unmatched is absent from
 * `matching`. The blocking pairs are recomputed from scratch and should be
 * none.
 */
export function stableMatching(proposers, receivers) {
  const P = Object.keys(proposers);
  const rank = Object.fromEntries(Object.entries(receivers).map(([r, list]) => [r, new Map(list.map((p, i) => [p, i]))]));
  const next = Object.fromEntries(P.map((p) => [p, 0]));
  const held = {}; // receiver → proposer
  const free = [...P];
  let proposals = 0;
  while (free.length) {
    const p = free.shift();
    const list = proposers[p];
    if (next[p] >= list.length) continue;
    const r = list[next[p]++];
    proposals++;
    if (!rank[r] || !rank[r].has(p)) {
      free.push(p);
      continue;
    }
    const cur = held[r];
    if (cur === undefined) held[r] = p;
    else if (rank[r].get(p) < rank[r].get(cur)) {
      held[r] = p;
      free.push(cur);
    } else free.push(p);
  }
  const matching = Object.fromEntries(Object.entries(held).map(([r, p]) => [p, r]));
  return Object.freeze({ matching, proposals, blockingPairs: blockingPairs(proposers, receivers, matching) });
}
/** Pairs (p, r) who both prefer each other to what the matching gives them. */
export function blockingPairs(proposers, receivers, matching) {
  const partnerOf = new Map(Object.entries(matching).map(([p, r]) => [r, p]));
  const out = [];
  for (const [p, list] of Object.entries(proposers)) {
    const mine = matching[p];
    const limit = mine === undefined ? list.length : list.indexOf(mine);
    for (const r of list.slice(0, limit)) {
      const rl = receivers[r] ?? [];
      if (!rl.includes(p)) continue;
      const cur = partnerOf.get(r);
      if (cur === undefined || rl.indexOf(p) < rl.indexOf(cur)) out.push([p, r]);
    }
  }
  return out;
}

/**
 * The maximum flow from s to t, capacities being the edge weights (exact
 * rationals; an undirected edge carries flow either way). Edmonds and Karp:
 * shortest augmenting paths, so it ends even with irrational-looking
 * fractions. The certificate is the cut: the vertices still reachable from s
 * in the residual graph, whose outgoing capacity equals the flow.
 *   { value, flow: [{ from, to, amount }], cut: { source: S, sink: T, edges, capacity }, check() }
 */
export function maxFlow(g, s, t) {
  if (!(g instanceof Graph)) g = graph(g);
  const vs = g.vertices();
  const at = new Map(vs.map((v, i) => [v, i]));
  const S = at.get(vertexLabel(s));
  const T = at.get(vertexLabel(t));
  if (S === undefined || T === undefined) refuse("bad-argument", "the source and sink must be vertices");
  if (S === T) refuse("bad-argument", "the source and sink are different vertices");
  // residual arcs
  const arcs = []; // { to, cap, rev, edge, forward }
  const out = vs.map(() => []);
  const addArc = (i, j, cap, edge) => {
    out[i].push(arcs.length);
    arcs.push({ from: i, to: j, cap, edge, rev: arcs.length + 1 });
    out[j].push(arcs.length);
    arcs.push({ from: j, to: i, cap: g.directed ? ZERO : cap, edge, rev: arcs.length - 1 });
  };
  for (const e of g.edges()) {
    if (e.weight.numerator < 0n) refuse("bad-argument", "capacities are not negative");
    if (e.from === e.to) continue;
    addArc(at.get(e.from), at.get(e.to), e.weight, e);
  }
  const caps = arcs.map((a) => a.cap);
  let value = ZERO;
  let augmentations = 0;
  for (;;) {
    const prev = new Array(vs.length).fill(-1);
    prev[S] = -2;
    const q = [S];
    for (let h = 0; h < q.length && prev[T] === -1; h++) {
      for (const a of out[q[h]]) {
        const arc = arcs[a];
        if (prev[arc.to] === -1 && arc.cap.numerator > 0n) {
          prev[arc.to] = a;
          q.push(arc.to);
        }
      }
    }
    if (prev[T] === -1) break;
    let bottleneck = null;
    for (let v = T; v !== S; v = arcs[prev[v]].from) if (!bottleneck || arcs[prev[v]].cap.lessThan(bottleneck)) bottleneck = arcs[prev[v]].cap;
    for (let v = T; v !== S; v = arcs[prev[v]].from) {
      const a = arcs[prev[v]];
      a.cap = a.cap.subtract(bottleneck);
      arcs[a.rev].cap = arcs[a.rev].cap.add(bottleneck);
    }
    value = value.add(bottleneck);
    augmentations++;
  }
  // the cut
  const reach = new Array(vs.length).fill(false);
  reach[S] = true;
  const q = [S];
  for (let h = 0; h < q.length; h++) for (const a of out[q[h]]) if (!reach[arcs[a].to] && arcs[a].cap.numerator > 0n) {
    reach[arcs[a].to] = true;
    q.push(arcs[a].to);
  }
  const flow = [];
  for (let a = 0; a < arcs.length; a += 2) {
    const net = caps[a].subtract(arcs[a].cap); // flow along the edge's direction (may be negative when undirected)
    if (net.numerator > 0n) flow.push({ from: vs[arcs[a].from], to: vs[arcs[a].to], amount: net });
    else if (net.numerator < 0n) flow.push({ from: vs[arcs[a].to], to: vs[arcs[a].from], amount: net.negate() });
  }
  const cutEdges = [];
  let capacity = ZERO;
  for (const e of g.edges()) {
    const i = at.get(e.from);
    const j = at.get(e.to);
    if (reach[i] && !reach[j]) {
      cutEdges.push({ from: e.from, to: e.to, capacity: e.weight });
      capacity = capacity.add(e.weight);
    } else if (!g.directed && reach[j] && !reach[i]) {
      cutEdges.push({ from: e.to, to: e.from, capacity: e.weight });
      capacity = capacity.add(e.weight);
    }
  }
  if (!capacity.equals(value)) throw new Error("internal: the cut does not match the flow");
  const cut = Object.freeze({ source: vs.filter((_, i) => reach[i]), sink: vs.filter((_, i) => !reach[i]), edges: cutEdges, capacity });
  return Object.freeze({ value, flow, cut, augmentations, check: () => checkFlow(g, s, t, flow, cut) });
}

/**
 * Check a flow and a cut with arithmetic only: capacities respected, flow
 * conserved at every vertex but s and t, the cut separates s from t, and the
 * flow's value equals the cut's capacity. { ok, value, capacity, errors }.
 */
export function checkFlow(g, s, t, flow, cut) {
  const errors = [];
  const src = vertexLabel(s);
  const snk = vertexLabel(t);
  const net = new Map(g.vertices().map((v) => [v, ZERO]));
  // capacity on each directed pair (undirected edges count both ways)
  const capOf = new Map();
  const key = (u, v) => `${String(u)}\u0000${String(v)}`;
  for (const e of g.edges()) {
    capOf.set(key(e.from, e.to), (capOf.get(key(e.from, e.to)) ?? ZERO).add(e.weight));
    if (!g.directed) capOf.set(key(e.to, e.from), (capOf.get(key(e.to, e.from)) ?? ZERO).add(e.weight));
  }
  const used = new Map();
  for (const { from, to, amount } of flow) {
    if (amount.numerator < 0n) errors.push(`negative flow ${from}→${to}`);
    used.set(key(from, to), (used.get(key(from, to)) ?? ZERO).add(amount));
    net.set(from, net.get(from).subtract(amount));
    net.set(to, net.get(to).add(amount));
  }
  for (const [k, a] of used) if (a.greaterThan(capOf.get(k) ?? ZERO)) errors.push(`flow ${a} exceeds the capacity on ${k.replace("\u0000", "→")}`);
  for (const [v, x] of net) if (v !== src && v !== snk && x.numerator !== 0n) errors.push(`flow is not conserved at ${v}`);
  const value = net.get(snk);
  const S = new Set(cut.source.map(vertexLabel));
  if (!S.has(src) || S.has(snk)) errors.push("the cut does not separate s from t");
  let capacity = ZERO;
  for (const e of g.edges()) {
    if (S.has(e.from) && !S.has(e.to)) capacity = capacity.add(e.weight);
    else if (!g.directed && S.has(e.to) && !S.has(e.from)) capacity = capacity.add(e.weight);
  }
  if (!capacity.equals(value)) errors.push(`the flow is ${value} but the cut's capacity is ${capacity}`);
  return { ok: errors.length === 0, value, capacity, errors };
}
