// Graphs: the structure itself, building one, and the operations that make
// new graphs from old ones.
//
// A Graph holds vertices (any whole numbers, BigInts or strings, kept in the
// order they were added) and edges. Each edge has an id, its two ends and a
// weight, an exact Core Rational that is 1 unless one was given. A graph is
// directed or not; it allows parallel edges and loops only when asked for
// (`multi`, `loops`), so a simple graph refuses them with a reason.

import { Rational } from "@ratmath/core";
import { refuse, whole } from "./counting.js";

const ONE = new Rational(1n);

/** A vertex label: a whole number (kept as a number when small), a BigInt or a string. */
export function vertexLabel(v) {
  if (typeof v === "string") return v;
  if (typeof v === "bigint") return v <= BigInt(Number.MAX_SAFE_INTEGER) && v >= -BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : v;
  if (typeof v === "number") {
    if (!Number.isInteger(v)) throw new TypeError(`a vertex is a whole number or a string, not ${v}`);
    return v;
  }
  throw new TypeError(`a vertex is a whole number or a string, not ${String(v)}`);
}

/** An edge weight as an exact Rational: numbers (whole), BigInts, text such as "3/2" or "0.25", or a Rational. */
export function toWeight(w) {
  if (w === undefined || w === null) return ONE;
  if (w instanceof Rational) return w;
  if (typeof w === "bigint") return new Rational(w);
  if (typeof w === "number") {
    if (!Number.isInteger(w)) throw new TypeError(`write the weight ${w} as text ("${w}") so that it is exact`);
    return new Rational(BigInt(w));
  }
  if (typeof w === "string" && w.trim() !== "") return new Rational(w.trim());
  if (w && typeof w.numerator === "bigint") return new Rational(w.numerator, w.denominator);
  throw new TypeError(`cannot read ${String(w)} as a weight`);
}

const show = (v) => (typeof v === "string" ? v : String(v));

export class Graph {
  #adj = new Map(); // vertex → edge ids leaving it (all incident edges when undirected)
  #in = new Map(); // vertex → edge ids entering it (directed only)
  #edges = new Map(); // id → edge
  #next = 0;

  /**
   * An empty graph. Options: directed, multi (parallel edges), loops.
   * Use `graph(spec)` or `digraph(spec)` to build one from a description.
   */
  constructor({ directed = false, multi = false, loops = false } = {}) {
    this.directed = !!directed;
    this.multi = !!multi;
    this.loops = !!loops;
    this.weighted = false;
  }

