// Graphs, checked against brute force on many small random graphs: every
// algorithm here is compared with a slow method that is obviously right.
import { describe, expect, test } from "bun:test";
import { Rational } from "@ratmath/core";
import * as D from "../index.js";

const R = (x) => new Rational(x);
const g0 = D.rng("graph tests");
const randomGraphs = (count, label, { n = [3, 7], p = "2/5", directed = false, weights = null, multi = false } = {}) => {
  const r = g0.fork(label);
  return Array.from({ length: count }, () => {
    const size = r.between(n[0], n[1]);
    const g = D.randomGraph(size, p, r, { directed });
    if (multi && g.size) {
      const h = g.copy({ multi: true });
      const e = r.pick(g.edges());
      h.addEdge(e.from, e.to);
      return h;
    }
    if (!weights) return g;
    const h = new D.Graph({ directed });
    h.addVertex(...g.vertices());
    for (const e of g.edges()) h.addEdge(e.from, e.to, weights(r));
    return h;
  });
};

// ---- brute-force references ----
const ufComponents = (g) => {
  const p = new Map(g.vertices().map((v) => [v, v]));
  const f = (x) => (p.get(x) === x ? x : f(p.get(x)));
  for (const e of g.edges()) p.set(f(e.from), f(e.to));
  return new Set(g.vertices().map(f)).size;
};
const reach = (g, s) => {
  const seen = new Set([s]);
  const st = [s];
  while (st.length) for (const w of g.neighbors(st.pop())) if (!seen.has(w)) seen.add(w), st.push(w);
  return seen;
};
function* simplePaths(g, s, t, path = [s], seen = new Set([s])) {
  if (s === t) {
    yield path;
    return;
  }
  for (const e of g.outEdges(s)) {
    if (seen.has(e.to)) continue;
    seen.add(e.to);
    yield* simplePaths(g, e.to, t, [...path, e.to], seen);
    seen.delete(e.to);
  }
}
const pathWeight = (g, p) => p.slice(1).reduce((s, v, i) => s.add(g.weight(p[i], v)), R(0n));
const perms = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
const subsetsOf = (a, k) => (k === 0 ? [[]] : a.length < k ? [] : [...subsetsOf(a.slice(1), k - 1).map((s) => [a[0], ...s]), ...subsetsOf(a.slice(1), k)]);

