// Type declarations for @ratmath/discrete.

import type { Rational } from "@ratmath/core";

/** A whole number: a JavaScript integer, a BigInt, or decimal text. */
export type Whole = number | bigint | string;
/** A probability or weight: a number, a BigInt, text such as "2/7", or a Core Rational. */
export type FractionLike = number | bigint | string | Rational;

export class DiscreteError extends Error {
  /** A short machine-readable reason, such as "too-large". */
  code: string;
  constructor(code: string, message: string);
}

// ---- counting (every count is a BigInt) ----

export function factorial(n: Whole): bigint;
export function doubleFactorial(n: Whole): bigint;
/** n(n − 1)…(n − k + 1): arrangements of k out of n. */
export function fallingFactorial(n: Whole, k: Whole): bigint;
/** n(n + 1)…(n + k − 1). */
export function risingFactorial(n: Whole, k: Whole): bigint;
/** Binomial coefficient; n may be negative. */
export function binomial(n: Whole, k: Whole): bigint;
export function multinomial(...parts: Whole[]): bigint;
/** Multisets of size k from n kinds. */
export function multichoose(n: Whole, k: Whole): bigint;
export function pascalRow(n: Whole): bigint[];
/** Stirling numbers of the first kind: permutations of n with k cycles (signed on request). */
export function stirling1(n: Whole, k: Whole, options?: { signed?: boolean }): bigint;
/** Stirling numbers of the second kind: partitions of an n-set into k blocks. */
export function stirling2(n: Whole, k: Whole): bigint;
export function bell(n: Whole): bigint;
/** Maps from an n-set onto a k-set. */
export function surjections(n: Whole, k: Whole): bigint;
export function catalan(n: Whole): bigint;
export function fibonacci(n: Whole): bigint;
export function lucas(n: Whole): bigint;
export function eulerian(n: Whole, k: Whole): bigint;
/** Permutations of n with no fixed point. */
export function derangementCount(n: Whole): bigint;
/** Partitions of n, or of n into exactly k parts. */
export function partitionCount(n: Whole, k?: Whole): bigint;
/** Compositions of n, or of n into exactly k positive parts. */
export function compositionCount(n: Whole, k?: Whole): bigint;

export interface InclusionExclusionTerm {
  /** How many sets are intersected at this level. */
  size: number;
  sign: 1 | -1;
  /** The sum of the sizes of all intersections at this level. */
  sum: bigint;
  /** How many intersections there are at this level. */
  count: bigint;
}
export function inclusionExclusion<T>(
  sets: readonly (readonly T[] | ReadonlySet<T>)[],
  options?: { universe?: readonly T[] | ReadonlySet<T> | number | bigint },
): { union: bigint; terms: InclusionExclusionTerm[]; none?: bigint };

export interface SieveTerm {
  size: number;
  sign: 1 | -1;
  each: bigint;
  choices: bigint;
  sum: bigint;
}
/** The sieve formula for m properties where any k of them are shared by sizeOf(k) objects. */
export function sieve(
  m: number,
  sizeOf: (k: number) => Whole,
): { all: bigint; none: bigint; union: bigint; terms: SieveTerm[] };

export function pigeonhole(
  items: Whole,
  holes: Whole,
): { atLeast: bigint; atMost: bigint; forced: boolean; statement: string };
/** The first two items that share a key, or null when all keys differ. */
export function collision<T>(
  items: Iterable<T>,
  key?: (item: T) => unknown,
): { key: unknown; items: [T, T]; indices: [number, number] } | null;

// ---- enumeration ----

/**
 * A finite family of objects in a fixed order: it knows how many there are,
 * which one is at each place, and the place of each one.
 */
export class Family<T> implements Iterable<T> {
  readonly name: string;
  readonly count: bigint;
  readonly order: string;
  /** The object at place i (0 ≤ i < count); a negative i counts from the end. */
  unrank(i: Whole): T;
  at(i: Whole): T;
  /** The place of an object; throws when it is not in the family. */
  rank(object: T): bigint;
  has(object: unknown): boolean;
  /** A uniformly random member, drawn from a seeded generator. */
  random(generator: Random): T;
  first(n?: number): T[];
  slice(from?: Whole, to?: Whole): T[];
  /** All members; refuses families too large to list. */
  toArray(): T[];
  toString(): string;
  [Symbol.iterator](): Iterator<T>;
}

/** A number n stands for the items 1…n; an array stands for its own items. */
export type Items<T> = number | readonly T[];

export function permutations(spec: number, k?: number): Family<number[]>;
export function permutations<T>(spec: readonly T[], k?: number): Family<T[]>;
export function derangements(spec: number): Family<number[]>;
export function derangements<T>(spec: readonly T[]): Family<T[]>;
export function combinations(spec: number, k: number): Family<number[]>;
export function combinations<T>(spec: readonly T[], k: number): Family<T[]>;
export function multisets(spec: number, k: number): Family<number[]>;
export function multisets<T>(spec: readonly T[], k: number): Family<T[]>;
export function subsets(spec: number, options?: { order?: "binary" | "gray" | "size" }): Family<number[]>;
export function subsets<T>(spec: readonly T[], options?: { order?: "binary" | "gray" | "size" }): Family<T[]>;
export function words(spec: number, k: number): Family<number[]>;
export function words<T>(spec: readonly T[], k: number): Family<T[]>;
/** Tuples with one entry from each factor: arrays or other families. */
export function product(...factors: (readonly unknown[] | Family<unknown>)[]): Family<unknown[]>;
/** Ordered sums: compositions of n, or of n into k parts (parts may be 0 with { zero: true }). */
export function compositions(n: number, k?: number, options?: { zero?: boolean }): Family<number[]>;
/** Partitions of n, largest part first, or those with exactly k parts. */
export function partitions(n: number, k?: number): Family<number[]>;
export function setPartitions(spec: number, k?: number): Family<number[][]>;
export function setPartitions<T>(spec: readonly T[], k?: number): Family<T[][]>;
/** Balanced bracket strings with n pairs. */
export function dyckWords(n: number, options?: { open?: string; close?: string }): Family<string>;