  // ---- size and membership ----
  get order() {
    return this.#adj.size;
  }
  get size() {
    return this.#edges.size;
  }
  vertices() {
    return [...this.#adj.keys()];
  }
  /** Every edge as { id, from, to, weight }, in the order added. */
  edges() {
    return [...this.#edges.values()];
  }
  hasVertex(v) {
    return this.#adj.has(vertexLabel(v));
  }
  /** The edge with this id. */
  edgeById(id) {
    return this.#edges.get(id) ?? null;
  }
  /** All edges joining u to v (from u to v when directed). */
  edgesBetween(u, v) {
    u = vertexLabel(u);
    v = vertexLabel(v);
    if (!this.#adj.has(u)) return [];
    return this.#adj.get(u).map((id) => this.#edges.get(id)).filter((e) => (e.from === u && e.to === v) || (!this.directed && e.from === v && e.to === u));
  }
  hasEdge(u, v) {
    return this.edgesBetween(u, v).length > 0;
  }
  /** The lightest edge from u to v, or null. */
  edge(u, v) {
    const es = this.edgesBetween(u, v);
    return es.length ? es.reduce((a, b) => (b.weight.lessThan(a.weight) ? b : a)) : null;
  }
  /** The weight of the lightest edge from u to v, or null when there is none. */
  weight(u, v) {
    return this.edge(u, v)?.weight ?? null;
  }

  // ---- building ----
  addVertex(...vs) {
    for (let v of vs) {
      v = vertexLabel(v);
      if (!this.#adj.has(v)) {
        this.#adj.set(v, []);
        if (this.directed) this.#in.set(v, []);
      }
    }
    return this;
  }
  /** Add an edge (and its ends, if new). Returns the graph, for chaining. */
  addEdge(u, v, weight) {
    this.#add(u, v, weight);
    return this;
  }
  #add(u, v, weight) {
    u = vertexLabel(u);
    v = vertexLabel(v);
    if (u === v && !this.loops) refuse("bad-argument", `the loop ${show(u)}–${show(u)} needs a graph made with { loops: true }`);
    if (!this.multi && this.#adj.has(u) && this.edgesBetween(u, v).length) {
      refuse("bad-argument", `there is already an edge ${show(u)}${this.directed ? "→" : "–"}${show(v)}; make the graph with { multi: true } for parallel edges`);
    }
    this.addVertex(u, v);
    if (weight !== undefined && weight !== null) this.weighted = true;
    const e = Object.freeze({ id: this.#next++, from: u, to: v, weight: toWeight(weight) });
    this.#edges.set(e.id, e);
    this.#adj.get(u).push(e.id);
    if (this.directed) this.#in.get(v).push(e.id);
    else if (u !== v) this.#adj.get(v).push(e.id);
    return e;
  }
  /** Remove a vertex and every edge at it. */
  removeVertex(v) {
    v = vertexLabel(v);
    if (!this.#adj.has(v)) return this;
    const ids = new Set([...this.#adj.get(v), ...(this.directed ? this.#in.get(v) : [])]);
    for (const id of ids) this.#drop(id);
    this.#adj.delete(v);
    if (this.directed) this.#in.delete(v);
    return this;
  }
  /** Remove one edge: give the edge (or its id), or its ends. */
  removeEdge(u, v) {
    if (u && typeof u === "object") return this.#drop(u.id), this;
    if (v === undefined && typeof u === "number" && this.#edges.has(u)) return this.#drop(u), this;
    const e = this.edgesBetween(u, v)[0];
    if (e) this.#drop(e.id);
    return this;
  }
  #drop(id) {
    const e = this.#edges.get(id);
    if (!e) return;
    this.#edges.delete(id);
    const cut = (list) => {
      const i = list.indexOf(id);
      if (i >= 0) list.splice(i, 1);
    };
    cut(this.#adj.get(e.from));
    if (this.directed) cut(this.#in.get(e.to));
    else if (e.from !== e.to) cut(this.#adj.get(e.to));
  }

  // ---- neighbourhoods ----
  #need(v) {
    v = vertexLabel(v);
    if (!this.#adj.has(v)) refuse("bad-argument", `${show(v)} is not a vertex of this graph`);
    return v;
  }
  /** Edges leaving v (every edge at v when undirected), each oriented so that `to` is the other end. */
  outEdges(v) {
    v = this.#need(v);
    return this.#adj.get(v).map((id) => {
      const e = this.#edges.get(id);
      return e.from === v ? e : { id: e.id, from: v, to: e.from, weight: e.weight };
    });
  }
  /** Edges entering v (every edge at v when undirected, oriented so that `to` is v). */
  inEdges(v) {
    v = this.#need(v);
    if (!this.directed) return this.outEdges(v).map((e) => ({ id: e.id, from: e.to, to: v, weight: e.weight }));
    return this.#in.get(v).map((id) => this.#edges.get(id));
  }
  /** The distinct vertices joined to v (out-neighbours when directed), in the order the edges were added. */
  neighbors(v) {
    return [...new Set(this.outEdges(v).map((e) => e.to))];
  }
  outNeighbors(v) {
    return this.neighbors(v);
  }
  inNeighbors(v) {
    return [...new Set(this.inEdges(v).map((e) => e.from))];
  }
  /** Edges at v, a loop counting twice. For a directed graph, in-degree plus out-degree. */
  degree(v) {
    v = this.#need(v);
    if (this.directed) return this.#adj.get(v).length + this.#in.get(v).length;
    return this.#adj.get(v).reduce((d, id) => d + (this.#edges.get(id).from === this.#edges.get(id).to ? 2 : 1), 0);
  }
  outDegree(v) {
    v = this.#need(v);
    return this.directed ? this.#adj.get(v).length : this.degree(v);
  }
  inDegree(v) {
    v = this.#need(v);
    return this.directed ? this.#in.get(v).length : this.degree(v);
  }
  /** The degrees, largest first. */
  degreeSequence() {
    return this.vertices().map((v) => this.degree(v)).sort((a, b) => b - a);
  }

  // ---- copies and views ----
  /** An independent copy. Options override directed, multi or loops. */
  copy(options = {}) {
    const g = new Graph({ directed: this.directed, multi: this.multi, loops: this.loops, ...options });
    g.addVertex(...this.vertices());
    for (const e of this.edges()) g.#add(e.from, e.to, e.weight);
    g.weighted = this.weighted;
    return g;
  }
  /** The subgraph induced by some vertices: those vertices and every edge between them. */
  subgraph(vertices) {
    const keep = new Set(vertices.map(vertexLabel));
    for (const v of keep) this.#need(v);
    const g = new Graph({ directed: this.directed, multi: this.multi, loops: this.loops });
    g.addVertex(...this.vertices().filter((v) => keep.has(v)));
    for (const e of this.edges()) if (keep.has(e.from) && keep.has(e.to)) g.#add(e.from, e.to, e.weight);
    g.weighted = this.weighted;
    return g;
  }
  /** The subgraph made of some edges (edges or ids) and their ends; `{ allVertices: true }` keeps every vertex. */
  edgeSubgraph(edges, { allVertices = false } = {}) {
    const g = new Graph({ directed: this.directed, multi: this.multi, loops: this.loops });
    if (allVertices) g.addVertex(...this.vertices());
    for (const x of edges) {
      const e = this.#edges.get(typeof x === "object" ? x.id : x);
      if (!e) refuse("bad-argument", `edge ${typeof x === "object" ? x.id : x} is not in this graph`);
      g.#add(e.from, e.to, e.weight);
    }
    g.weighted = this.weighted;
    return g;
  }
  /** The complement: the same vertices, joined exactly where this graph has no edge (no loops). */
  complement() {
    const g = new Graph({ directed: this.directed });
    const vs = this.vertices();
    g.addVertex(...vs);
    vs.forEach((u, i) => {
      vs.forEach((v, j) => {
        if (u === v || (!this.directed && j < i)) return;
        if (!this.hasEdge(u, v)) g.#add(u, v);
      });
    });
    return g;
  }
  /** A directed graph with every edge turned round. */
  reverse() {
    if (!this.directed) return this.copy();
    const g = new Graph({ directed: true, multi: this.multi, loops: this.loops });
    g.addVertex(...this.vertices());
    for (const e of this.edges()) g.#add(e.to, e.from, e.weight);
    g.weighted = this.weighted;
    return g;
  }
  /** The undirected graph underneath: directions forgotten, parallel edges merged unless `{ multi: true }`. */
  underlying({ multi = false } = {}) {
    const g = new Graph({ multi, loops: this.loops });
    g.addVertex(...this.vertices());
    for (const e of this.edges()) if (multi || !g.hasEdge(e.from, e.to)) g.#add(e.from, e.to, e.weight);
    g.weighted = this.weighted;
    return g;
  }
  /**
   * The line graph: a vertex for each edge, two joined when the edges share an
   * end (for a directed graph, when one edge ends where the other starts).
   * Vertices are labelled "u~v" (or "u→v" when directed), with "#id" added in a multigraph.
   */
  lineGraph() {
    const es = this.edges();
    const name = (e) => {
      const base = `${show(e.from)}${this.directed ? "→" : "~"}${show(e.to)}`;
      return this.multi ? `${base}#${e.id}` : base;
    };
    const g = new Graph({ directed: this.directed });
    g.addVertex(...es.map(name));
    for (let i = 0; i < es.length; i++) {
      for (let j = this.directed ? 0 : i + 1; j < es.length; j++) {
        if (i === j) continue;
        const a = es[i];
        const b = es[j];
        const meet = this.directed ? a.to === b.from : a.from === b.from || a.from === b.to || a.to === b.from || a.to === b.to;
        if (meet) g.#add(name(a), name(b));
      }
    }
    return g;
  }
  /** The adjacency matrix in the order of `vertices()`: entry (i, j) counts edges from i to j (a loop counts 2 when undirected). */
  adjacencyMatrix() {
    const vs = this.vertices();
    const at = new Map(vs.map((v, i) => [v, i]));
    const m = vs.map(() => vs.map(() => 0));
    for (const e of this.edges()) {
      const i = at.get(e.from);
      const j = at.get(e.to);
      if (this.directed) m[i][j] += 1;
      else if (i === j) m[i][i] += 2;
      else {
        m[i][j] += 1;
        m[j][i] += 1;
      }
    }
    return { vertices: vs, matrix: m };
  }
  /** The total of the edge weights, a Rational. */
  totalWeight() {
    return this.edges().reduce((s, e) => s.add(e.weight), new Rational(0n));
  }
  /** The graph written in the text form that `graph()` and `digraph()` read. */
  toString() {
    const sep = this.directed ? ">" : "-";
    const used = new Set();
    const parts = this.edges().map((e) => {
      used.add(e.from);
      used.add(e.to);
      return `${show(e.from)}${sep}${show(e.to)}${this.weighted ? `:${e.weight}` : ""}`;
    });
    for (const v of this.vertices()) if (!used.has(v)) parts.push(show(v));
    return parts.join(" ");
  }
  toJSON() {
    return { directed: this.directed, vertices: this.vertices(), edges: this.edges().map((e) => (this.weighted ? [e.from, e.to, e.weight.toString()] : [e.from, e.to])) };
  }
}

// ---- reading a description ----

function parseToken(t) {
  // digits in canonical form become numbers; "007" or "010" stays text (the cube names its vertices so)
  return /^-?(0|[1-9]\d*)$/.test(t) ? vertexLabel(BigInt(t)) : t;
}

function readText(g, text) {
  const tokens = text.split(/[\s;]+/).filter(Boolean);
  for (const tok of tokens) {
    const [body, w] = tok.split(":");
    const m = /^(.+?)(->|>|--|-)(.+)$/.exec(body);
    if (!m) {
      g.addVertex(parseToken(body));
      continue;
    }
    if ((m[2] === ">" || m[2] === "->") && !g.directed) refuse("bad-argument", `"${tok}" is a directed edge; use digraph() for a directed graph`);
    // a chain a-b-c adds a-b and b-c
    const names = body.split(/->|>|--|-/);
    for (let i = 0; i + 1 < names.length; i++) g.addEdge(parseToken(names[i]), parseToken(names[i + 1]), i + 2 === names.length ? w : undefined);
  }
}

function build(spec, options, directed) {
  const opts = { ...options };
  const g = new Graph({ directed, multi: opts.multi, loops: opts.loops });
  if (opts.vertices) g.addVertex(...opts.vertices);
  if (spec === undefined || spec === null) return g;
  if (spec instanceof Graph) return spec.copy({ directed });
  if (typeof spec === "string") {
    readText(g, spec);
    return g;
  }
  if (Array.isArray(spec)) {
    for (const e of spec) {
      if (Array.isArray(e)) g.addEdge(e[0], e[1], e[2]);
      else if (e && typeof e === "object" && "from" in e) g.addEdge(e.from, e.to, e.weight);
      else g.addVertex(e);
    }
    return g;
  }
  if (typeof spec === "object") {
    if (Array.isArray(spec.vertices) || Array.isArray(spec.edges)) return build(spec.edges ?? [], { ...opts, vertices: [...(opts.vertices ?? []), ...(spec.vertices ?? [])] }, directed);
    // adjacency: { a: ["b", "c"], b: { c: "1/2" } }
    for (const [k, nb] of Object.entries(spec)) {
      const u = parseToken(k);
      g.addVertex(u);
      const list = Array.isArray(nb) ? nb.map((v) => [v, undefined]) : Object.entries(nb ?? {}).map(([v, w]) => [parseToken(v), w]);
      for (const [v, w] of list) {
        const vv = vertexLabel(v);
        // an undirected adjacency list names each edge from both ends
        if (!directed && !g.multi && g.hasVertex(vv) && g.hasEdge(u, vv)) continue;
        g.addEdge(u, vv, w);
      }
    }
    return g;
  }
  throw new TypeError("a graph is described by text (\"a-b b-c\"), a list of edges, an adjacency object or { vertices, edges }");
}

/**
 * An undirected graph from a description:
 *   graph("a-b b-c c-a d")           text: edges, chains a-b-c, lone vertices, weights a-b:3/2,
 *                                    separated by spaces or semicolons (names may contain commas)
 *   graph([[1, 2], [2, 3, "1/2"]])   a list of edges, with optional weights
 *   graph({ a: ["b", "c"], b: ["c"] }) an adjacency object
 *   graph({ vertices, edges })
 * Options: vertices (extra vertices), multi, loops.
 */
export function graph(spec, options = {}) {
  return build(spec, options, false);
}
/** A directed graph, read as `graph` reads; in text write a>b (or a->b). */
export function digraph(spec, options = {}) {
  return build(spec, options, true);
}

// ---- combining graphs ----

const pairName = (a, b) => `${show(a)},${show(b)}`;

function productOf(g, h, joined) {
  if (g.directed !== h.directed) refuse("bad-argument", "both graphs must be directed, or neither");
  const out = new Graph({ directed: g.directed });
  const gv = g.vertices();
  const hv = h.vertices();
  for (const a of gv) for (const b of hv) out.addVertex(pairName(a, b));
  for (const a of gv) {
    for (const b of hv) {
      for (const c of gv) {
        for (const d of hv) {
          if (a === c && b === d) continue;
          const u = pairName(a, b);
          const v = pairName(c, d);
          if (!g.directed && out.hasEdge(u, v)) continue;
          if (joined(a, b, c, d)) out.addEdge(u, v);
        }
      }
    }
  }
  return out;
}
/** The Cartesian (box) product: (a, b) ~ (c, d) when a = c and b ~ d, or b = d and a ~ c. Vertices are named "a,b". */
export function cartesianProduct(g, h) {
  return productOf(g, h, (a, b, c, d) => (a === c && h.hasEdge(b, d)) || (b === d && g.hasEdge(a, c)));
}
/** The tensor (categorical) product: (a, b) ~ (c, d) when a ~ c and b ~ d. */
export function tensorProduct(g, h) {
  return productOf(g, h, (a, b, c, d) => g.hasEdge(a, c) && h.hasEdge(b, d));
}
/** The strong product: the union of the Cartesian and tensor products. */
export function strongProduct(g, h) {
  return productOf(g, h, (a, b, c, d) => (a === c || g.hasEdge(a, c)) && (b === d || h.hasEdge(b, d)));
}
/** The lexicographic product g[h]: (a, b) ~ (c, d) when a ~ c, or a = c and b ~ d. */
export function lexicographicProduct(g, h) {
  return productOf(g, h, (a, b, c, d) => g.hasEdge(a, c) || (a === c && h.hasEdge(b, d)));
}
/** Side by side, no edges between: vertices renamed "1.v" and "2.v" (or kept, with `{ rename: false }`, when they are distinct). */
export function disjointUnion(g, h, { rename = true } = {}) {
  if (g.directed !== h.directed) refuse("bad-argument", "both graphs must be directed, or neither");
  const out = new Graph({ directed: g.directed, multi: g.multi || h.multi, loops: g.loops || h.loops });
  const tag = (i, v) => (rename ? `${i}.${show(v)}` : v);
  for (const [i, x] of [[1, g], [2, h]]) {
    for (const v of x.vertices()) {
      if (!rename && out.hasVertex(v)) refuse("bad-argument", `both graphs have a vertex ${show(v)}`);
      out.addVertex(tag(i, v));
    }
    for (const e of x.edges()) out.addEdge(tag(i, e.from), tag(i, e.to), x.weighted ? e.weight : undefined);
  }
  return out;
}
/** The join: the disjoint union with every vertex of one joined to every vertex of the other. */
export function join(g, h) {
  const out = disjointUnion(g, h);
  for (const a of g.vertices()) for (const b of h.vertices()) out.addEdge(`1.${show(a)}`, `2.${show(b)}`);
  return out;
}
/** The union on shared vertex names: every vertex and edge of either (an edge in both is kept once unless multi). */
export function union(g, h) {
  if (g.directed !== h.directed) refuse("bad-argument", "both graphs must be directed, or neither");
  const out = g.copy({ multi: g.multi || h.multi, loops: g.loops || h.loops });
  out.addVertex(...h.vertices());
  for (const e of h.edges()) if (out.multi || !out.hasEdge(e.from, e.to)) out.addEdge(e.from, e.to, h.weighted ? e.weight : undefined);
  return out;
}

export { ONE };