describe("structure", () => {
  test("building from text, lists and adjacency", () => {
    const g = D.graph("a-b b-c-d d:7 e");
    expect(g.order).toBe(5);
    expect(g.size).toBe(3);
    expect(g.hasEdge("c", "b")).toBe(true);
    expect(D.graph([[1, 2], [2, 3, "1/2"]]).weight(3, 2).toString()).toBe("1/2");
    const h = D.graph({ a: ["b", "c"], b: ["a", "c"], c: ["a"] });
    expect(h.size).toBe(3);
    const d = D.digraph("1>2 2->3 3>1");
    expect(d.hasEdge(1, 2)).toBe(true);
    expect(d.hasEdge(2, 1)).toBe(false);
    expect(d.inNeighbors(1)).toEqual([3]);
    expect(() => D.graph("a>b")).toThrow(/digraph/);
    expect(() => D.graph("a-a")).toThrow(/loops/);
    expect(() => D.graph("a-b a-b")).toThrow(/multi/);
    expect(D.graph("a-b a-b", { multi: true }).size).toBe(2);
    expect(D.graph("a-a", { loops: true }).degree("a")).toBe(2);
    expect(() => D.graph([[1, 2, 0.5]])).toThrow(/exact/);
    expect(D.graph("1-2 2-3").toString()).toBe("1-2 2-3");
    expect(D.graph("x-y:3/2").toString()).toBe("x-y:3/2");
    // the text form reads back to the same graph, for every family's vertex names
    for (const g of [D.petersen(), D.grid(2, 3), D.hypercube(3), D.complete(4).lineGraph(), D.join(D.complete(2), D.cycleGraph(3)), D.cartesianProduct(D.pathGraph(2), D.star(2)), D.graph("a-b:1/2 c")]) {
      expect(String(D.graph(String(g)))).toBe(String(g));
    }
  });
  test("handshake lemma and degree sequences", () => {
    for (const g of randomGraphs(40, "hand")) {
      expect(g.vertices().reduce((s, v) => s + g.degree(v), 0)).toBe(2 * g.size);
    }
    for (const g of randomGraphs(20, "hand-d", { directed: true })) {
      const outs = g.vertices().reduce((s, v) => s + g.outDegree(v), 0);
      const ins = g.vertices().reduce((s, v) => s + g.inDegree(v), 0);
      expect(outs).toBe(g.size);
      expect(ins).toBe(g.size);
    }
  });
  test("families have the right sizes", () => {
    expect([D.complete(7).size, D.cycleGraph(9).size, D.pathGraph(9).size, D.star(5).size, D.wheel(6).size]).toEqual([21, 9, 8, 5, 12]);
    expect(D.completeBipartite(3, 4).size).toBe(12);
    expect(D.turan(10, 3).size).toBe(33);
    expect(D.hypercube(4).size).toBe(32);
    expect(D.grid(3, 4).size).toBe(17);
    expect(D.petersen().degreeSequence()).toEqual(Array(10).fill(3));
    expect(D.kneser(7, 3).order).toBe(35);
    const solids = ["tetrahedron", "cube", "octahedron", "dodecahedron", "icosahedron"].map((s) => D.platonic(s));
    expect(solids.map((g) => [g.order, g.size])).toEqual([[4, 6], [8, 12], [6, 12], [20, 30], [12, 30]]);
    expect(solids.map((g) => new Set(g.degreeSequence()).size)).toEqual([1, 1, 1, 1, 1]);
    expect(D.circulant(8, [1, 3]).degreeSequence()).toEqual(Array(8).fill(4));
    expect(D.completeDigraph(4).size).toBe(12);
  });
  test("complement, line graph, products", () => {
    for (const g of randomGraphs(20, "comp")) {
      const c = g.complement();
      expect(g.size + c.size).toBe((g.order * (g.order - 1)) / 2);
      // the line graph has Σ C(d, 2) edges
      const L = g.lineGraph();
      expect(L.order).toBe(g.size);
      expect(L.size).toBe(g.vertices().reduce((s, v) => s + (g.degree(v) * (g.degree(v) - 1)) / 2, 0));
    }
    const k2 = D.complete(2);
    // Q3 is K2 □ K2 □ K2
    const q3 = D.cartesianProduct(D.cartesianProduct(k2, k2), k2);
    expect([q3.order, q3.size]).toEqual([8, 12]);
    expect(D.cartesianProduct(D.pathGraph(3), D.pathGraph(4)).size).toBe(D.grid(3, 4).size);
    expect(D.tensorProduct(D.complete(3), D.complete(2)).size).toBe(6); // the 6-cycle
    expect(D.strongProduct(D.complete(2), D.complete(2)).size).toBe(6); // K4
    expect(D.join(D.emptyGraph(3), D.emptyGraph(4)).size).toBe(12);
    expect(D.disjointUnion(D.complete(3), D.complete(3)).size).toBe(6);
  });
});

