// Traversal and connectivity: breadth- and depth-first search, components,
// bridges and cut vertices, blocks, strong components, topological order,
// cycles, bipartiteness and distances. Every "no" comes with its witness:
// a cycle when there is no topological order, an odd cycle when a graph is
// not bipartite.
//
// All searches are iterative, so a path of a million vertices does not
// overflow the stack.

import { refuse } from "./counting.js";
import { Graph, vertexLabel } from "./graph.js";

/** Index a graph: vertices to 0…n−1, out[i] = [[j, edgeId], …], and (undirected view) und[i]. */
export function indexOf(g) {
  if (!(g instanceof Graph)) throw new TypeError("expected a Graph (make one with graph() or digraph())");
  const vs = g.vertices();
  const at = new Map(vs.map((v, i) => [v, i]));
  const out = vs.map(() => []);
  const inn = vs.map(() => []);
  const und = vs.map(() => []);
  const edges = g.edges();
  for (const e of edges) {
    const i = at.get(e.from);
    const j = at.get(e.to);
    out[i].push([j, e.id]);
    if (g.directed) inn[j].push([i, e.id]);
    else if (i !== j) out[j].push([i, e.id]);
    und[i].push([j, e.id]);
    if (i !== j) und[j].push([i, e.id]);
  }
  return { vs, at, out, inn: g.directed ? inn : out, und, edges, directed: g.directed };
}
const need = (X, v) => {
  const k = X.at.get(vertexLabel(v));
  if (k === undefined) refuse("bad-argument", `${String(v)} is not a vertex of this graph`);
  return k;
};

/**
 * Breadth-first search from a vertex (or several). Returns
 * { order, depth: Map, parent: Map } over the vertices reached. Follows edge
 * directions in a directed graph.
 */
export function bfs(g, start) {
  const X = indexOf(g);
  const starts = (Array.isArray(start) ? start : [start]).map((v) => need(X, v));
  const depth = new Map();
  const parent = new Map();
  const order = [];
  const d = new Int32Array(X.vs.length).fill(-1);
  const queue = [];
  for (const s of starts) {
    if (d[s] >= 0) continue;
    d[s] = 0;
    queue.push(s);
    parent.set(X.vs[s], null);
  }
  for (let h = 0; h < queue.length; h++) {
    const i = queue[h];
    order.push(X.vs[i]);
    depth.set(X.vs[i], d[i]);
    for (const [j] of X.out[i]) {
      if (d[j] >= 0) continue;
      d[j] = d[i] + 1;
      parent.set(X.vs[j], X.vs[i]);
      queue.push(j);
    }
  }
  return { order, depth, parent };
}

/**
 * Depth-first search. From one vertex, or (with no start) from every vertex in
 * turn, giving a forest. Returns { order (preorder), post (postorder),
 * parent: Map, discovered: Map, finished: Map } with discovery and finishing
 * times counted on one clock, as in the textbooks.
 */
export function dfs(g, start) {
  const X = indexOf(g);
  const n = X.vs.length;
  const roots = start === undefined ? [...Array(n).keys()] : (Array.isArray(start) ? start : [start]).map((v) => need(X, v));
  const seen = new Uint8Array(n);
  const order = [];
  const post = [];
  const parent = new Map();
  const discovered = new Map();
  const finished = new Map();
  let clock = 0;
  for (const r of roots) {
    if (seen[r]) continue;
    seen[r] = 1;
    parent.set(X.vs[r], null);
    discovered.set(X.vs[r], clock++);
    order.push(X.vs[r]);
    const stack = [[r, 0]];
    while (stack.length) {
      const top = stack[stack.length - 1];
      const [i, k] = top;
      if (k < X.out[i].length) {
        top[1]++;
        const j = X.out[i][k][0];
        if (seen[j]) continue;
        seen[j] = 1;
        parent.set(X.vs[j], X.vs[i]);
        discovered.set(X.vs[j], clock++);
        order.push(X.vs[j]);
        stack.push([j, 0]);
      } else {
        stack.pop();
        finished.set(X.vs[i], clock++);
        post.push(X.vs[i]);
      }
    }
  }
  return { order, post, parent, discovered, finished };
}

/** The vertices reachable from v (following directions), v included. */
export function reachable(g, v) {
  return bfs(g, v).order;
}

