# Changelog

## Unreleased

- `genus(g)` (Course Test roadmap, item B9): the genus of a graph by rotation
  systems, block by block, with a lower bound from Euler's formula and the
  girth and the rotation system of the embedding found. Small blocks are
  searched completely; for larger ones the answer is marked proven only when
  the bounds meet. `embeddingGenus(g, rotation)` traces the faces of a given
  rotation system on its own.

- Optimisation helpers from the Course Test roadmap (batch A8):
  `transportation(supply, demand, cost)` solves the transportation problem as
  an exact LP and returns the shipping table, with a dummy sink or source for
  unbalanced totals; `integerProgram(problem, { binary })` makes variables
  0 or 1, so a knapsack is one call; `coreVertices(game)` lists every vertex
  of the core and says whether it is empty, one point or larger.
- `@ratmath/core` is now a peer dependency (`>=0.10.0 <0.12.0`): the package
  uses the program's own copy of Core instead of bringing its own, so Core 0.11
  works and there is never a second copy whose `Rational` is not the same class.

## 0.3.0

Phases 3, 4, 6, 7 and 8 of the roadmap.

- Generating functions: `PowerSeries` (lazy, exact: products, reciprocals,
  composition, derivative, integral, `exp`, `log`, `sqrt`, rational powers),
  `egf`, `knownSeries`, `RationalSeries`.
- Recurrences: `LinearRecurrence` with companion-matrix terms, generating
  function and an exact closed form from `@ratmath/algebraic` roots, checked
  against the terms; inhomogeneous terms p(n)·bⁿ; `guessRecurrence`
  (Berlekamp–Massey), `closedSum`, `masterTheorem`, `divideAndConquer`.
- Graph theory: `maximumMatching` with a Tutte–Berge certificate,
  `bipartiteMatching` with König and Hall, `assignment`, `stableMatching`,
  `maxFlow` with a minimum cut; `chromaticNumber` with a lower-bound witness,
  `chromaticPolynomial`, cliques; `planarity` with faces or a Kuratowski
  subgraph; `isomorphism`, `automorphisms`; exact `spectrum`, `walks`,
  `spanningTreesFromSpectrum`.
- Games: Sprague–Grundy, `nim`, `subtractionGame`, Conway's `Game` in
  canonical form, `partizanGame`, `backwardInduction`; `cooperativeGame`,
  `shapley`, `core` with a balanced-collection certificate, `weightedVoting`;
  voting methods, `apportion`, `adjustedWinner`.
- Orders: `Relation`, `Poset` (Dilworth, linear extensions, Möbius, lattices),
  divisor, Boolean and partition lattices; `cycleIndex`, `countColourings`,
  `patternInventory`, `symmetry`. Boolean functions re-exported from
  `@ratmath/logic`, which is also available as `logic`.
- Codes and designs: `LinearCode`, `hammingCode`, bounds, `reedSolomon`;
  Latin squares and MOLS; `blockDesign`, finite planes, difference sets,
  Steiner triple systems.
- `@ratmath/algebraic` and `@ratmath/logic` are new dependencies, vendored as
  submodules. The LP constraint-sense type in the typings is now
  `ConstraintSense` (it was `Relation`, which is now the relation class).
- Tests compare with brute force: matchings, colourings, orbit counts,
  assignments, decoding every single error, closed forms against terms.
- Twelve new docs pages, and matchings, colouring, planarity, symmetry and
  spectrum on the Explore page.

## 0.2.0

Phases 2 and 5 of the roadmap: graphs, and exact linear programming with games.

- `linearProgram`: an exact two-phase simplex method with Bland's rule. An
  optimum comes with dual prices, an infeasible problem with a Farkas vector,
  an unbounded one with a feasible point and a ray; `checkLinearProgram`
  checks each by arithmetic on the constraints alone. `integerProgram` by
  branch and bound.
- `matrixGame` and `saddlePoints` for zero-sum games; `bimatrixGame` with
  dominance (pure or mixed), pure equilibria, all equilibria by support
  enumeration, and Lemke–Howson.
- Tests check every optimum by its dual and compare with brute force over
  vertices, integer points and hundreds of random games.
- Docs pages for linear programming, integer programs, matrix games and
  bimatrix games; a game panel on the Explore page.

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