// ---- the seeded generator ----

/**
 * A seeded random generator (xoshiro128**). The same seed gives the same
 * stream everywhere. Not for secrets.
 */
export class Random {
  constructor(seed?: number | bigint | string | readonly [number, number, number, number]);
  /** The next 32 random bits. */
  u32(): number;
  /** k random bits. */
  bits(k: number): bigint;
  /** A uniform whole number in [0, n), exactly uniform for n of any size. */
  int(n: number): number;
  int(n: bigint): bigint;
  /** A uniform whole number from lo to hi, both included. */
  between(lo: number, hi: number): number;
  between(lo: number | bigint, hi: number | bigint): number | bigint;
  /** True with probability p, an exact fraction (default 1/2). */
  bool(p?: FractionLike): boolean;
  /** A uniform fraction k/denominator with 0 ≤ k < denominator. */
  rational(denominator?: Whole): Rational;
  /** A double in [0, 1). The one method that is not exact. */
  float(): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: Iterable<T>): T[];
  /** k distinct elements in random order. */
  sample<T>(items: Iterable<T>, k: number): T[];
  weightedIndex(weights: readonly FractionLike[]): number;
  weighted<T>(items: readonly T[], weights: readonly FractionLike[]): T;
  /** An independent generator derived from this one's state and a label, without advancing this one. */
  fork(label?: string): Random;
  readonly state: [number, number, number, number];
  clone(): Random;
}
export function rng(seed?: number | bigint | string): Random;

// ---- graphs ----

/** A vertex: a whole number, a BigInt or a string. */
export type Vertex = number | bigint | string;
/** An edge weight: a whole number, BigInt, text such as "3/2" or "0.25", or a Rational. */
export type WeightLike = number | bigint | string | Rational;

export interface Edge {
  /** Unique within its graph, in the order edges were added. */
  readonly id: number;
  readonly from: Vertex;
  readonly to: Vertex;
  /** An exact weight; 1 unless one was given. */
  readonly weight: Rational;
}

export interface GraphOptions {
  /** Allow parallel edges. */
  multi?: boolean;
  /** Allow loops. */
  loops?: boolean;
  /** Extra vertices to add. */
  vertices?: readonly Vertex[];
}

/** Text ("a-b b-c:3/2 d"), a list of edges, an adjacency object, or { vertices, edges }. */
export type GraphSpec =
  | string
  | readonly (readonly [Vertex, Vertex, WeightLike?] | { from: Vertex; to: Vertex; weight?: WeightLike } | Vertex)[]
  | Record<string, readonly Vertex[] | Record<string, WeightLike>>
  | { vertices?: readonly Vertex[]; edges?: readonly (readonly [Vertex, Vertex, WeightLike?])[] }
  | Graph;

export class Graph {
  constructor(options?: { directed?: boolean; multi?: boolean; loops?: boolean });
  readonly directed: boolean;
  readonly multi: boolean;
  readonly loops: boolean;
  /** True when some edge was given a weight. */
  weighted: boolean;
  /** The number of vertices. */
  readonly order: number;
  /** The number of edges. */
  readonly size: number;
  vertices(): Vertex[];
  edges(): Edge[];
  edgeById(id: number): Edge | null;
  hasVertex(v: Vertex): boolean;
  hasEdge(u: Vertex, v: Vertex): boolean;
  edgesBetween(u: Vertex, v: Vertex): Edge[];
  /** The lightest edge from u to v. */
  edge(u: Vertex, v: Vertex): Edge | null;
  weight(u: Vertex, v: Vertex): Rational | null;
  addVertex(...vs: Vertex[]): this;
  addEdge(u: Vertex, v: Vertex, weight?: WeightLike): this;
  removeVertex(v: Vertex): this;
  removeEdge(edge: Edge | number): this;
  removeEdge(u: Vertex, v: Vertex): this;
  /** Edges leaving v, oriented so that `to` is the other end. */
  outEdges(v: Vertex): Edge[];
  inEdges(v: Vertex): Edge[];
  neighbors(v: Vertex): Vertex[];
  outNeighbors(v: Vertex): Vertex[];
  inNeighbors(v: Vertex): Vertex[];
  degree(v: Vertex): number;
  outDegree(v: Vertex): number;
  inDegree(v: Vertex): number;
  degreeSequence(): number[];
  copy(options?: { directed?: boolean; multi?: boolean; loops?: boolean }): Graph;
  subgraph(vertices: readonly Vertex[]): Graph;
  edgeSubgraph(edges: readonly (Edge | number)[], options?: { allVertices?: boolean }): Graph;
  complement(): Graph;
  reverse(): Graph;
  underlying(options?: { multi?: boolean }): Graph;
  lineGraph(): Graph;
  adjacencyMatrix(): { vertices: Vertex[]; matrix: number[][] };
  totalWeight(): Rational;
  /** The text form that graph() and digraph() read. */
  toString(): string;
  toJSON(): { directed: boolean; vertices: Vertex[]; edges: unknown[][] };
}

export function graph(spec?: GraphSpec, options?: GraphOptions): Graph;
export function digraph(spec?: GraphSpec, options?: GraphOptions): Graph;
export function toWeight(w: WeightLike | null | undefined): Rational;
/** Vertices are named "a,b". */
export function cartesianProduct(g: Graph, h: Graph): Graph;
export function tensorProduct(g: Graph, h: Graph): Graph;
export function strongProduct(g: Graph, h: Graph): Graph;
export function lexicographicProduct(g: Graph, h: Graph): Graph;
/** Vertices are named "1.v" and "2.v" unless { rename: false }. */
export function disjointUnion(g: Graph, h: Graph, options?: { rename?: boolean }): Graph;
export function join(g: Graph, h: Graph): Graph;
export function union(g: Graph, h: Graph): Graph;

