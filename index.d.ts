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

export type Relation = "<=" | ">=" | "=" | "≤" | "≥" | "==";
export type Coefficients = FractionLike[] | Record<string, FractionLike>;
export type Constraint =
  | [Coefficients, Relation, FractionLike]
  | [Coefficients, Relation, FractionLike, string]
  | { coefficients: Coefficients; relation: Relation; rhs: FractionLike; name?: string };
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

// ---- the plan ----

export interface PlannedPhase {
  phase: number;
  contents: string;
  /** Rough size in source lines, as text ("1,200", or "600, plus 800 in graphics"). */
  estimate: string;
}

/** What is still planned for the package. */
export const plan: readonly PlannedPhase[];
