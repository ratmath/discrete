import { expect, test } from "bun:test";
import { Rational } from "@ratmath/core";
import {
  graph, digraph, petersen, complete, completeBipartite, cycleGraph, pathGraph, star, wheel, hypercube, grid, platonic, kneser,
  randomGraph, Random, spanningTreeCount, directedCycle,
  maximumMatching, checkMatching, bipartiteMatching, assignment, stableMatching, blockingPairs, maxFlow, checkFlow,
  isProperColouring, greedyColouring, maximumClique, maximalCliques, maximumIndependentSet, chromaticNumber, chromaticPolynomial,
  planarity, isPlanar, checkKuratowski, isomorphism, isIsomorphic, automorphisms,
  adjacency, laplacian, characteristicPolynomial, spectrum, walks, spanningTreesFromSpectrum,
} from "../index.js";

const randomGraphs = (count, n, p, seed) => {
  const r = new Random(seed);
  return Array.from({ length: count }, () => randomGraph(n, p, r));
};
const edgeList = (g) => g.edges().map((e) => [e.from, e.to]);

function bruteMatching(g) {
  const es = edgeList(g);
  let best = 0;
  const go = (i, used, k) => {
    if (k + (es.length - i) <= best) return;
    if (i === es.length) return void (best = Math.max(best, k));
    const [a, b] = es[i];
    if (a !== b && !used.has(a) && !used.has(b)) {
      used.add(a).add(b);
      go(i + 1, used, k + 1);
      used.delete(a);
      used.delete(b);
    }
    go(i + 1, used, k);
  };
  go(0, new Set(), 0);
  return best;
}

test("maximum matching against brute force, with a Tutte–Berge certificate", () => {
  for (const g of [...randomGraphs(25, 9, "2/5", 1), petersen(), star(5), cycleGraph(7)]) {
    const m = maximumMatching(g);
    expect(m.size).toBe(bruteMatching(g));
    expect(m.certificate.bound).toBe(m.size);
    expect(m.check().ok).toBe(true);
  }
  expect(maximumMatching(petersen()).perfect).toBe(true);
  expect(checkMatching(pathGraph(4), [[1, 2], [2, 3]], []).ok).toBe(false);
});

test("bipartite matching: König's cover has the matching's size, Hall's violator is real", () => {
  const b = graph("a-x a-y b-x c-x");
  const r = bipartiteMatching(b, { left: ["a", "b", "c"] });
  expect(r.size).toBe(2);
  expect(r.cover.length).toBe(2);
  for (const [u, v] of edgeList(b)) expect(r.cover.includes(u) || r.cover.includes(v)).toBe(true);
  expect(r.hall.neighbours.length).toBeLessThan(r.hall.set.length);
  const k = bipartiteMatching(completeBipartite(3, 4));
  expect(k.size).toBe(3);
});

test("assignment problem against all permutations", () => {
  const C = [[4, 1, 3, 7], [2, 0, 5, 2], [3, 2, 2, 6], [1, 5, 4, 3]];
  const perms = (n) => (n === 0 ? [[]] : perms(n - 1).flatMap((p) => Array.from({ length: n }, (_, i) => [...p.slice(0, i), n - 1, ...p.slice(i)])));
  const costs = perms(4).map((p) => p.reduce((s, j, i) => s + C[i][j], 0));
  const r = assignment(C);
  expect(String(r.cost)).toBe(String(Math.min(...costs)));
  expect(r.check().ok).toBe(true);
  expect(String(assignment(C, { maximize: true }).cost)).toBe(String(Math.max(...costs)));
});

test("stable matching has no blocking pair", () => {
  const men = { a: ["x", "y", "z"], b: ["y", "x", "z"], c: ["x", "y", "z"] };
  const women = { x: ["b", "a", "c"], y: ["a", "b", "c"], z: ["a", "b", "c"] };
  const s = stableMatching(men, women);
  expect(blockingPairs(men, women, s.matching ?? s).length).toBe(0);
});

test("max flow equals min cut, exactly, with fractional capacities", () => {
  const f = digraph("s>a:3 s>b:2 a>b:1 a>t:2 b>t:3");
  const fl = maxFlow(f, "s", "t");
  expect(String(fl.value)).toBe("5");
  expect(fl.check().ok).toBe(true);
  const u = graph("s-a:1/2 a-t:1/3 s-t:1");
  const fu = maxFlow(u, "s", "t");
  expect(String(fu.value)).toBe("4/3");
  expect(checkFlow(u, "s", "t", fu.flow, fu.cut).ok).toBe(true);
  // unit capacities: max flow = edge connectivity, e.g. 3 in the Petersen graph
  const P = petersen();
  expect(String(maxFlow(P, P.vertices()[0], P.vertices()[7]).value)).toBe("3");
});

function bruteColourings(g, k) {
  const vs = g.vertices();
  const es = edgeList(g).map(([a, b]) => [vs.indexOf(a), vs.indexOf(b)]);
  const col = [];
  let c = 0;
  const go = (i) => {
    if (i === vs.length) return void c++;
    for (let x = 0; x < k; x++) {
      col[i] = x;
      if (es.every(([a, b]) => a > i || b > i || col[a] !== col[b])) go(i + 1);
    }
  };
  go(0);
  return c;
}

test("chromatic polynomial against counting colourings directly", () => {
  for (const g of [...randomGraphs(8, 7, "1/2", 2), wheel(6), cycleGraph(5)]) {
    const P = chromaticPolynomial(g);
    for (const k of [1, 2, 3, 4]) expect(String(P.at(k))).toBe(String(bruteColourings(g, k)));
  }
  expect(String(chromaticPolynomial(petersen()).at(3))).toBe("120");
});