describe("traversal and connectivity, against brute force", () => {
  test("components", () => {
    for (const g of randomGraphs(80, "cc", { n: [1, 9], p: "1/4" })) {
      expect(D.components(g).length).toBe(ufComponents(g));
      expect(D.components(g).flat().length).toBe(g.order);
    }
  });
  test("bridges and cut vertices", () => {
    for (const g of [...randomGraphs(80, "br", { n: [2, 8], p: "2/5" }), ...randomGraphs(20, "brm", { multi: true })]) {
      const base = ufComponents(g);
      const bridges = new Set(D.bridges(g).map((e) => e.id));
      for (const e of g.edges()) {
        const h = g.copy();
        h.removeEdge(h.edges().find((x) => x.id === e.id));
        expect(bridges.has(e.id)).toBe(ufComponents(h) > base);
      }
      const cut = new Set(D.cutVertices(g));
      for (const v of g.vertices()) {
        const h = g.copy();
        h.removeVertex(v);
        const isolated = g.degree(v) === 0 ? 1 : 0;
        expect(cut.has(v)).toBe(ufComponents(h) > base - isolated);
      }
      // the blocks cover every edge exactly once
      const blocks = D.blocks(g);
      let covered = 0;
      for (const b of blocks) covered += g.subgraph(b).size;
      expect(covered).toBe(g.size);
    }
  });
  test("strong components and topological order", () => {
    for (const g of randomGraphs(60, "scc", { n: [1, 8], p: "1/4", directed: true })) {
      const comps = D.stronglyConnectedComponents(g);
      const id = new Map();
      comps.forEach((c, k) => c.forEach((v) => id.set(v, k)));
      const R_ = new Map(g.vertices().map((v) => [v, reach(g, v)]));
      for (const u of g.vertices()) for (const v of g.vertices()) expect(id.get(u) === id.get(v)).toBe(R_.get(u).has(v) && R_.get(v).has(u));
      const t = D.topologicalOrder(g);
      expect(t.acyclic).toBe(comps.length === g.order && g.edges().every((e) => e.from !== e.to));
      if (t.acyclic) {
        const pos = new Map(t.order.map((v, i) => [v, i]));
        for (const e of g.edges()) expect(pos.get(e.from)).toBeLessThan(pos.get(e.to));
      } else {
        const c = t.cycle;
        expect(c[0]).toBe(c.at(-1));
        for (let i = 0; i + 1 < c.length; i++) expect(g.hasEdge(c[i], c[i + 1])).toBe(true);
      }
      const { graph: dag } = D.condensation(g);
      expect(D.topologicalOrder(dag).acyclic).toBe(true);
    }
  });
  test("bipartite, with an odd cycle as the certificate", () => {
    for (const g of randomGraphs(60, "bip", { n: [1, 8], p: "1/3" })) {
      const vs = g.vertices();
      let brute = false;
      for (let m = 0; m < 2 ** vs.length && !brute; m++) {
        const side = (v) => (m >> vs.indexOf(v)) & 1;
        brute = g.edges().every((e) => side(e.from) !== side(e.to));
      }
      const b = D.bipartition(g);
      expect(b.bipartite).toBe(brute);
      if (!b.bipartite) {
        const c = b.oddCycle;
        expect(c[0]).toBe(c.at(-1));
        expect((c.length - 1) % 2).toBe(1);
        for (let i = 0; i + 1 < c.length; i++) expect(g.hasEdge(c[i], c[i + 1])).toBe(true);
      }
    }
  });
  test("girth, diameter, centre", () => {
    for (const g of randomGraphs(40, "girth", { n: [3, 7], p: "1/2" })) {
      // brute: the shortest closed walk with distinct vertices
      let best = Infinity;
      for (const s of g.vertices()) {
        for (const t of g.neighbors(s)) {
          const h = g.copy();
          h.removeEdge(s, t);
          const d = D.distance(h, s, t);
          if (d + 1 < best) best = d + 1;
        }
      }
      const r = D.girth(g);
      expect(r.girth).toBe(best);
      if (r.cycle) {
        expect(r.cycle.length - 1).toBe(best);
        expect(new Set(r.cycle.slice(1)).size).toBe(best);
        for (let i = 0; i + 1 < r.cycle.length; i++) expect(g.hasEdge(r.cycle[i], r.cycle[i + 1])).toBe(true);
      }
      if (D.isConnected(g)) {
        const ap = D.allPairsShortestPaths(g, { weighted: false });
        const ds = ap.matrix.flat().map((x) => Number(x.numerator));
        expect(D.diameter(g)).toBe(Math.max(...ds));
      }
    }
    expect(D.girth(D.petersen()).girth).toBe(5);
    expect(D.girth(D.platonic("dodecahedron")).girth).toBe(5);
    expect(D.girth(D.digraph("1>2 2>3 3>4 4>1 1>3")).girth).toBe(3);
    expect(D.diameter(D.petersen())).toBe(2);
    expect(D.center(D.pathGraph(5))).toEqual([3]);
  });
});