/** Connected components (weak components for a directed graph), each an array of vertices; the largest first. */
export function components(g) {
  const X = indexOf(g);
  const n = X.vs.length;
  const comp = new Int32Array(n).fill(-1);
  const out = [];
  for (let s = 0; s < n; s++) {
    if (comp[s] >= 0) continue;
    const list = [s];
    comp[s] = out.length;
    for (let h = 0; h < list.length; h++) {
      for (const [j] of X.und[list[h]]) {
        if (comp[j] < 0) {
          comp[j] = out.length;
          list.push(j);
        }
      }
    }
    out.push(list.map((i) => X.vs[i]));
  }
  return out.sort((a, b) => b.length - a.length);
}
/** True when there is one component (weakly connected, for a directed graph). The empty graph is not connected. */
export function isConnected(g) {
  return g.order > 0 && components(g).length === 1;
}

/**
 * Bridges, cut vertices and blocks in one depth-first pass (Hopcroft and
 * Tarjan). Directions are ignored. Parallel edges are never bridges.
 */
export function biconnected(g) {
  const X = indexOf(g);
  const n = X.vs.length;
  const disc = new Int32Array(n).fill(-1);
  const low = new Int32Array(n);
  const bridges = [];
  const cut = new Set();
  const blocks = [];
  const edgeStack = [];
  let clock = 0;
  for (let r = 0; r < n; r++) {
    if (disc[r] >= 0) continue;
    disc[r] = low[r] = clock++;
    if (X.und[r].length === 0) blocks.push([X.vs[r]]);
    let rootChildren = 0;
    const stack = [[r, -1, 0]]; // vertex, edge id used to enter it, next neighbour index
    while (stack.length) {
      const top = stack[stack.length - 1];
      const [i, via, k] = top;
      if (k < X.und[i].length) {
        top[2]++;
        const [j, id] = X.und[i][k];
        if (id === via || i === j) continue;
        if (disc[j] < 0) {
          edgeStack.push(id);
          disc[j] = low[j] = clock++;
          if (i === r) rootChildren++;
          stack.push([j, id, 0]);
        } else if (disc[j] < disc[i]) {
          edgeStack.push(id);
          low[i] = Math.min(low[i], disc[j]);
        }
      } else {
        stack.pop();
        if (!stack.length) break;
        const p = stack[stack.length - 1][0];
        low[p] = Math.min(low[p], low[i]);
        if (low[i] > disc[p]) bridges.push(X.edges.find((e) => e.id === via));
        if (low[i] >= disc[p]) {
          if (p !== r) cut.add(p);
          const ids = [];
          for (;;) {
            const id = edgeStack.pop();
            ids.push(id);
            if (id === via) break;
          }
          const vset = new Set();
          for (const id of ids) {
            const e = X.edges.find((x) => x.id === id);
            vset.add(e.from);
            vset.add(e.to);
          }
          blocks.push(X.vs.filter((v) => vset.has(v)));
        }
      }
    }
    if (rootChildren > 1) cut.add(r);
  }
  return { bridges, cutVertices: X.vs.filter((_, i) => cut.has(i)), blocks };
}
/** The edges whose removal disconnects their component. */
export function bridges(g) {
  return biconnected(g).bridges;
}
/** The vertices whose removal disconnects their component (articulation points). */
export function cutVertices(g) {
  return biconnected(g).cutVertices;
}
/** The blocks: maximal pieces with no cut vertex of their own (single edges, isolated vertices, or 2-connected subgraphs). */
export function blocks(g) {
  return biconnected(g).blocks;
}

/** Strongly connected components of a directed graph (Tarjan), in reverse topological order of the condensation. */
export function stronglyConnectedComponents(g) {
  const X = indexOf(g);
  const n = X.vs.length;
  const idx = new Int32Array(n).fill(-1);
  const low = new Int32Array(n);
  const on = new Uint8Array(n);
  const st = [];
  const out = [];
  let clock = 0;
  for (let r = 0; r < n; r++) {
    if (idx[r] >= 0) continue;
    const stack = [[r, 0]];
    idx[r] = low[r] = clock++;
    st.push(r);
    on[r] = 1;
    while (stack.length) {
      const top = stack[stack.length - 1];
      const [i, k] = top;
      if (k < X.out[i].length) {
        top[1]++;
        const j = X.out[i][k][0];
        if (idx[j] < 0) {
          idx[j] = low[j] = clock++;
          st.push(j);
          on[j] = 1;
          stack.push([j, 0]);
        } else if (on[j]) low[i] = Math.min(low[i], idx[j]);
      } else {
        stack.pop();
        if (stack.length) {
          const p = stack[stack.length - 1][0];
          low[p] = Math.min(low[p], low[i]);
        }
        if (low[i] === idx[i]) {
          const c = [];
          let j;
          do {
            j = st.pop();
            on[j] = 0;
            c.push(j);
          } while (j !== i);
          out.push(c.sort((a, b) => a - b).map((x) => X.vs[x]));
        }
      }
    }
  }
  return out;
}
/** True when every vertex reaches every other (for an undirected graph, the same as connected). */
export function isStronglyConnected(g) {
  if (!g.directed) return isConnected(g);
  return g.order > 0 && stronglyConnectedComponents(g).length === 1;
}
/**
 * The condensation: one vertex per strong component (numbered 1, 2, … in
 * topological order), an arc where some arc joins the components. Returns
 * { graph, components } with components[k − 1] the vertices of vertex k.
 */
