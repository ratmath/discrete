// What this package is planned to contain, phase by phase, from the RatMath
// library roadmap. Phase 1 is built; a phase is removed from this list
// when it ships, and the list goes away when it is empty.

export const plan = Object.freeze([
  {
    "phase": 2,
    "contents": "Graphs: structure, traversal, paths, trees, families",
    "estimate": "1,300"
  },
  {
    "phase": 3,
    "contents": "Generating functions and recurrences",
    "estimate": "900"
  },
  {
    "phase": 4,
    "contents": "Matchings, flows, colouring, planarity, isomorphism, spectra",
    "estimate": "1,600"
  },
  {
    "phase": 5,
    "contents": "Exact linear programming; matrix and bimatrix games",
    "estimate": "1,100"
  },
  {
    "phase": 6,
    "contents": "Combinatorial, extensive-form and cooperative games; voting",
    "estimate": "1,000"
  },
  {
    "phase": 7,
    "contents": "Sets, relations, partial orders; Pólya counting",
    "estimate": "600"
  },
  {
    "phase": 8,
    "contents": "Codes and designs",
    "estimate": "700"
  },
  {
    "phase": 9,
    "contents": "Graph drawing",
    "estimate": "900 in graphics"
  }
].map(Object.freeze));
