// Planarity. A planar graph comes with its faces (an embedding, checked by
// Euler's formula); a non-planar one comes with a Kuratowski subgraph, a
// subdivision of K₅ or K₃,₃, which by Kuratowski's theorem is exactly what
// stops a graph being drawn without crossings.
//
// The test is Demoucron, Malgrange and Pertuiset's (1964), run on each block:
// start from a cycle, and repeatedly draw a path of what is left inside a face
// that can take all of its attachments, choosing a piece with only one such
// face whenever there is one. If some piece has no face, the block is not
// planar. It is quadratic, which is plenty for the graphs met in teaching.
// The Kuratowski subgraph is found by deleting every edge whose removal leaves
// the graph non-planar; what remains is minimal, hence a subdivision.

import { refuse } from "./counting.js";
import { indexOf } from "./traverse.js";

const ekey = (a, b) => (a < b ? `${a},${b}` : `${b},${a}`);

/** Blocks of a simple graph on 0..n−1 given as an edge list: each block an edge list. */
function edgeBlocks(n, E) {
  const adj = Array.from({ length: n }, () => []);
  E.forEach(([a, b], i) => {
    adj[a].push([b, i]);
    adj[b].push([a, i]);
  });
  const disc = new Array(n).fill(-1);
  const low = new Array(n).fill(0);
  let time = 0;
  const stack = [];
  const out = [];
  const dfs = (u, pe) => {
    disc[u] = low[u] = time++;
    for (const [v, ei] of adj[u]) {
      if (ei === pe) continue;
      if (disc[v] === -1) {
        stack.push(ei);
        dfs(v, ei);
        low[u] = Math.min(low[u], low[v]);
        if (low[v] >= disc[u]) {
          const blk = [];
          let x;
          do {
            x = stack.pop();
            blk.push(E[x]);
          } while (x !== ei);
          out.push(blk);
        }
      } else if (disc[v] < disc[u]) {
        stack.push(ei);
        low[u] = Math.min(low[u], disc[v]);
      }
    }
  };
  for (let s = 0; s < n; s++) if (disc[s] === -1) dfs(s, -1);
  return out;
}

/** DMP on one 2-connected block (edge list). Returns faces (vertex cycles) or null when not planar. */
function embedBlock(E) {
  if (E.length < 3) return [E[0] ? [E[0][0], E[0][1]] : []];
  const adj = new Map();
  for (const [a, b] of E) {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push(b);
    adj.get(b).push(a);
  }
  // a cycle: DFS until a back edge
  const parent = new Map();
  const depth = new Map();
  let cycle = null;
  const start = E[0][0];
  const st = [[start, null]];
  depth.set(start, 0);
  const visit = (u, p) => {
    for (const v of adj.get(u)) {
      if (cycle) return;
      if (v === p) continue;
      if (depth.has(v)) {
        if (depth.get(v) < depth.get(u)) {
          cycle = [u];
          let x = u;
          while (x !== v) {
            x = parent.get(x);
            cycle.push(x);
          }
        }
        continue;
      }
      parent.set(v, u);
      depth.set(v, depth.get(u) + 1);
      visit(v, u);
    }
  };
  void st;
  visit(start, null);
  const inH = new Set(cycle);
  const embedded = new Set();
  for (let i = 0; i < cycle.length; i++) embedded.add(ekey(cycle[i], cycle[(i + 1) % cycle.length]));
  let faces = [cycle.slice(), cycle.slice()];
  for (;;) {
    if (embedded.size === E.length) return faces;
    // fragments
    const frags = [];
    for (const [a, b] of E) if (!embedded.has(ekey(a, b)) && inH.has(a) && inH.has(b)) frags.push({ inner: [], attach: [a, b], edge: [a, b] });
    const seen = new Set();
    for (const v of adj.keys()) {
      if (inH.has(v) || seen.has(v)) continue;
      const inner = [v];
      seen.add(v);
      const attach = new Set();
      for (let i = 0; i < inner.length; i++) for (const t of adj.get(inner[i])) {
        if (inH.has(t)) attach.add(t);
        else if (!seen.has(t)) {
          seen.add(t);
          inner.push(t);
        }
      }
      frags.push({ inner, attach: [...attach] });
    }
    let choice = null;
    for (const f of frags) {
      const ok = faces.filter((F) => f.attach.every((a) => F.includes(a)));
      if (!ok.length) return null;
      if (!choice || ok.length < choice.faces.length) choice = { f, faces: ok };
      if (ok.length === 1) break;
    }
    const { f } = choice;
    const F = choice.faces[0];
    // a path between two attachments through the fragment
    let path;
    if (f.edge) path = f.edge;
    else {
      const a = f.attach[0];
      const b = f.attach[1];
      const innerSet = new Set(f.inner);
      const prev = new Map([[a, null]]);
      const q = [a];
      let found = false;
      for (let h = 0; h < q.length && !found; h++) {
        const u = q[h];
        for (const t of adj.get(u)) {
          if (prev.has(t)) continue;
          if (t === b && u !== a) {
            prev.set(t, u);
            found = true;
            break;
          }
          if (innerSet.has(t)) {
            prev.set(t, u);
            q.push(t);
          }
        }
      }
      path = [];
      for (let x = b; x !== null; x = prev.get(x)) path.unshift(x);
    }
    // split the face
    const a = path[0];
    const b = path[path.length - 1];
    const i = F.indexOf(a);
    const j = F.indexOf(b);
    const arc = (from, to) => {
      const out = [];
      for (let k = from; ; k = (k + 1) % F.length) {
        out.push(F[k]);
        if (k === to) break;
      }
      return out;
    };
    const mid = path.slice(1, -1);
    const F1 = [...arc(i, j), ...mid.slice().reverse()];
    const F2 = [...arc(j, i), ...mid];
    faces = faces.filter((x) => x !== F);
    faces.push(F1, F2);
    for (let k = 0; k + 1 < path.length; k++) embedded.add(ekey(path[k], path[k + 1]));
    for (const v of mid) inH.add(v);
  }
}