export function condensation(g) {
  const comps = stronglyConnectedComponents(g).reverse();
  const where = new Map();
  comps.forEach((c, k) => c.forEach((v) => where.set(v, k + 1)));
  const h = new Graph({ directed: true });
  h.addVertex(...comps.map((_, k) => k + 1));
  for (const e of g.edges()) {
    const a = where.get(e.from);
    const b = where.get(e.to);
    if (a !== b && !h.hasEdge(a, b)) h.addEdge(a, b);
  }
  return { graph: h, components: comps };
}

/**
 * A topological order of a directed graph (Kahn's method, smallest position
 * first among ties), or the reason there is none:
 *   { acyclic: true, order }   or   { acyclic: false, cycle }
 * where cycle is a directed cycle [v₁, v₂, …, v₁].
 */
export function topologicalOrder(g) {
  if (!g.directed) refuse("bad-argument", "a topological order is for a directed graph");
  const X = indexOf(g);
  const n = X.vs.length;
  const indeg = new Int32Array(n);
  for (let i = 0; i < n; i++) for (const [j] of X.out[i]) indeg[j]++;
  const ready = [];
  for (let i = n - 1; i >= 0; i--) if (indeg[i] === 0) ready.push(i);
  const order = [];
  // a stack popped from the end, kept sorted descending so the earliest vertex leaves first
  while (ready.length) {
    const i = ready.pop();
    order.push(X.vs[i]);
    const freed = [];
    for (const [j] of X.out[i]) if (--indeg[j] === 0) freed.push(j);
    if (freed.length) {
      ready.push(...freed);
      ready.sort((a, b) => b - a);
    }
  }
  if (order.length === n) return { acyclic: true, order };
  return { acyclic: false, cycle: findCycle(g) };
}
/** True for a directed graph with no directed cycle (or an undirected forest). */
export function isAcyclic(g) {
  return findCycle(g) === null;
}

/**
 * A cycle, as a closed list of vertices [v₁, …, v₁], or null. Directed cycles
 * in a directed graph; in an undirected graph a loop, a pair of parallel
 * edges, or a cycle of length 3 or more.
 */
export function findCycle(g) {
  const X = indexOf(g);
  const n = X.vs.length;
  const state = new Uint8Array(n); // 0 new, 1 on the path, 2 done
  const parent = new Int32Array(n).fill(-1);
  const parentEdge = new Float64Array(n).fill(-1);
  const close = (from, to) => {
    const path = [to];
    for (let k = from; k !== to; k = parent[k]) path.push(k);
    path.push(to);
    return path.reverse().map((i) => X.vs[i]);
  };
  const adj = g.directed ? X.out : X.und;
  for (let r = 0; r < n; r++) {
    if (state[r]) continue;
    state[r] = 1;
    const stack = [[r, 0]];
    while (stack.length) {
      const top = stack[stack.length - 1];
      const [i, k] = top;
      if (k < adj[i].length) {
        top[1]++;
        const [j, id] = adj[i][k];
        if (!g.directed && id === parentEdge[i]) continue;
        if (i === j) return [X.vs[i], X.vs[i]];
        if (state[j] === 1) return close(i, j);
        if (state[j] === 0) {
          state[j] = 1;
          parent[j] = i;
          parentEdge[j] = id;
          stack.push([j, 0]);
        }
      } else {
        state[i] = 2;
        stack.pop();
      }
    }
  }
  return null;
}

/**
 * Two-colouring. { bipartite: true, parts: [A, B] }, or
 * { bipartite: false, oddCycle: [v₁, …, v₁] } as the certificate.
 * Directions are ignored.
 */
