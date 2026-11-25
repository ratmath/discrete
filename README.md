# @ratmath/discrete

Counting, graphs and games for [RatMath](https://ratmath.com/), part of the
[RatMath Shelf](https://ratmath.com/shelf/).

**Status: set up, nothing built yet.** This repository holds the package
skeleton and the docs site. The plan is in the
[library roadmap](https://github.com/ratmath/ratmath/blob/main/docs/design/library-roadmap.md#7-a-discrete-mathematics-package-ratmathdiscrete).

Combinatorics, graph theory and game theory in one library: exact counts of any size, objects you can list, rank and sample, graph algorithms with certificates, and games solved in exact fractions.

## Planned

| Phase | Contents |
|---|---|
| 1 | Counting, enumeration with ranking, the seeded generator |
| 2 | Graphs: structure, traversal, paths, trees, families |
| 3 | Generating functions and recurrences |
| 4 | Matchings, flows, colouring, planarity, isomorphism, spectra |
| 5 | Exact linear programming; matrix and bimatrix games |
| 6 | Combinatorial, extensive-form and cooperative games; voting |
| 7 | Sets, relations, partial orders; Pólya counting |
| 8 | Codes and designs |
| 9 | Graph drawing |

It will depend on: Core, and linalg for spectra and linear programming. The statistics package uses it for discrete probability.

## Layout

- `index.js`, `src/`: the library. For now it exports only `plan`, the list
  above, so that the tests and the docs build have something to load.
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