export function complete(n: Whole): Graph;
export function emptyGraph(n: Whole): Graph;
export function pathGraph(n: Whole): Graph;
export function cycleGraph(n: Whole): Graph;
/** Centre 0, leaves 1…n. */
export function star(n: Whole): Graph;
/** Hub 0, rim 1…n. */
export function wheel(n: Whole): Graph;
export function completeBipartite(m: Whole, n: Whole): Graph;
export function completeMultipartite(...sizes: Whole[]): Graph;
export function turan(n: Whole, r: Whole): Graph;
/** Vertices are bit strings. */
export function hypercube(d: Whole): Graph;
/** Vertices are "row,column". */
export function grid(m: Whole, n: Whole): Graph;
export function circulant(n: Whole, jumps: readonly Whole[]): Graph;
export function kneser(n: Whole, k: Whole): Graph;
export function petersen(): Graph;
export function platonic(name: "tetrahedron" | "cube" | "octahedron" | "dodecahedron" | "icosahedron"): Graph;
export function completeDigraph(n: Whole): Graph;
export function transitiveTournament(n: Whole): Graph;
export function directedCycle(n: Whole): Graph;
/** G(n, p) with p an exact fraction. */
export function randomGraph(n: Whole, p: FractionLike, generator?: Random | number | bigint | string, options?: { directed?: boolean }): Graph;
/** G(n, m): uniform among graphs with exactly m edges. */
export function randomGraphWithEdges(n: Whole, m: Whole, generator?: Random | number | bigint | string, options?: { directed?: boolean }): Graph;

// ---- traversal and connectivity ----

export function bfs(g: Graph, start: Vertex | readonly Vertex[]): { order: Vertex[]; depth: Map<Vertex, number>; parent: Map<Vertex, Vertex | null> };
export function dfs(g: Graph, start?: Vertex | readonly Vertex[]): {
  order: Vertex[];
  post: Vertex[];
  parent: Map<Vertex, Vertex | null>;
  discovered: Map<Vertex, number>;
  finished: Map<Vertex, number>;
};
export function reachable(g: Graph, v: Vertex): Vertex[];
/** Components (weak, for a directed graph), largest first. */
export function components(g: Graph): Vertex[][];
export function isConnected(g: Graph): boolean;
export function biconnected(g: Graph): { bridges: Edge[]; cutVertices: Vertex[]; blocks: Vertex[][] };
export function bridges(g: Graph): Edge[];
export function cutVertices(g: Graph): Vertex[];
export function blocks(g: Graph): Vertex[][];
export function stronglyConnectedComponents(g: Graph): Vertex[][];
export function isStronglyConnected(g: Graph): boolean;
export function condensation(g: Graph): { graph: Graph; components: Vertex[][] };
export function topologicalOrder(g: Graph): { acyclic: true; order: Vertex[] } | { acyclic: false; cycle: Vertex[] };
export function isAcyclic(g: Graph): boolean;
/** A closed list [v₁, …, v₁], or null. */
export function findCycle(g: Graph): Vertex[] | null;
export function bipartition(g: Graph): { bipartite: true; parts: [Vertex[], Vertex[]] } | { bipartite: false; oddCycle: Vertex[] };
export function isBipartite(g: Graph): boolean;
/** Distances counted in edges. */
export function distances(g: Graph, v: Vertex): Map<Vertex, number>;
export function distance(g: Graph, u: Vertex, v: Vertex): number;
export function eccentricity(g: Graph, v: Vertex): number;
export function diameter(g: Graph): number;
export function radius(g: Graph): number;
export function center(g: Graph): Vertex[];
export function periphery(g: Graph): Vertex[];
export function girth(g: Graph): { girth: number; cycle: Vertex[] | null };

// ---- paths and tours ----

export interface Path {
  /** Exact. */
  distance: Rational;
  path: Vertex[];
  edges: Edge[];
}
export interface ShortestPaths {
  source: Vertex;
  method: "breadth-first" | "dijkstra" | "bellman-ford" | "refused";
  distance?: Map<Vertex, Rational>;
  parent?: Map<Vertex, Vertex | null>;
  pathTo?(t: Vertex): Path | null;
  /** The reason there are no shortest paths, [v₁, …, v₁]; otherwise null. */
  negativeCycle: Vertex[] | null;
}
export function shortestPaths(g: Graph, source: Vertex, options?: { weighted?: boolean }): ShortestPaths;
/** Throws a DiscreteError with code "negative-cycle" and `cycle` when there is no shortest path. */
export function shortestPath(g: Graph, s: Vertex, t: Vertex, options?: { weighted?: boolean }): Path | null;
export function allPairsShortestPaths(g: Graph, options?: { weighted?: boolean }): {
  vertices: Vertex[];
  matrix?: (Rational | null)[][];
  distance?(u: Vertex, v: Vertex): Rational | null;
  path?(u: Vertex, v: Vertex): Vertex[] | null;
  negativeCycle: Vertex[] | null;
};
export type EulerTour =
  | { exists: true; closed: boolean; vertices: Vertex[]; edges: Edge[] }
  | { exists: false; reason: string; odd?: Vertex[]; unbalanced?: { vertex: Vertex; out: number; in: number }[]; components?: Vertex[][] };
export function eulerTour(g: Graph, options?: { closed?: boolean }): EulerTour;
/** Exhaustive search, up to 20 vertices. */
export function hamiltonCycle(g: Graph): { exists: true; cycle: Vertex[] } | { exists: false; reason: string; vertex?: Vertex; components?: Vertex[][] };
export function hamiltonPath(g: Graph): { exists: true; path: Vertex[] } | { exists: false; reason: string; components?: Vertex[][] };

// ---- trees ----