export function bipartition(g) {
  const X = indexOf(g);
  const n = X.vs.length;
  const side = new Int8Array(n).fill(-1);
  const parent = new Int32Array(n).fill(-1);
  for (let s = 0; s < n; s++) {
    if (side[s] >= 0) continue;
    side[s] = 0;
    const queue = [s];
    for (let h = 0; h < queue.length; h++) {
      const i = queue[h];
      for (const [j] of X.und[i]) {
        if (side[j] < 0) {
          side[j] = 1 - side[i];
          parent[j] = i;
          queue.push(j);
        } else if (side[j] === side[i]) {
          // walk both tree paths up to where they meet
          const up = (x) => {
            const p = [x];
            while (parent[x] >= 0) p.push((x = parent[x]));
            return p;
          };
          const a = up(i);
          const b = up(j);
          const inB = new Set(b);
          const meet = a.find((x) => inB.has(x));
          const cyc = [...a.slice(0, a.indexOf(meet) + 1), ...b.slice(0, b.indexOf(meet)).reverse(), i];
          return { bipartite: false, oddCycle: cyc.map((x) => X.vs[x]) };
        }
      }
    }
  }
  return { bipartite: true, parts: [X.vs.filter((_, i) => side[i] === 0), X.vs.filter((_, i) => side[i] === 1)] };
}
export function isBipartite(g) {
  return bipartition(g).bipartite;
}

// ---- distances counted in edges ----

/** Distances in edges from v to every vertex it reaches: a Map. */
export function distances(g, v) {
  return bfs(g, v).depth;
}
/** The number of edges on a shortest path from u to v, or Infinity. Weights are ignored (see shortestPath). */
export function distance(g, u, v) {
  return bfs(g, u).depth.get(vertexLabel(v)) ?? Infinity;
}
/** The largest distance from v; Infinity when some vertex cannot be reached. */
export function eccentricity(g, v) {
  const d = distances(g, v);
  if (d.size < g.order) return Infinity;
  return Math.max(...d.values());
}
const eccs = (g) => g.vertices().map((v) => [v, eccentricity(g, v)]);
/** The largest eccentricity. */
export function diameter(g) {
  if (!g.order) refuse("bad-argument", "the empty graph has no diameter");
  return Math.max(...eccs(g).map((x) => x[1]));
}
/** The smallest eccentricity. */
export function radius(g) {
  if (!g.order) refuse("bad-argument", "the empty graph has no radius");
  return Math.min(...eccs(g).map((x) => x[1]));
}
/** The vertices of smallest eccentricity. */
export function center(g) {
  const e = eccs(g);
  const r = Math.min(...e.map((x) => x[1]));
  return e.filter((x) => x[1] === r).map((x) => x[0]);
}
/** The vertices of largest eccentricity. */
export function periphery(g) {
  const e = eccs(g);
  const d = Math.max(...e.map((x) => x[1]));
  return e.filter((x) => x[1] === d).map((x) => x[0]);
}
/**
 * The girth: the length of a shortest cycle, with one such cycle, or
 * { girth: Infinity, cycle: null } for a forest. Directions are followed in a
 * directed graph. Loops have length 1 and parallel edges length 2.
 */
export function girth(g) {
  const X = indexOf(g);
  const n = X.vs.length;
  let best = Infinity;
  let cyc = null;
  for (const e of X.edges) {
    if (e.from === e.to) return { girth: 1, cycle: [e.from, e.from] };
  }
  const adj = g.directed ? X.out : X.und;
  for (let s = 0; s < n; s++) {
    const d = new Int32Array(n).fill(-1);
    const par = new Int32Array(n).fill(-1);
    const pe = new Float64Array(n).fill(-1);
    d[s] = 0;
    const q = [s];
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      if ((g.directed ? d[i] + 1 : 2 * d[i] + 1) >= best) break;
      for (const [j, id] of adj[i]) {
        if (g.directed) {
          if (j === s && d[i] + 1 < best) {
            best = d[i] + 1;
            const p = [s];
            for (let k = i; k !== s; k = par[k]) p.push(k);
            cyc = [s, ...p.slice(1).reverse(), s].map((x) => X.vs[x]);
          }
          if (d[j] < 0) {
            d[j] = d[i] + 1;
            par[j] = i;
            q.push(j);
          }
          continue;
        }
        if (id === pe[i]) continue;
        if (d[j] < 0) {
          d[j] = d[i] + 1;
          par[j] = i;
          pe[j] = id;
          q.push(j);
        } else if (d[i] + d[j] + 1 < best) {
          // two tree paths from s, joined by this edge; a true cycle when they meet only at s
          const pi = [];
          for (let k = i; k >= 0; k = par[k]) pi.push(k);
          const pj = [];
          for (let k = j; k >= 0; k = par[k]) pj.push(k);
          const setj = new Set(pj);
          const meet = pi.find((x) => setj.has(x));
          if (meet !== s) continue;
          best = d[i] + d[j] + 1;
          cyc = [...pi.reverse(), ...pj].map((x) => X.vs[x]);
        }
      }
    }
  }
  return { girth: best, cycle: cyc };
}