function planarEdges(n, E) {
  const faces = [];
  for (const blk of edgeBlocks(n, E)) {
    const f = embedBlock(blk);
    if (!f) return null;
    if (blk.length >= 3) faces.push(f);
  }
  return faces;
}

/**
 * Is the graph planar? Directions, weights, loops and parallel edges are
 * ignored (none of them affects planarity).
 *   { planar: true, faces: [[…], …] per block, check: Euler's formula }
 *   { planar: false, kuratowski: { kind: "K5" | "K3,3", branch: [...], paths: [[…], …], edges } }
 */
export function planarity(g) {
  const X = indexOf(g);
  const n = X.vs.length;
  const set = new Set();
  const E = [];
  for (const e of X.edges) {
    const a = X.at.get(e.from);
    const b = X.at.get(e.to);
    if (a === b) continue;
    const k = ekey(a, b);
    if (!set.has(k)) {
      set.add(k);
      E.push([a, b]);
    }
  }
  const name = (i) => X.vs[i];
  const quickNo = n >= 3 && E.length > 3 * n - 6;
  const faces = quickNo ? null : planarEdges(n, E);
  if (faces) {
    // Euler's formula on each block: V − E + F = 2
    const blocks = edgeBlocks(n, E).filter((b) => b.length >= 3);
    blocks.forEach((b, i) => {
      const V = new Set(b.flat()).size;
      if (V - b.length + faces[i].length !== 2) throw new Error("internal: the embedding breaks Euler's formula");
    });
    return Object.freeze({ planar: true, faces: faces.map((fs) => fs.map((f) => f.map(name))), edges: E.length, vertices: n });
  }
  // a minimal non-planar subgraph
  let keep = E.slice();
  for (let i = 0; i < keep.length; ) {
    const trial = keep.filter((_, k) => k !== i);
    if (!planarEdges(n, trial)) keep = trial;
    else i++;
  }
  return Object.freeze({ planar: false, kuratowski: describeKuratowski(keep, name) });
}
export const isPlanar = (g) => planarity(g).planar;

function describeKuratowski(E, name) {
  const adj = new Map();
  for (const [a, b] of E) {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push(b);
    adj.get(b).push(a);
  }
  const branch = [...adj.keys()].filter((v) => adj.get(v).length >= 3);
  const isBranch = new Set(branch);
  const paths = [];
  const used = new Set();
  for (const s of branch) for (const t of adj.get(s)) {
    if (used.has(ekey(s, t))) continue;
    const path = [s, t];
    used.add(ekey(s, t));
    let prev = s;
    let cur = t;
    while (!isBranch.has(cur)) {
      const nxt = adj.get(cur).find((x) => x !== prev);
      used.add(ekey(cur, nxt));
      path.push(nxt);
      prev = cur;
      cur = nxt;
    }
    paths.push(path);
  }
  const kind = branch.length === 5 && branch.every((v) => adj.get(v).length === 4) ? "K5" : branch.length === 6 && branch.every((v) => adj.get(v).length === 3) ? "K3,3" : "unknown";
  if (kind === "unknown") throw new Error("internal: the minimal non-planar subgraph is not a Kuratowski subdivision");
  return Object.freeze({ kind, branch: branch.map(name), paths: paths.map((p) => p.map(name)), edges: E.map(([a, b]) => [name(a), name(b)]) });
}