export function isTree(g: Graph): boolean;
export function isForest(g: Graph): boolean;
export function minimumSpanningTree(g: Graph, options?: { method?: "kruskal" | "prim"; maximum?: boolean }): {
  weight: Rational;
  edges: Edge[];
  tree: Graph;
  /** False when the result is a spanning forest. */
  connected: boolean;
  method: string;
};
/** Kirchhoff's matrix-tree theorem, exactly. */
export function spanningTreeCount(g: Graph): bigint;
/** Exact determinant by Bareiss elimination. */
export function determinant(rows: readonly (readonly (number | bigint)[])[]): bigint;
export function prufer(tree: Graph, options?: { vertices?: readonly Vertex[] }): Vertex[];
export function fromPrufer(code: readonly Vertex[], vertices?: readonly Vertex[]): Graph;
/** The n^(n−2) labelled trees, numbered through their Prüfer codes. */
export function labelledTrees(spec: Whole | readonly Vertex[]): Family<Graph>;
export function randomTree(spec: Whole | readonly Vertex[], generator?: Random | number | bigint | string): Graph;

// ---- linear programming (exact, with certificates) ----

export type ConstraintSense = "<=" | ">=" | "=" | "≤" | "≥" | "==";
export type Coefficients = FractionLike[] | Record<string, FractionLike>;
export type Constraint =
  | [Coefficients, ConstraintSense, FractionLike]
  | [Coefficients, ConstraintSense, FractionLike, string]
  | { coefficients: Coefficients; relation: ConstraintSense; rhs: FractionLike; name?: string };
export type ProblemSpec = {
  maximize?: Coefficients;
  minimize?: Coefficients;
  constraints?: Constraint[];
  subjectTo?: Constraint[];
  names?: string[];
  /** Variables without the sign condition x ≥ 0, by name or index. */
  free?: (string | number)[];
};
export class Problem {
  readonly sense: "maximize" | "minimize";
  readonly names: readonly string[];
  readonly c: readonly Rational[];
  readonly rows: readonly { name: string; a: readonly Rational[]; relation: "<=" | ">=" | "="; b: Rational }[];
  readonly free: readonly boolean[];
  withRows(rows: { name: string; a: Rational[]; relation: "<=" | ">=" | "="; b: Rational }[]): Problem;
  toString(): string;
}
export function parseProblem(problem: ProblemSpec | Problem): Problem;
export class LPResult {
  readonly problem: Problem;
  readonly status: "optimal" | "infeasible" | "unbounded";
  /** The solution (optimal), or a feasible point (unbounded). */
  readonly x: readonly Rational[] | null;
  /** Shadow prices, one per constraint: the dual solution that proves optimality. */
  readonly dual: readonly Rational[] | null;
  /** For an infeasible problem: multipliers that combine the constraints into 0 ≤ negative. */
  readonly farkas: readonly Rational[] | null;
  /** For an unbounded problem: a direction that stays feasible and improves the objective. */
  readonly ray: readonly Rational[] | null;
  readonly value: Rational | null;
  readonly pivots: number;
  readonly solution: Record<string, Rational> | null;
  readonly prices: Record<string, Rational> | null;
  /** The constraints that hold with equality at the solution. */
  readonly binding: string[] | null;
  /** Check the certificate by arithmetic on the problem; true, or throws. */
  check(): true;
  toString(): string;
}
export function linearProgram(problem: ProblemSpec | Problem, options?: { maxPivots?: number }): LPResult;
export function checkLinearProgram(
  problem: ProblemSpec | Problem,
  result: { status: string; x?: readonly FractionLike[] | null; dual?: readonly Rational[] | null; farkas?: readonly Rational[] | null; ray?: readonly Rational[] | null },
): true;
export function isFeasible(problem: ProblemSpec | Problem, x: readonly FractionLike[]): boolean;
/** Solve a square linear system exactly; null when it is singular. */
export function solveSquare(M: Rational[][], rhs: Rational[]): Rational[] | null;
export class IPResult {
  readonly problem: Problem;
  readonly integer: readonly string[];
  readonly status: "optimal" | "infeasible";
  readonly x: readonly Rational[] | null;
  readonly value: Rational | null;
  /** Subproblems solved. */
  readonly nodes: number;
  /** The linear relaxation: a bound on the value. */
  readonly relaxation: LPResult;
  readonly solution: Record<string, Rational> | null;
  check(): true;
  toString(): string;
}
export function integerProgram(problem: ProblemSpec | Problem, options?: { integer?: (string | number)[] | true; maxNodes?: number }): IPResult;

// ---- games ----

export class MatrixGameSolution {
  readonly payoffs: readonly (readonly Rational[])[];
  readonly value: Rational;
  readonly row: readonly Rational[];
  readonly column: readonly Rational[];
  readonly rowNames: readonly string[];
  readonly columnNames: readonly string[];
  readonly fair: boolean;
  guarantee(p?: readonly FractionLike[]): Rational;
  cap(q?: readonly FractionLike[]): Rational;
  check(): true;
  toString(): string;
}
export function matrixGame(A: FractionLike[][], options?: { rows?: string[]; columns?: string[] }): MatrixGameSolution;
export function saddlePoints(A: FractionLike[][]): { row: number; column: number; value: Rational }[];
export interface Equilibrium {
  readonly row: readonly Rational[];
  readonly column: readonly Rational[];
  readonly payoffs: { readonly row: Rational; readonly column: Rational };
  readonly pure: boolean;
  check(): true;
  toString(): string;
}
export class BimatrixGame {
  readonly A: readonly (readonly Rational[])[];
  readonly B: readonly (readonly Rational[])[];
  readonly rowNames: readonly string[];
  readonly columnNames: readonly string[];
  readonly m: number;
  readonly n: number;
  payoffs(p: readonly FractionLike[], q: readonly FractionLike[]): { row: Rational; column: Rational };
  isEquilibrium(p: readonly FractionLike[], q: readonly FractionLike[]): boolean;
  pureEquilibria(): Equilibrium[];
  dominance(options?: { pureOnly?: boolean }): {
    rows: string[];
    columns: string[];
    steps: { player: "row" | "column"; removed: string; by: Record<string, Rational> }[];
  };
  /** Every equilibrium of a nondegenerate game; `complete` is false when the game is degenerate. */
  equilibria(options?: { limit?: number }): readonly Equilibrium[] & { complete: boolean };
  lemkeHowson(label?: number, options?: { maxPivots?: number }): Equilibrium;
  toString(): string;
}
/** A two-player game; with one matrix, the column player's payoffs are its negative. */
export function bimatrixGame(A: FractionLike[][], B?: FractionLike[][], options?: { rows?: string[]; columns?: string[] }): BimatrixGame;

