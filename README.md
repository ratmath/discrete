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

## Planned

From the [library roadmap](https://github.com/ratmath/ratmath/blob/main/docs/design/library-roadmap.md#7-a-discrete-mathematics-package-ratmathdiscrete).

| Phase | Contents |
|---|---|
| 2 | Graphs: structure, traversal, paths, trees, families |
| 3 | Generating functions and recurrences |
| 4 | Matchings, flows, colouring, planarity, isomorphism, spectra |
| 5 | Exact linear programming; matrix and bimatrix games |
| 6 | Combinatorial, extensive-form and cooperative games; voting |
| 7 | Sets, relations, partial orders; Pólya counting |
| 8 | Codes and designs |
| 9 | Graph drawing |

It depends on Core only so far; spectra and linear programming will bring in linalg. The statistics package uses it for discrete probability.

## Layout

- `index.js`, `src/`: the library. `plan` is the list above.
- `tests/`: `bun run test`.
- `docs/src/*.html`: the docs pages (overview, explore, reference, then one
  page per topic as topics are built). `bun run docs:build` writes `docs/`,
  typesets the mathematics and runs the code box at the end of every page.
  `docs/*.html` and `docs/assets/discrete.js` are build output.
- `docs/assets/runbox.js` and `scripts/docs-kit.js` are shared with the other
  RatMath docs sites and should be kept in step with them.

## Development

```sh
bun install
bun run test
bun run docs:build
```

Each topic that is built gets its own docs page with usage, the mathematics
explained, and a runnable code box at the end, and is then listed on the
[Shelf page](https://ratmath.com/shelf/).

MIT licensed.