/**
 * Check a Kuratowski witness against the graph with nothing but counting: its
 * edges are edges of g, its paths are internally disjoint and use those edges,
 * and the branch vertices are joined as K₅ (every pair) or K₃,₃ (two sides of
 * three, every pair across) by the paths. { ok, errors }.
 */
export function checkKuratowski(g, w) {
  const errors = [];
  for (const [a, b] of w.edges) if (!g.hasEdge(a, b) && !g.hasEdge(b, a)) errors.push(`${a}–${b} is not an edge`);
  const branch = new Set(w.branch.map(String));
  const inner = new Set();
  const pairs = new Set();
  for (const p of w.paths) {
    for (let i = 0; i + 1 < p.length; i++) if (!g.hasEdge(p[i], p[i + 1]) && !g.hasEdge(p[i + 1], p[i])) errors.push(`${p[i]}–${p[i + 1]} is not an edge`);
    for (const v of p.slice(1, -1)) {
      if (branch.has(String(v)) || inner.has(String(v))) errors.push(`${v} is used twice`);
      inner.add(String(v));
    }
    pairs.add([String(p[0]), String(p[p.length - 1])].sort().join("|"));
  }
  const B = w.branch.map(String);
  if (w.kind === "K5") {
    if (B.length !== 5 || pairs.size !== 10 || w.paths.length !== 10) errors.push("K₅ needs five branch vertices joined in all ten pairs");
  } else {
    if (B.length !== 6 || pairs.size !== 9 || w.paths.length !== 9) errors.push("K₃,₃ needs six branch vertices joined in nine pairs");
    // the pairs must form a complete bipartite graph: colour by non-adjacency
    const adjB = new Map(B.map((b) => [b, new Set()]));
    for (const p of pairs) {
      const [x, y] = p.split("|");
      adjB.get(x)?.add(y);
      adjB.get(y)?.add(x);
    }
    const side = B.filter((b) => !adjB.get(B[0]).has(b));
    if (side.length !== 3 || side.some((x) => side.some((y) => adjB.get(x).has(y)))) errors.push("the branch vertices do not split into two sides of three");
  }
  return { ok: errors.length === 0, errors };
}
void refuse;

// ---- genus: embeddings on surfaces with handles, by rotation systems ----------------------
//
// A rotation system gives each vertex a cyclic order of its neighbours. It
// describes a drawing of the graph on an orientable surface without
// crossings: walk along an edge into a vertex and leave by the neighbour that
// comes next in that vertex's order, and the walks close up into the faces.
// With F faces, V − E + F = 2 − 2g gives the genus g of the surface. Every
// such drawing arises this way, so the genus of the graph is the least g
// over all rotation systems: a finite search.
//
// The genus of a graph is the sum of the genera of its blocks (Battle,
// Harary, Kodama and Youngs), so each block is treated on its own. For a
// block the bounds are
//   below: 0 if planar, else the larger of 1 and ⌈(E·(1 − 2/girth) − V + 2)/2⌉,
//          because every face has at least `girth` sides;
//   above: the genus of the best rotation system found.
// A small block is searched completely, and the search stops early when the
// lower bound is met. A large one is searched by exchanging neighbours in one
// rotation at a time; the answer is then proven only if the two bounds meet.

/** Faces of a rotation system on 0..n−1: rot[v] is the cyclic list of neighbours. Each face is a list of vertices. */
function traceFaces(rot, wantFaces = false) {
  const n = rot.length;
  const pos = rot.map((r) => new Map(r.map((w, i) => [w, i])));
  const seen = rot.map((r) => new Uint8Array(r.length)); // dart (v → r[i])
  let count = 0;
  const faces = [];
  for (let v = 0; v < n; v++) {
    for (let i = 0; i < rot[v].length; i++) {
      if (seen[v][i]) continue;
      count++;
      const face = [];
      let [a, k] = [v, i];
      while (!seen[a][k]) {
        seen[a][k] = 1;
        if (wantFaces) face.push(a);
        const b = rot[a][k];
        // arriving at b from a: leave by the neighbour after a in b's order
        const j = (pos[b].get(a) + 1) % rot[b].length;
        [a, k] = [b, j];
      }
      if (wantFaces) faces.push(face);
    }
  }
  return wantFaces ? faces : count;
}