test("chromatic number with a lower-bound witness", () => {
  expect(chromaticNumber(petersen()).number).toBe(3);
  expect(chromaticNumber(cycleGraph(5)).number).toBe(3);
  expect(chromaticNumber(complete(5)).number).toBe(5);
  expect(chromaticNumber(wheel(5)).number).toBe(4);
  expect(chromaticNumber(wheel(6)).number).toBe(3);
  for (const g of randomGraphs(8, 8, "1/2", 3)) {
    const r = chromaticNumber(g);
    expect(isProperColouring(g, r.colouring).ok).toBe(true);
    let k = 1;
    while (bruteColourings(g, k) === 0) k++;
    expect(r.number).toBe(k);
    const greedy = greedyColouring(g);
    expect(isProperColouring(g, greedy).ok).toBe(true);
    expect(new Set(greedy.values()).size).toBeGreaterThanOrEqual(k);
  }
});

test("cliques and independent sets", () => {
  expect(maximumClique(complete(5)).length).toBe(5);
  expect(maximumIndependentSet(petersen()).length).toBe(4);
  expect(maximalCliques(graph("a-b b-c c-a c-d")).length).toBe(2);
});

test("planarity: Euler's formula for the faces, Kuratowski subgraphs that check", () => {
  for (const g of [complete(4), hypercube(3), grid(4, 4), wheel(7), platonic("dodecahedron"), platonic("icosahedron"), pathGraph(5)]) {
    const r = planarity(g);
    expect(r.planar).toBe(true);
    // faces are listed per block; these graphs other than the path are 2-connected
    if (g.vertices().length !== 5) expect(g.vertices().length - g.edges().length + r.faces[0].length).toBe(2);
  }
  for (const [g, kind] of [[complete(5), "K5"], [completeBipartite(3, 3), "K3,3"], [petersen(), null], [hypercube(4), null], [complete(6), null]]) {
    const r = planarity(g);
    expect(r.planar).toBe(false);
    if (kind) expect(r.kuratowski.kind).toBe(kind);
    expect(checkKuratowski(g, r.kuratowski).ok).toBe(true);
  }
  expect(isPlanar(completeBipartite(2, 5))).toBe(true);
});

test("isomorphism finds the map under random relabelling and says why not otherwise", () => {
  const r = new Random(7);
  for (const g of randomGraphs(10, 8, "1/2", 4)) {
    const vs = g.vertices();
    const perm = vs.slice();
    for (let i = perm.length - 1; i > 0; i--) {
      const j = r.int(i + 1);
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    const name = new Map(vs.map((v, i) => [v, `v${perm[i]}`]));
    const h = graph(edgeList(g).map(([a, b]) => `${name.get(a)}-${name.get(b)}`).join(" "));
    vs.forEach((v) => h.addVertex(name.get(v)));
    const res = isomorphism(g, h);
    expect(res.isomorphic).toBe(true);
    for (const [a, b] of edgeList(g)) expect(h.hasEdge(res.map.get(a), res.map.get(b))).toBe(true);
  }
  expect(isIsomorphic(petersen(), kneser(5, 2))).toBe(true);
  expect(isomorphism(cycleGraph(6), graph("a-b b-c c-a d-e e-f f-d")).isomorphic).toBe(false);
  expect(isomorphism(pathGraph(4), star(3)).reason).toContain("degree");
});

test("automorphism groups: orders of well-known graphs", () => {
  const want = [[petersen(), 120n], [hypercube(3), 48n], [complete(5), 120n], [cycleGraph(6), 12n], [pathGraph(4), 2n], [platonic("dodecahedron"), 120n], [hypercube(4), 384n]];
  for (const [g, n] of want) {
    const a = automorphisms(g);
    expect(a.order).toBe(n);
    if (a.group) expect(BigInt(a.group.order)).toBe(n);
  }
  // the Frucht graph is 3-regular with only the identity
  const frucht = graph("0-1 1-2 2-3 3-4 4-5 5-6 6-0 0-7 1-7 2-8 3-9 4-9 5-10 6-10 7-11 8-11 8-9 10-11");
  expect(automorphisms(frucht).order).toBe(1n);
  expect(automorphisms(petersen()).orbits.length).toBe(1);
});

test("spectra: characteristic polynomials, walks, and trees by two methods", () => {
  const s = spectrum(petersen());
  expect(s.toString()).toBe("−2 (×4), 1 (×5), 3");
  expect(spectrum(hypercube(3)).toString()).toBe("−3, −1 (×3), 1 (×3), 3");
  expect(characteristicPolynomial([[0, 1], [1, 0]]).map(String)).toEqual(["-1", "0", "1"]);
  for (const g of [petersen(), cycleGraph(5), completeBipartite(3, 3), platonic("dodecahedron"), ...randomGraphs(6, 7, "1/2", 5)]) {
    expect(spanningTreesFromSpectrum(g)).toBe(BigInt(spanningTreeCount(g)));
  }
  // closed walks of length k = trace of A^k = Σ λ^k
  expect(walks(cycleGraph(5), 5).closed).toBe(10n);
  expect(walks(petersen(), 2).closed).toBe(30n);
  const L = laplacian(cycleGraph(4)).matrix;
  expect(L.map((r) => r.reduce((a, b) => a + b, 0n))).toEqual([0n, 0n, 0n, 0n]);
  expect(adjacency(pathGraph(3)).matrix[1].map(String)).toEqual(["1", "0", "1"]);
  expect(spectrum(directedCycle(4)).eigenvalues.length).toBe(4);
});