// ---- generating functions and recurrences ----

/** A formal power series with exact coefficients, computed lazily and remembered. */
export class PowerSeries {
  readonly name: string;
  /** The coefficient of xⁿ. */
  coefficient(n: number): Rational;
  /** The first n coefficients; with egf, multiplied by k! (the counts an exponential generating function holds). */
  terms(n: number, options?: { egf?: boolean }): Rational[];
  add(other: SeriesLike): PowerSeries;
  subtract(other: SeriesLike): PowerSeries;
  negate(): PowerSeries;
  scale(c: FractionLike): PowerSeries;
  multiply(other: SeriesLike): PowerSeries;
  /** x^k · f. */
  shift(k: number): PowerSeries;
  /** 1/f; needs f(0) ≠ 0. */
  reciprocal(): PowerSeries;
  divide(other: SeriesLike): PowerSeries;
  derivative(): PowerSeries;
  /** ∫₀ˣ f, constant term 0. */
  integral(): PowerSeries;
  /** f(g(x)); needs g(0) = 0. */
  compose(g: SeriesLike): PowerSeries;
  /** f^a for a whole a, or a rational a when f(0) = 1. */
  pow(a: FractionLike): PowerSeries;
  /** e^f; needs f(0) = 0. */
  exp(): PowerSeries;
  /** log f; needs f(0) = 1. */
  log(): PowerSeries;
  /** √f; needs f(0) = 1. */
  sqrt(): PowerSeries;
  toString(terms?: number): string;
}
/** A series, a constant, a coefficient list (constant first), or a rule n ↦ aₙ. */
export type SeriesLike = PowerSeries | FractionLike | FractionLike[] | ((n: number) => FractionLike);
export function series(input: SeriesLike): PowerSeries;
/** The exponential generating function Σ aₙ xⁿ/n!. */
export function egf(sequence: FractionLike[] | ((n: number) => FractionLike)): PowerSeries;
/** Named series: 1/(1 − rx), eˣ, −log(1 − x), (1 + x)^a, Catalan, partitions (by Euler's pentagonal recurrence). */
export const knownSeries: {
  geometric(r?: FractionLike): PowerSeries;
  exp(): PowerSeries;
  logInverse(): PowerSeries;
  binomial(a: FractionLike): PowerSeries;
  catalan(): PowerSeries;
  partitions(): PowerSeries;
};
/** Polynomial helpers on Rational arrays, constant first. */
export const seriesPoly: {
  trim(p: Rational[]): Rational[];
  add(p: Rational[], q: Rational[]): Rational[];
  sub(p: Rational[], q: Rational[]): Rational[];
  mul(p: Rational[], q: Rational[]): Rational[];
  scale(p: Rational[], c: Rational): Rational[];
  at(p: Rational[], x: Rational): Rational;
  format(p: Rational[], variable?: string): string;
};
/** P(x)/Q(x) with Q(0) ≠ 0: its series, and the linear recurrence its coefficients satisfy. */
export class RationalSeries {
  constructor(numerator: FractionLike[], denominator: FractionLike[]);
  readonly numerator: Rational[];
  readonly denominator: Rational[];
  readonly series: PowerSeries;
  coefficient(n: number): Rational;
  terms(n: number): Rational[];
  add(other: RationalSeries): RationalSeries;
  multiply(other: RationalSeries): RationalSeries;
  recurrence(): LinearRecurrence;
  toString(): string;
}
export function rationalSeries(numerator: FractionLike[], denominator: FractionLike[]): RationalSeries;

/** One part of a closed form: Σⱼ cⱼ nʲ · rootⁿ, with exact algebraic numbers. */
export interface ClosedFormPart {
  root: unknown;
  multiplicity: number;
  coefficients: unknown[];
}
export interface ClosedForm {
  parts: ClosedFormPart[];
  /** The formula gives aₙ from this n on (later when zero roots are stripped). */
  validFrom: number;
  /** The formula was compared with the terms, exactly, past the ones used to fit it. */
  checked: boolean;
  /** aₙ as an algebraic number. */
  at(n: number): unknown;
  toString(): string;
}
/**
 * aₙ = c₁aₙ₋₁ + … + c_k aₙ₋ₖ (+ p(n)·baseⁿ). The non-homogeneous part is
 * absorbed into a longer homogeneous recurrence; `given` keeps the original.
 */
export class LinearRecurrence {
  constructor(spec: { coefficients: FractionLike[]; initial: FractionLike[]; plus?: FractionLike[] | { poly: FractionLike[]; base: FractionLike } });
  readonly coefficients: readonly Rational[];
  readonly initial: readonly Rational[];
  readonly order: number;
  readonly given: { coefficients: Rational[]; plus: unknown } | null;
  terms(n: number): Rational[];
  /** aₙ by a power of the companion matrix: fast for large n. */
  term(n: Whole): Rational;
  /** The characteristic polynomial, constant first. */
  characteristic(): Rational[];
  generatingFunction(): RationalSeries;
  closedForm(): ClosedForm;
  toString(): string;
}
export function recurrence(spec: ConstructorParameters<typeof LinearRecurrence>[0]): LinearRecurrence;
/** The shortest linear recurrence that produces the terms (Berlekamp–Massey over the rationals). */
export function guessRecurrence(terms: FractionLike[]): LinearRecurrence;
/** Σₖ₌₀ⁿ p(k)·r^k in closed form, for a polynomial p (constant first). */
export function closedSum(p: FractionLike[], r?: FractionLike): { polynomial: Rational[]; at(n: Whole): Rational; toString(): string };
/** T(n) = a·T(n/b) + Θ(n^d log^j n): the case, the bound, and why. */
export function masterTheorem(spec: { a: FractionLike; b: FractionLike; d: FractionLike; j?: number }): {
  case: 1 | 2 | 3;
  critical: string;
  bound: string;
  reason: string;
};
/** Exact values of T(n) = a·T(n/b) + f(n) at n = b^m. */
export function divideAndConquer(spec: { a: FractionLike; b: Whole; f: (n: bigint) => FractionLike; t1?: FractionLike }, count?: number): { n: bigint; value: Rational }[];