function girthOf(n, adj) {
  let best = Infinity;
  for (let s = 0; s < n; s++) {
    const dist = new Array(n).fill(-1);
    const par = new Array(n).fill(-1);
    dist[s] = 0;
    const queue = [s];
    for (let h = 0; h < queue.length; h++) {
      const u = queue[h];
      for (const w of adj[u]) {
        if (dist[w] === -1) {
          dist[w] = dist[u] + 1;
          par[w] = u;
          queue.push(w);
        } else if (par[u] !== w) best = Math.min(best, dist[u] + dist[w] + 1);
      }
    }
  }
  return best;
}

/** One block (edge list on its own vertices 0..n−1): { genus, lower, upper, rot, searched }. */
function blockGenus(n, E, limit) {
  const adj = Array.from({ length: n }, () => []);
  for (const [a, b] of E) {
    adj[a].push(b);
    adj[b].push(a);
  }
  const m = E.length;
  const facesToGenus = (F) => (2 - n + m - F) / 2;
  if (m < 3 || planarEdges(n, E)) {
    // planar: find a rotation system with V − E + F = 2 by the same search (small) or report without one
    const girth = m >= 3 ? girthOf(n, adj) : Infinity;
    return { lower: 0, upper: 0, girth, rot: null, method: "planar" };
  }
  const girth = girthOf(n, adj);
  const lower = Math.max(1, Math.ceil((m * (1 - 2 / girth) - n + 2) / 2 - 1e-9));
  const target = m - n + 2 - 2 * lower; // the number of faces a genus-`lower` embedding has
  // the number of rotation systems, first neighbour fixed at each vertex
  let total = 1;
  for (const a of adj) for (let k = 2; k < a.length; k++) total = Math.min(total * k, Number.MAX_SAFE_INTEGER);
  let best = { F: -1, rot: null };
  const take = (rot) => {
    const F = traceFaces(rot);
    if (F > best.F) best = { F, rot: rot.map((r) => r.slice()) };
    return F >= target;
  };
  if (total <= limit) {
    // every rotation system: permute the neighbours after the first, vertex by vertex
    const rot = adj.map((a) => a.slice());
    const order = [...adj.keys()].filter((v) => adj[v].length > 2);
    let done = false;
    const rec = (idx) => {
      if (done) return;
      if (idx === order.length) {
        if (take(rot)) done = true;
        return;
      }
      const v = order[idx];
      const r = rot[v];
      const permute = (k) => {
        if (done) return;
        if (k === r.length) return rec(idx + 1);
        for (let i = k; i < r.length; i++) {
          [r[k], r[i]] = [r[i], r[k]];
          permute(k + 1);
          [r[k], r[i]] = [r[i], r[k]];
        }
      };
      permute(1);
    };
    rec(0);
    const upper = facesToGenus(best.F);
    return { lower: upper, upper, girth, rot: best.rot, method: done ? "the lower bound is met by an embedding" : `all ${total} rotation systems were examined`, searched: total };
  }
  // too many to list: improve a rotation system by exchanging two neighbours at a vertex (a fixed pseudo-random sequence)
  let state = 0x9e3779b9;
  const rand = (k) => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state % k;
  };
  const busy = [...adj.keys()].filter((v) => adj[v].length > 2);
  let tries = 0;
  outer: for (let restart = 0; restart < 40; restart++) {
    const rot = adj.map((a) => {
      const r = a.slice();
      for (let i = r.length - 1; i > 0; i--) {
        const j = rand(i + 1);
        [r[i], r[j]] = [r[j], r[i]];
      }
      return r;
    });
    let F = traceFaces(rot);
    if (take(rot)) break;
    for (let step = 0; step < 4000; step++) {
      tries++;
      const v = busy[rand(busy.length)];
      const r = rot[v];
      const i = rand(r.length);
      let j = rand(r.length - 1);
      if (j >= i) j++;
      [r[i], r[j]] = [r[j], r[i]];
      const G = traceFaces(rot);
      if (G >= F) {
        F = G;
        if (take(rot)) break outer;
      } else [r[i], r[j]] = [r[j], r[i]];
    }
  }
  const upper = facesToGenus(best.F);
  return { lower, upper, girth, rot: best.rot, method: upper === lower ? "the lower bound is met by an embedding" : "bounds only: the search by exchanges did not reach the lower bound", searched: tries };
}

