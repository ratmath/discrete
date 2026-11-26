# Changelog

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
