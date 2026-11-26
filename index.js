// @ratmath/discrete: counting, enumeration with ranking, a seeded random
// generator, and graphs. Generating functions, games and linear programming
// are planned: see `plan`.

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
export { plan } from "./src/plan.js";
