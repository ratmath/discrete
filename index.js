// @ratmath/discrete: counting, enumeration with ranking, a seeded random
// generator, graphs, exact linear programming and matrix and bimatrix games,
// generating functions and recurrences, matchings, flows, colouring, planarity,
// isomorphism and spectra, combinatorial and cooperative games and voting,
// relations, orders and Pólya counting, codes and designs. Graph drawing is
// planned: see `plan`.

export {
  factorial, doubleFactorial, fallingFactorial, risingFactorial,
  binomial, multinomial, multichoose, pascalRow,
  stirling1, stirling2, bell, surjections, catalan, fibonacci, lucas, eulerian,
  derangements as derangementCount, partitionCount, compositionCount,
  inclusionExclusion, sieve, pigeonhole, collision,
  DiscreteError,
} from "./src/counting.js";
export {
  Family, permutations, derangements, combinations, multisets, subsets, words, product,
  compositions, partitions, setPartitions, dyckWords,
} from "./src/enumerate.js";
export { Random, rng } from "./src/random.js";
export {
  Graph, graph, digraph, toWeight,
  cartesianProduct, tensorProduct, strongProduct, lexicographicProduct, disjointUnion, join, union,
} from "./src/graph.js";
export {
  complete, emptyGraph, pathGraph, cycleGraph, star, wheel, completeBipartite, completeMultipartite, turan,
  hypercube, grid, circulant, kneser, petersen, platonic, completeDigraph, transitiveTournament, directedCycle,
  randomGraph, randomGraphWithEdges,
} from "./src/families.js";
export {
  bfs, dfs, reachable, components, isConnected, biconnected, bridges, cutVertices, blocks,
  stronglyConnectedComponents, isStronglyConnected, condensation, topologicalOrder, isAcyclic, findCycle,
  bipartition, isBipartite, distances, distance, eccentricity, diameter, radius, center, periphery, girth,
} from "./src/traverse.js";
export { shortestPaths, shortestPath, allPairsShortestPaths, eulerTour, hamiltonCycle, hamiltonPath } from "./src/paths.js";
export {
  isTree, isForest, minimumSpanningTree, spanningTreeCount, determinant, prufer, fromPrufer, labelledTrees, randomTree,
} from "./src/trees.js";
export {
  linearProgram, integerProgram, transportation, checkLinearProgram, isFeasible, parseProblem, solveSquare, Problem, LPResult, IPResult,
} from "./src/lp.js";
export { matrixGame, saddlePoints, bimatrixGame, MatrixGameSolution, BimatrixGame } from "./src/games.js";
export {
  poly as seriesPoly, PowerSeries, series, egf, known as knownSeries, RationalSeries, rationalSeries,
} from "./src/series.js";
export { LinearRecurrence, recurrence, guessRecurrence, closedSum, masterTheorem, divideAndConquer } from "./src/recurrence.js";
export {
  maximumMatching, checkMatching, bipartiteMatching, assignment, stableMatching, blockingPairs, maxFlow, checkFlow,
} from "./src/matching.js";
export {
  isProperColouring, greedyColouring, maximumClique, maximalCliques, maximumIndependentSet, chromaticNumber, chromaticPolynomial,
} from "./src/colouring.js";
export { planarity, isPlanar, checkKuratowski, genus, embeddingGenus } from "./src/planar.js";
export { isomorphism, isIsomorphic, automorphisms } from "./src/iso.js";
export { adjacency, laplacian, characteristicPolynomial, spectrum, walks, spanningTreesFromSpectrum } from "./src/spectra.js";
export {
  mex, impartialGame, nim, subtractionGame, Game, cgame, star as starGame, up, down, partizanGame, backwardInduction,
} from "./src/play.js";
export {
  cooperativeGame, shapley, core, coreVertices, inCore, weightedVoting,
  plurality, borda, instantRunoff, condorcet, approval, apportion, adjustedWinner,
} from "./src/cooperative.js";
export {
  Relation, relation, fromPartition, Poset, poset, divisorLattice, booleanLattice, partitionLattice,
  cycleIndex, countColourings, patternInventory, symmetry,
} from "./src/orders.js";
export {
  LinearCode, linearCode, hammingCode, repetitionCode, parityCode, ballSize, codeBounds, isPerfect, reedSolomon,
  isLatinSquare, areOrthogonal, cyclicLatinSquare, orthogonalLatinSquares,
  blockDesign, fromDifferenceSet, projectivePlane, affinePlane, steinerTripleSystem,
} from "./src/codes.js";
// Boolean functions (truth tables, normal forms, minimisation) live in
// @ratmath/logic; they are re-exported here for the discrete-mathematics course.
export { truthTable, minterms, maxterms, countModels, fromMinterms, cnf, dnf, minimize, primeImplicants } from "@ratmath/logic";
export * as logic from "@ratmath/logic";
export { plan } from "./src/plan.js";