// ---- matchings and flows ----

export interface TutteBergeCertificate {
  /** The set U removed. */
  set: Vertex[];
  /** The odd components of G − U. */
  oddComponents: Vertex[][];
  /** (|V| + |U| − odd(G − U))/2, which no matching exceeds. */
  bound: number;
}
export interface MatchingCheck {
  ok: boolean;
  size: number;
  bound: number;
  errors: string[];
}
/** A maximum matching of any graph (Edmonds' blossoms), with a Tutte–Berge set proving no larger one exists. */
export function maximumMatching(g: Graph | GraphSpec): {
  size: number;
  edges: [Vertex, Vertex][];
  perfect: boolean;
  unmatched: Vertex[];
  certificate: TutteBergeCertificate;
  check(): MatchingCheck;
};
export function checkMatching(g: Graph, edges: [Vertex, Vertex][], tutteSet: Vertex[]): MatchingCheck;
/** Bipartite matching with a König vertex cover and, when some left vertex is unmatched, a Hall violator. */
export function bipartiteMatching(g: Graph | GraphSpec, options?: { left?: Vertex[] }): {
  size: number;
  edges: [Vertex, Vertex][];
  perfect: boolean;
  cover: Vertex[];
  hall: { set: Vertex[]; neighbours: Vertex[] } | null;
};
/** The cheapest (or dearest) assignment of rows to columns, with dual prices that prove it. */
export function assignment(costs: FractionLike[][], options?: { maximize?: boolean }): {
  assignment: number[];
  cost: Rational;
  rowPrices: Rational[];
  columnPrices: Rational[];
  check(): { ok: boolean; errors: string[] };
};
/** Gale–Shapley, proposers first. */
export function stableMatching(proposers: Record<string, string[]>, receivers: Record<string, string[]>): {
  matching: Record<string, string>;
  proposals: number;
  blockingPairs: [string, string][];
};
export function blockingPairs(proposers: Record<string, string[]>, receivers: Record<string, string[]>, matching: Record<string, string>): [string, string][];
export interface FlowEdge {
  from: Vertex;
  to: Vertex;
  amount: Rational;
}
/** Maximum flow by shortest augmenting paths, exact capacities, with a minimum cut of the same value. */
export function maxFlow(g: Graph | GraphSpec, source: Vertex, sink: Vertex): {
  value: Rational;
  flow: FlowEdge[];
  cut: { source: Vertex[]; sink: Vertex[]; edges: [Vertex, Vertex][]; capacity: Rational };
  augmentations: unknown[];
  check(): { ok: boolean; errors: string[] };
};
export function checkFlow(g: Graph, source: Vertex, sink: Vertex, flow: FlowEdge[], cut?: unknown): { ok: boolean; errors: string[] };

// ---- colouring, cliques ----

export function isProperColouring(g: Graph, colouring: Map<Vertex, number> | Record<string, number>): { ok: boolean; clash: [Vertex, Vertex] | null };
export function greedyColouring(g: Graph, order?: Vertex[]): Map<Vertex, number>;
export function maximumClique(g: Graph): Vertex[];
export function maximalCliques(g: Graph): Vertex[][];
export function maximumIndependentSet(g: Graph): Vertex[];
/** χ(G) with a colouring that uses that many colours and the reason no fewer will do (a clique, an odd cycle, or a complete search). */
export function chromaticNumber(g: Graph): { number: number; colouring: Map<Vertex, number>; lowerBound: unknown };
/** P(G, k), the number of proper k-colourings, by deletion–contraction. */
export function chromaticPolynomial(g: Graph): { coefficients: bigint[]; at(k: Whole): bigint; toString(): string };

// ---- planarity ----

export interface KuratowskiWitness {
  kind: "K5" | "K3,3";
  branch: Vertex[];
  paths: Vertex[][];
  edges: [Vertex, Vertex][];
}
/** A planar embedding (faces, per block) or a Kuratowski subdivision. */
export function planarity(g: Graph):
  | { planar: true; faces: Vertex[][][]; edges: number; vertices: number }
  | { planar: false; kuratowski: KuratowskiWitness };
export function isPlanar(g: Graph): boolean;
export function checkKuratowski(g: Graph, witness: KuratowskiWitness): { ok: boolean; errors: string[] };

// ---- isomorphism and spectra ----

export function isomorphism(g: Graph, h: Graph): { isomorphic: true; map: Map<Vertex, Vertex> } | { isomorphic: false; reason: string };
export function isIsomorphic(g: Graph, h: Graph): boolean;
/** Aut(G): order, a few generators (0-based permutations of g.vertices()), orbits, and a PermGroup when the order is at most 50,000. */
export function automorphisms(g: Graph): { order: bigint; generators: number[][]; orbits: Vertex[][]; group: unknown | null; vertices: Vertex[] };
export function adjacency(g: Graph): { vertices: Vertex[]; matrix: bigint[][] };
export function laplacian(g: Graph): { vertices: Vertex[]; matrix: bigint[][] };
/** det(xI − M), constant first. */
export function characteristicPolynomial(matrix: Whole[][]): bigint[];
export function spectrum(g: Graph, options?: { laplacian?: boolean }): {
  polynomial: bigint[];
  polynomialText: string;
  eigenvalues: { value: unknown; multiplicity: number; text: string }[];
  toString(): string;
};
/** A^k: walks of length k between every pair, and the closed ones in all. */
export function walks(g: Graph, k: number): { vertices: Vertex[]; matrix: bigint[][]; closed: bigint };
/** τ(G) from the Laplacian's characteristic polynomial (the matrix-tree theorem). */
export function spanningTreesFromSpectrum(g: Graph): bigint;

// ---- combinatorial games ----