describe("shortest paths, against every simple path", () => {
  const w = (r) => `${r.between(1, 9)}/${r.between(1, 4)}`;
  test("Dijkstra, Bellman–Ford and Floyd–Warshall agree with brute force", () => {
    for (const g of [...randomGraphs(30, "sp", { weights: w }), ...randomGraphs(30, "spd", { directed: true, weights: w })]) {
      const vs = g.vertices();
      const ap = D.allPairsShortestPaths(g);
      for (const s of vs) {
        const sp = D.shortestPaths(g, s);
        for (const t of vs) {
          let best = null;
          for (const p of simplePaths(g, s, t)) {
            const pw = pathWeight(g, p);
            if (best === null || pw.lessThan(best)) best = pw;
          }
          const got = sp.pathTo(t);
          if (best === null) {
            expect(got).toBe(null);
            expect(ap.distance(s, t)).toBe(null);
          } else {
            expect(got.distance.equals(best)).toBe(true);
            expect(pathWeight(g, got.path).equals(best)).toBe(true);
            expect(ap.distance(s, t).equals(best)).toBe(true);
            expect(pathWeight(g, ap.path(s, t)).equals(best)).toBe(true);
          }
        }
      }
    }
  });
  test("negative weights: Bellman–Ford, and negative cycles as the reason", () => {
    const r = g0.fork("neg");
    for (let k = 0; k < 30; k++) {
      const g = randomGraphs(1, `neg${k}`, { directed: true, weights: (q) => String(q.between(-2, 6)) })[0];
      const s = g.vertices()[0];
      const sp = D.shortestPaths(g, s);
      if (sp.negativeCycle) {
        const c = sp.negativeCycle;
        expect(c[0]).toBe(c.at(-1));
        expect(pathWeight(g, c).lessThan(R(0n))).toBe(true);
        expect(() => D.shortestPath(g, s, s)).toThrow(/negative/);
        continue;
      }
      expect(sp.method).toBe(g.edges().some((e) => e.weight.lessThan(R(0n))) ? "bellman-ford" : "dijkstra");
      for (const t of g.vertices()) {
        let best = null;
        for (const p of simplePaths(g, s, t)) {
          const pw = pathWeight(g, p);
          if (best === null || pw.lessThan(best)) best = pw;
        }
        const got = sp.pathTo(t);
        expect(got === null).toBe(best === null);
        if (got) expect(got.distance.equals(best)).toBe(true);
      }
    }
    void r;
    expect(D.shortestPaths(D.graph("a-b:-1"), "a").negativeCycle).toEqual(["a", "b", "a"]);
  });
  test("exact sums", () => {
    const g = D.graph("s-a:1/3 a-b:1/3 b-t:1/3 s-t:0.999999");
    const p = D.shortestPath(g, "s", "t");
    expect(p.path).toEqual(["s", "t"]);
    const h = D.graph("s-a:1/3 a-b:1/3 b-t:1/3 s-t:1.000001");
    expect(D.shortestPath(h, "s", "t").distance.toString()).toBe("1");
  });
});

describe("Euler and Hamilton, against exhaustive search", () => {
  const bruteEuler = (g, closed) => {
    const es = g.edges();
    const used = new Set();
    const go = (v, start) => {
      if (used.size === es.length) return !closed || v === start;
      for (const e of g.outEdges(v)) {
        if (used.has(e.id)) continue;
        used.add(e.id);
        if (go(e.to, start)) return true;
        used.delete(e.id);
      }
      return false;
    };
    return g.vertices().some((v) => go(v, v));
  };
  const checkTour = (g, t) => {
    expect(t.edges.length).toBe(g.size);
    expect(new Set(t.edges.map((e) => e.id)).size).toBe(g.size);
    t.edges.forEach((e, i) => {
      expect(e.from).toBe(t.vertices[i]);
      expect(e.to).toBe(t.vertices[i + 1]);
    });
    if (t.closed) expect(t.vertices[0]).toBe(t.vertices.at(-1));
  };
  test("Euler tours", () => {
    const gs = [...randomGraphs(40, "eu", { n: [2, 6], p: "1/2" }), ...randomGraphs(20, "eud", { n: [2, 5], p: "1/2", directed: true }), ...randomGraphs(15, "eum", { n: [2, 5], p: "1/2", multi: true })];
    for (const g of gs.filter((x) => x.size <= 9)) {
      for (const closed of [false, true]) {
        const t = D.eulerTour(g, { closed });
        expect(t.exists).toBe(g.size === 0 || bruteEuler(g, closed));
        if (t.exists && g.size) checkTour(g, t);
      }
    }
    expect(D.eulerTour(D.complete(5)).closed).toBe(true);
    expect(D.eulerTour(D.platonic("cube")).odd.length).toBe(8);
    // the bridges of Königsberg
    const k = D.graph("A-B A-B A-C A-C A-D B-D C-D", { multi: true });
    expect(D.eulerTour(k).exists).toBe(false);
    expect(D.eulerTour(k).odd).toEqual(["A", "B", "C", "D"]);
  });
  test("Hamilton cycles and paths", () => {
    const gs = [...randomGraphs(60, "ham", { n: [1, 7], p: "1/2" }), ...randomGraphs(30, "hamd", { n: [2, 6], p: "1/2", directed: true })];
    for (const g of gs) {
      const vs = g.vertices();
      const ps = perms(vs);
      const okPath = (p) => p.every((v, i) => i === 0 || g.hasEdge(p[i - 1], v));
      const bruteCycle = (g.directed ? vs.length >= 2 : vs.length >= 3) && ps.some((p) => okPath(p) && g.hasEdge(p.at(-1), p[0]));
      const brutePath = ps.some(okPath);
      const c = D.hamiltonCycle(g);
      expect(c.exists).toBe(bruteCycle);
      if (c.exists) {
        expect(new Set(c.cycle.slice(1)).size).toBe(vs.length);
        expect(okPath(c.cycle)).toBe(true);
      }
      const p = D.hamiltonPath(g);
      expect(p.exists).toBe(brutePath);
      if (p.exists) expect(okPath(p.path) && new Set(p.path).size === vs.length).toBe(true);
    }
    expect(D.hamiltonCycle(D.petersen()).exists).toBe(false);
    expect(D.hamiltonCycle(D.platonic("dodecahedron")).exists).toBe(true);
    expect(D.hamiltonCycle(D.hypercube(4)).exists).toBe(true);
    expect(D.hamiltonCycle(D.grid(3, 3)).exists).toBe(false);
    expect(() => D.hamiltonCycle(D.complete(21))).toThrow(/20/);
  });
});

