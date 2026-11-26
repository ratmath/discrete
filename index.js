// @ratmath/discrete: counting, enumeration with ranking, and a seeded random
// generator. Graphs, generating functions, games and linear programming are
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
export { plan } from "./src/plan.js";
