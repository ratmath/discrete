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

// ---- the plan ----

export interface PlannedPhase {
  phase: number;
  contents: string;
  /** Rough size in source lines, as text ("1,200", or "600, plus 800 in graphics"). */
  estimate: string;
}

/** What is still planned for the package. */
export const plan: readonly PlannedPhase[];