export function mex(values: Iterable<number>): number;
/** An impartial game given by its moves: Sprague–Grundy values, losing positions, winning moves. */
export function impartialGame<P>(moves: (position: P) => P[], options?: { key?: (position: P) => string }): {
  grundy(position: P): number;
  isLoss(position: P): boolean;
  winningMoves(position: P): P[];
};
export function nim(heaps: Whole[]): { nimSum: bigint; losing: boolean; winningMoves: { heap: number; from: bigint; to: bigint }[] };
/** A subtraction game: Grundy values for heaps 0 … length − 1 and their eventual period. */
export function subtractionGame(subtract: number[], length?: number): { values: number[]; period: { start: number; length: number } | null };
export type GameLike = Game | FractionLike;
/** A short partizan game { L | R } in canonical form (Conway). */
export class Game {
  /** Left's and Right's options, in canonical form. */
  readonly L: readonly Game[];
  readonly R: readonly Game[];
  le(other: GameLike): boolean;
  ge(other: GameLike): boolean;
  equals(other: GameLike): boolean;
  /** ">", "<", "=" or "‖" (confused with). */
  compare(other: GameLike): ">" | "<" | "=" | "‖";
  /** Who wins: "Left", "Right", "second player" or "first player". */
  readonly outcome: string;
  add(other: GameLike): Game;
  negate(): Game;
  subtract(other: GameLike): Game;
  /** The number it equals, or null. */
  readonly number: Rational | null;
  /** n when it equals *n, else null. */
  readonly nimber: number | null;
  toString(): string;
}
export function cgame(left: GameLike[], right: GameLike[]): Game;
/** *n. Exported from the package as starGame (star is the graph). */
export function starGame(n?: number): Game;
export function up(): Game;
export function down(): Game;
/** The canonical value of a position, from Left's and Right's moves. */
export function partizanGame<P>(position: P, leftMoves: (p: P) => P[], rightMoves: (p: P) => P[], options?: { key?: (p: P) => string }): Game;
export type GameTree = { payoff: Record<string, FractionLike> } | { player: string; moves: Record<string, GameTree> };
/** Subgame-perfect play in a finite game tree. */
export function backwardInduction(tree: GameTree): {
  value: Record<string, Rational>;
  plan: { path: string[]; player: string; choice: string; ties: string[] }[];
  path: string[];
};

// ---- cooperative games and voting ----

export interface CooperativeGame {
  players: string[];
  value(coalition: string[]): Rational;
}
export function cooperativeGame(players: string[], value: ((coalition: string[]) => FractionLike) | Record<string, FractionLike>): CooperativeGame;
export function shapley(game: CooperativeGame): Record<string, Rational>;
/** A core allocation, or a balanced collection proving the core empty. */
export function core(game: CooperativeGame):
  | { empty: false; allocation: Record<string, Rational> }
  | { empty: true; balanced: { coalition: string[]; weight: Rational }[]; reason: string };
export function inCore(game: CooperativeGame, allocation: Record<string, FractionLike>): { inCore: boolean; blocking: string[] | null; reason?: string };
export function weightedVoting(spec: { quota: FractionLike; weights: Record<string, FractionLike> }): {
  game: CooperativeGame;
  shapleyShubik: Record<string, Rational>;
  banzhaf: Record<string, Rational>;
  swings: Record<string, bigint>;
  dummies: string[];
};
/** A ballot: a ranking, or { ranking, count }. */
export type Ballot = string[] | { ranking: string[]; count: Whole };
export function plurality(ballots: Ballot[]): { winners: string[]; tally: Record<string, bigint> };
export function borda(ballots: Ballot[]): { winners: string[]; tally: Record<string, bigint> };
export function instantRunoff(ballots: Ballot[]): { winners: string[]; rounds: { tally: Record<string, bigint>; eliminated: string[] }[] };
export function condorcet(ballots: Ballot[]): {
  pairwise: Record<string, Record<string, bigint>>;
  winner: string | null;
  copeland: Record<string, number>;
  cycle: string[] | null;
};
export function approval(ballots: string[][]): { winners: string[]; tally: Record<string, bigint> };
export type ApportionMethod = "hamilton" | "jefferson" | "webster" | "adams" | "huntington-hill";
export function apportion(populations: Record<string, Whole>, seats: Whole, options?: { method?: ApportionMethod }): {
  seats: Record<string, bigint>;
  quotas: Record<string, Rational>;
  method: ApportionMethod;
  tie: unknown | null;
};
/** Brams–Taylor adjusted winner for two parties with 100 points each. */
export function adjustedWinner(a: Record<string, FractionLike>, b: Record<string, FractionLike>): {
  A: Record<string, Rational>;
  B: Record<string, Rational>;
  points: { A: Rational; B: Rational };
};

// ---- relations, orders, Pólya counting ----

