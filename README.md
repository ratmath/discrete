# @ratmath/discrete

Counting, graphs and games for [RatMath](https://ratmath.com/), part of the
[RatMath Shelf](https://ratmath.com/shelf/).

Exact counts of any size, families of objects you can list, rank and sample,
and a seeded random generator that gives the same numbers on every machine.
Docs: [ratmath.com/discrete](https://ratmath.com/discrete/).

```js
import { binomial, partitionCount, permutations, setPartitions, rng } from "@ratmath/discrete";

binomial(100, 50);                // 100891344545564193334812497256n
partitionCount(1000);             // 24061467864032622473692149727991n

const p = permutations(20);       // nothing is listed until asked for
p.count;                          // 2432902008176640000n
p.unrank(10n ** 18n);             // the permutation at that place
p.rank(p.unrank(10n ** 18n));     // 1000000000000000000n

const r = rng("experiment 3");    // a seed: a whole number of any size, or text
setPartitions(5).random(r);       // a uniformly random set partition
r.bool("2/7");                    // true with probability exactly 2/7

import { graph, shortestPath, bipartition, spanningTreeCount, complete } from "@ratmath/discrete";
const g = graph("a-b:0.1 b-c:0.2 c-d:0.3 a-d:0.6");   // exact weights
shortestPath(g, "a", "d").distance;                     // 3/5, a tie between the two routes
bipartition(graph("1-2 2-3 3-1")).oddCycle;             // the reason it is not bipartite
spanningTreeCount(complete(10));                        // 100000000n (Cayley)
```

## What is built

- **Counting**: `factorial`, `fallingFactorial`, `risingFactorial`, `binomial`,
  `multinomial`, `multichoose`, `stirling1`, `stirling2`, `bell`, `catalan`,
  `fibonacci`, `lucas`, `eulerian`, `surjections`, `derangementCount`,
  `partitionCount`, `compositionCount`, `pascalRow`. Every count is a BigInt.
- **Inclusion and exclusion, pigeonhole**: `inclusionExclusion` on actual sets
  with the alternating sum shown level by level, `sieve` when the
  intersections follow a rule, `pigeonhole`, `collision`.
- **Enumeration with ranking**: `permutations`, `derangements`,
  `combinations`, `multisets`, `subsets` (binary, Gray code or by size),
  `words`, `product`, `compositions`, `partitions`, `setPartitions`,
  `dyckWords`. Each is a `Family` with `count`, `unrank`, `rank`, `has`,
  `random`, `first`, `slice` and iteration.
- **The seeded generator**: `rng(seed)`, a `Random` with exactly uniform whole
  numbers of any size, exact-fraction probabilities and weights, `shuffle`,
  `sample`, `pick`, and `fork(label)` for independent streams.
- **Graphs**: `graph` and `digraph` from text, edge lists or adjacency objects,
  with exact Rational weights; the standard families and random graphs;
  products, complements, line graphs. Searches, components, bridges and cut
  vertices, strong components, topological order (or a cycle), bipartition
  (or an odd cycle), distances and girth. Shortest paths by Dijkstra,
  Bellman–Ford (negative cycles reported) and Floyd–Warshall. Euler tours and
  Hamilton cycles. Minimum spanning trees, the matrix-tree theorem, Prüfer
  codes and all labelled trees as a `Family`.
- **Linear programming**: `linearProgram`, an exact two-phase simplex method.
  Every answer has a certificate checked by arithmetic alone
  (`checkLinearProgram`): an optimum with its dual prices, an infeasible
  problem with a Farkas vector, an unbounded one with a ray. `integerProgram`
  by branch and bound for small problems.
- **Games**: `matrixGame` (zero-sum: optimal mixed strategies and the value as
  fractions), `saddlePoints`, and `bimatrixGame` with iterated dominance by
  pure or mixed strategies, pure equilibria, every equilibrium by support
  enumeration, and Lemke–Howson.

- **Generating functions and recurrences**: `series` and `egf`, lazy exact
  power series with products, reciprocals, composition, `exp`, `log`, `sqrt`
  and rational powers; `knownSeries`; `rationalSeries` with its recurrence.
  `recurrence` with fast terms, the generating function and an exact closed
  form over algebraic numbers (checked against the terms); `guessRecurrence`
  (Berlekamp–Massey), `closedSum`, `masterTheorem`, `divideAndConquer`.
- **Matchings and flows**: `maximumMatching` (blossoms, with a Tutte–Berge
  set), `bipartiteMatching` (a König cover or a Hall violator), `assignment`
  with dual prices, `stableMatching`, `maxFlow` with a minimum cut.
- **Colouring, planarity, isomorphism, spectra**: `chromaticNumber` with the
  reason no fewer colours work, `chromaticPolynomial`, cliques and independent
  sets; `planarity` with faces or a Kuratowski subdivision; `isomorphism` and
  `automorphisms` (a `PermGroup`); exact adjacency and Laplacian `spectrum`,
  `walks`, and spanning trees from the spectrum.
- **Combinatorial and cooperative games, voting**: Sprague–Grundy values, nim,
  subtraction games; Conway games in canonical form (`cgame`, `starGame`,
  `up`, `partizanGame`); `backwardInduction`; `shapley`, `core` (or a balanced
  collection proving it empty), `weightedVoting`; plurality, Borda, instant
  runoff, Condorcet, approval; five apportionment methods; adjusted winner.
- **Relations and orders**: `relation` with properties and counterexamples,
  closures and classes; `poset` with Hasse diagram, Dilworth's width and
  chains, linear extensions, the Möbius function, lattices; Pólya counting
  with `cycleIndex`, `countColourings`, `patternInventory`. Boolean functions
  (`truthTable`, `minimize`, …) are re-exported from `@ratmath/logic`.
- **Codes and designs**: `linearCode` over Z_p with syndrome decoding in steps,
  `hammingCode`, bounds, `reedSolomon` with Berlekamp–Welch; Latin squares and
  complete sets of orthogonal ones; `blockDesign`, projective and affine
  planes, difference sets, Steiner triple systems.

## Planned

From the [library roadmap](https://github.com/ratmath/ratmath/blob/main/docs/design/library-roadmap.md#7-a-discrete-mathematics-package-ratmathdiscrete).

| Phase | Contents |
|---|---|
| 9 | Graph drawing (in graphics) |

It depends on Core, on `@ratmath/algebraic` (exact roots and permutation
groups) and on `@ratmath/logic`; both are git submodules under `vendor/` for
development. The statistics package uses it for discrete probability.
