# Changelog

## 0.2.0

Phase 2 of the roadmap: graphs.

- `Graph`, `graph`, `digraph`: directed and undirected graphs, multigraphs and
  loops on request, built from text (`"a-b b-c:3/2"`), edge lists or adjacency
  objects. Weights are exact Rationals. Complements, subgraphs, line graphs,
  reverses, four products, joins and unions.
- Families: complete, empty, path, cycle, star, wheel, complete multipartite,
  Turán, hypercube, grid, circulant, Kneser, Petersen, the Platonic solids,
  directed ones, and G(n, p) / G(n, m) random graphs from the seeded generator.
- Searching and connectivity: `bfs`, `dfs`, components, bridges, cut vertices
  and blocks, strong components and the condensation, `topologicalOrder` (or
  a cycle), `bipartition` (or an odd cycle), distances, diameter, radius,
  centre, girth with a shortest cycle.
- Paths: `shortestPath(s)` by breadth-first search, Dijkstra or Bellman–Ford
  with exact distances and negative cycles reported as the reason;
  `allPairsShortestPaths` (Floyd–Warshall).
- Tours: `eulerTour` (Hierholzer) with the odd or unbalanced vertices when
  none exists; `hamiltonCycle` and `hamiltonPath` by exhaustive search up to
  20 vertices.
- Trees: `minimumSpanningTree` (Kruskal or Prim), `spanningTreeCount` (the
  matrix-tree theorem with exact Bareiss determinants), Prüfer codes,
  `labelledTrees(n)` as a Family of n^(n−2), `randomTree`.
- Tests compare every algorithm with brute force on hundreds of small random graphs.
- Docs pages for graphs, connectivity, shortest paths, Euler and Hamilton, and
  trees; a graph panel on the Explore page.

## 0.1.0

Phase 1 of the roadmap: counting, enumeration with ranking, and the seeded generator.

- Counting functions with BigInt results: factorials, binomial and multinomial
  coefficients, Stirling numbers of both kinds, Bell, Catalan, Fibonacci, Lucas
  and Eulerian numbers, surjections, derangements, partitions and compositions.
- `inclusionExclusion` on sets, `sieve` for intersections given by a rule,
  `pigeonhole` and `collision`.
- `Family`: permutations, derangements, combinations, multisets, subsets,
  words, products, compositions, partitions, set partitions and Dyck words,
  each with `count`, `unrank`, `rank`, `has`, `random`, `slice` and iteration.
- `rng(seed)`: a seeded generator (xoshiro128**) with exactly uniform whole
  numbers of any size and exact-fraction probabilities, the same on every machine.
- Docs pages for counting, inclusion and exclusion, enumeration and the generator.