export interface PropertyResult {
  holds: boolean;
  /** A counterexample when it fails. */
  witness?: unknown[];
}
export class Relation<T = unknown> {
  readonly elements: readonly T[];
  readonly pairs: readonly [T, T][];
  has(a: T, b: T): boolean;
  properties(): Record<"reflexive" | "irreflexive" | "symmetric" | "antisymmetric" | "asymmetric" | "transitive" | "total", PropertyResult>;
  inverse(): Relation<T>;
  compose(other: Relation<T>): Relation<T>;
  reflexiveClosure(): Relation<T>;
  symmetricClosure(): Relation<T>;
  transitiveClosure(): Relation<T>;
  /** Equivalence classes; refuses when the relation is not an equivalence. */
  classes(): T[][];
  toString(): string;
}
export function relation<T>(elements: T[], pairs: [T, T][] | ((a: T, b: T) => boolean)): Relation<T>;
export function fromPartition<T>(blocks: T[][]): Relation<T>;
export class Poset<T = unknown> {
  readonly elements: readonly T[];
  leq(a: T, b: T): boolean;
  lt(a: T, b: T): boolean;
  comparable(a: T, b: T): boolean;
  /** Covering pairs. */
  hasse(): [T, T][];
  minimal(): T[];
  maximal(): T[];
  least(): T | null;
  greatest(): T | null;
  levels(): T[][];
  longestChain(): T[];
  /** Dilworth: the largest antichain and a partition into that many chains. */
  width(): { width: number; antichain: T[]; chains: T[][] };
  linearExtensions(options?: { limit?: number }): T[][];
  countLinearExtensions(): bigint;
  mobius(a: T, b: T): bigint;
  meet(a: T, b: T): T | null;
  join(a: T, b: T): T | null;
  isLattice(): { lattice: boolean; witness?: unknown };
  isDistributive(): { distributive: boolean; witness?: T[] };
}
/** The order generated by the pairs (reflexive–transitive closure); refuses a cycle. */
export function poset<T>(elements: T[], pairs: [T, T][] | ((a: T, b: T) => boolean)): Poset<T>;
export function divisorLattice(n: Whole): Poset<number>;
export function booleanLattice(n: number): Poset<string>;
export function partitionLattice(n: number): Poset<string>;
/** A permutation group: { degree, generators } with 0-based permutations, or a PermGroup from @ratmath/algebraic. */
export interface PermutationGroupLike {
  degree: number;
  generators: number[][];
  elements?: number[][];
  order?: number;
}
export function cycleIndex(group: PermutationGroupLike): { terms: { coefficient: Rational; cycles: unknown }[]; order: number; degree: number; toString(): string };
/** Colourings with k colours up to the group (Burnside/Pólya). */
export function countColourings(group: PermutationGroupLike, k: Whole): bigint;
export function patternInventory(group: PermutationGroupLike, colours: string[]): { rows: unknown[]; toString(): string };
export const symmetry: {
  cyclic(n: number): PermutationGroupLike;
  dihedral(n: number): PermutationGroupLike;
  symmetric(n: number): PermutationGroupLike;
  cubeFaces(): PermutationGroupLike;
};

// ---- codes and designs ----

/** A linear [n, k] code over Z_p (p prime), from a generator matrix. Words are arrays of residues. */
export class LinearCode {
  constructor(generator: number[][], options?: { p?: number });
  readonly p: number;
  readonly n: number;
  readonly k: number;
  readonly generator: number[][];
  readonly parityCheck: number[][];
  readonly pivots: readonly number[];
  readonly name: string;
  readonly redundancy: number;
  encode(message: number[]): number[];
  messageOf(codeword: number[]): number[];
  syndrome(word: number[]): number[];
  isCodeword(word: number[]): boolean;
  codewords(options?: { limit?: number }): number[][];
  /** Aᵢ, the number of codewords of weight i. */
  weightDistribution(): number[];
  minimumDistance(): { distance: number; codeword: number[] };
  dual(): LinearCode;
  cosetLeaders(options?: { limit?: number }): Map<string, number[]>;
  /** Syndrome decoding, with the steps. */
  decode(received: number[]): { codeword: number[]; message: number[]; error: number[]; syndrome: number[]; steps: string[] };
  toString(): string;
}
export function linearCode(generator: number[][], options?: { p?: number }): LinearCode;
/** The Hamming code with r check symbols over Z_p: [(p^r − 1)/(p − 1), that − r, 3]. */
export function hammingCode(r: number, options?: { p?: number }): LinearCode;
export function repetitionCode(n: number, options?: { p?: number }): LinearCode;
export function parityCode(n: number, options?: { p?: number }): LinearCode;
/** Words within distance t of a word: Σ C(n, i)(q − 1)^i. */
export function ballSize(n: number, t: number, q?: number): bigint;
/** Upper (Hamming, Singleton) and lower (Gilbert–Varshamov) bounds on the size of a code. */
export function codeBounds(n: number, d: number, q?: number): { hamming: bigint; singleton: bigint; gilbertVarshamov: bigint };
export function isPerfect(code: LinearCode): boolean;
/** Reed–Solomon over Z_p, decoded by Berlekamp–Welch with the steps. */
export function reedSolomon(spec: { p: number; n: number; k: number; points?: number[] }): {
  p: number;
  n: number;
  k: number;
  points: number[];
  /** n − k + 1. */
  distance: number;
  /** ⌊(n − k)/2⌋ errors. */
  corrects: number;
  encode(message: number[]): number[];
  decode(received: number[]):
    | { message: number[]; codeword: number[]; errors: number[]; steps: string[] }
    | { failed: true; steps: string[] };
};
export function isLatinSquare(square: unknown[][]): { latin: boolean; problem: string | null };
export function areOrthogonal(a: unknown[][], b: unknown[][]): { orthogonal: boolean; repeated: unknown | null };
export function cyclicLatinSquare(n: number): number[][];
/** p − 1 mutually orthogonal Latin squares of prime order p. */
export function orthogonalLatinSquares(p: number): number[][][];
/** The parameters of a block design, with λ when every pair lies in the same number of blocks. */
export function blockDesign<T>(blocks: T[][], points?: T[]): {
  v: number;
  b: number;
  k: number | null;
  r: number | null;
  lambda: number | null;
  balanced: boolean;
  symmetric: boolean;
  checks: unknown;
};
export function fromDifferenceSet(D: number[], v: number): number[][];
/** The projective plane of prime order p: p² + p + 1 points and lines. */
export function projectivePlane(p: number): number[][];
export function affinePlane(p: number): number[][];
/** A Steiner triple system on v points (v = 7, or v ≡ 3 mod 6 by Bose's construction). */
export function steinerTripleSystem(v: number): number[][];

// ---- Boolean functions (from @ratmath/logic) ----

export { truthTable, minterms, maxterms, countModels, fromMinterms, cnf, dnf, minimize, primeImplicants } from "@ratmath/logic";
export * as logic from "@ratmath/logic";

// ---- the plan ----

export interface PlannedPhase {
  phase: number;
  contents: string;
  /** Rough size in source lines, as text ("1,200", or "600, plus 800 in graphics"). */
  estimate: string;
}

/** What is still planned for the package. */
export const plan: readonly PlannedPhase[];