/**
 * The genus of a graph: the least number of handles on a sphere that lets
 * it be drawn without crossings.
 *
 *   genus(complete(5))   // { genus: 1, proven: true, lower: 1, upper: 1, blocks: [{ …, rotation, faces }] }
 *
 * `proven` is true when the lower and upper bounds agree; `genus` is then the
 * genus, and otherwise null with the bounds. Each non-planar block comes with
 * the rotation system of its best embedding and that embedding's faces, which
 * `embeddingGenus` checks on its own. Directions, weights, loops and parallel
 * edges are ignored. `limit` is the largest number of rotation systems
 * examined one by one (default 2 000 000).
 */
export function genus(g, { limit = 2000000 } = {}) {
  const X = indexOf(g);
  const n = X.vs.length;
  const set = new Set();
  const E = [];
  for (const e of X.edges) {
    const a = X.at.get(e.from);
    const b = X.at.get(e.to);
    if (a === b) continue;
    const k = ekey(a, b);
    if (!set.has(k)) {
      set.add(k);
      E.push([a, b]);
    }
  }
  let lower = 0;
  let upper = 0;
  const blocks = [];
  for (const blk of edgeBlocks(n, E)) {
    const ids = [...new Set(blk.flat())].sort((p, q) => p - q);
    const local = new Map(ids.map((v, i) => [v, i]));
    const r = blockGenus(ids.length, blk.map(([a, b]) => [local.get(a), local.get(b)]), limit);
    lower += r.lower;
    upper += r.upper;
    if (r.method === "planar") continue;
    const name = (i) => X.vs[ids[i]];
    blocks.push({
      vertices: ids.map((v) => X.vs[v]),
      edges: blk.length,
      girth: r.girth,
      lower: r.lower,
      upper: r.upper,
      method: r.method,
      searched: r.searched,
      rotation: Object.fromEntries(r.rot.map((list, i) => [name(i), list.map(name)])),
      faces: traceFaces(r.rot, true).map((f) => f.map(name)),
    });
  }
  const proven = lower === upper;
  return Object.freeze({
    genus: proven ? upper : null,
    proven,
    lower,
    upper,
    planar: upper === 0,
    blocks,
    reason: upper === 0 ? "the graph is planar" : proven ? `V − E + F = 2 − 2g for the embedding found, and no embedding has fewer handles (${blocks.map((b) => b.method).join("; ")})` : `the genus is between ${lower} and ${upper}: the best embedding found has genus ${upper}, and Euler's formula with the girth gives at least ${lower}`,
  });
}

/**
 * The genus of the surface a rotation system draws the graph on, with its
 * faces: { genus, faces, vertices, edges, euler }. `rotation` maps each
 * vertex to the cyclic list of its neighbours; it must list every neighbour
 * exactly once. The graph must be connected.
 */
export function embeddingGenus(g, rotation) {
  const X = indexOf(g);
  const n = X.vs.length;
  const nbrs = X.vs.map(() => new Set());
  for (const e of X.edges) {
    const a = X.at.get(e.from);
    const b = X.at.get(e.to);
    if (a !== b) {
      nbrs[a].add(b);
      nbrs[b].add(a);
    }
  }
  const get = (v) => (rotation instanceof Map ? rotation.get(v) : rotation[v]);
  const rot = X.vs.map((v, i) => {
    const list = (get(v) ?? []).map((w) => X.at.get(w));
    if (list.some((w) => w === undefined) || list.length !== nbrs[i].size || new Set(list).size !== list.length || list.some((w) => !nbrs[i].has(w))) refuse("bad-argument", `the rotation at ${v} must list each neighbour of ${v} exactly once`);
    return list;
  });
  const seen = new Uint8Array(n);
  const stack = [0];
  seen[0] = 1;
  let reached = n ? 1 : 0;
  while (stack.length) for (const w of nbrs[stack.pop()]) if (!seen[w]) (seen[w] = 1), reached++, stack.push(w);
  if (reached !== n) refuse("bad-argument", "the graph must be connected: a rotation system describes one surface");
  const faces = traceFaces(rot, true);
  const m = nbrs.reduce((s, x) => s + x.size, 0) / 2;
  const euler = n - m + faces.length;
  return { genus: (2 - euler) / 2, faces: faces.map((f) => f.map((i) => X.vs[i])), vertices: n, edges: m, euler };
}