describe("trees", () => {
  test("spanning trees: Kruskal, Prim and brute force agree; Kirchhoff counts them", () => {
    const w = (r) => String(r.between(1, 5));
    for (const g of [...randomGraphs(40, "mst", { n: [2, 6], p: "3/5", weights: w }), ...randomGraphs(10, "mstm", { n: [2, 5], p: "3/5", multi: true })]) {
      const n = g.order;
      const ids = g.edges();
      let best = null;
      let count = 0n;
      for (const s of subsetsOf(ids, n - 1)) {
        const t = g.edgeSubgraph(s, { allVertices: true });
        if (!D.isTree(t)) continue;
        count++;
        const tw = s.reduce((a, e) => a.add(e.weight), R(0n));
        if (best === null || tw.lessThan(best)) best = tw;
      }
      expect(D.spanningTreeCount(g)).toBe(count);
      const k = D.minimumSpanningTree(g);
      const p = D.minimumSpanningTree(g, { method: "prim" });
      expect(k.connected).toBe(count > 0n);
      expect(p.weight.equals(k.weight)).toBe(true);
      if (best !== null) {
        expect(k.weight.equals(best)).toBe(true);
        expect(D.isTree(k.tree)).toBe(true);
      } else expect(D.isForest(k.tree)).toBe(true);
    }
    // Cayley, and the cube's 384 spanning trees
    for (let n = 1; n <= 9; n++) expect(D.spanningTreeCount(D.complete(n))).toBe(n === 1 ? 1n : BigInt(n) ** BigInt(n - 2));
    expect(D.spanningTreeCount(D.platonic("cube"))).toBe(384n);
    expect(D.spanningTreeCount(D.petersen())).toBe(2000n);
    expect(D.spanningTreeCount(D.completeBipartite(3, 4))).toBe(3n ** 3n * 4n ** 2n);
  });
  test("Prüfer codes are a bijection", () => {
    const fam = D.labelledTrees(6);
    expect(fam.count).toBe(1296n);
    const seen = new Set();
    for (const t of fam) {
      expect(D.isTree(t)).toBe(true);
      const key = t.edges().map((e) => [e.from, e.to].sort().join("-")).sort().join(" ");
      seen.add(key);
    }
    expect(seen.size).toBe(1296);
    for (let i = 0n; i < fam.count; i += 37n) expect(fam.rank(fam.unrank(i))).toBe(i);
    expect(D.prufer(D.star(4))).toEqual([0, 0, 0]);
    expect(D.prufer(D.pathGraph(5))).toEqual([2, 3, 4]);
    const t = D.fromPrufer(["b", "b", "d"], ["a", "b", "c", "d", "e"]);
    expect(D.prufer(t)).toEqual(["b", "b", "d"]);
    expect(D.labelledTrees(["x", "y", "z"]).count).toBe(3n);
    expect(fam.has(D.cycleGraph(6))).toBe(false);
    const r = D.randomTree(50, "tree seed");
    expect(D.isTree(r)).toBe(true);
    expect(D.randomTree(50, "tree seed").toString()).toBe(r.toString());
  });
  test("random graphs are reproducible", () => {
    expect(D.randomGraph(10, "1/3", 7).toString()).toBe(D.randomGraph(10, "1/3", 7).toString());
    expect(D.randomGraphWithEdges(10, 12, "s").size).toBe(12);
  });
  test("determinant is exact", () => {
    expect(D.determinant([[2, 0, 1], [1, 3, 2], [1, 1, 2]])).toBe(6n);
    expect(D.determinant([[2, 0, 1], [1, 3, 2], [1, 1, 1]])).toBe(0n);
    expect(D.determinant([[0, 1], [1, 0]])).toBe(-1n);
  });
});
