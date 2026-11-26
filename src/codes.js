// Error-correcting codes and combinatorial designs.
//
// Linear codes over a prime field Z_p: a generator matrix, put in systematic
// form; the parity-check matrix; encoding; the minimum distance and weight
// distribution by listing codewords; syndrome decoding with a table of coset
// leaders, shown step by step. Hamming codes (binary and q-ary), and the
// bounds that limit what a code can do. Reed–Solomon codes over Z_p are
// decoded by the Berlekamp–Welch method, again step by step.
//
// Designs: Latin squares and mutually orthogonal sets of them, block designs
// checked against their parameters, projective and affine planes, Steiner
// triple systems by Bose's construction, and designs developed from
// difference sets.

import { refuse } from "./counting.js";

// ---- arithmetic mod p (numbers; p below 2^26 so products stay exact) --------------------------------

function field(p) {
  const P = Number(p);
  if (!Number.isInteger(P) || P < 2 || P > 2 ** 26) refuse("bad-argument", "the field size is a prime below 2^26");
  for (let d = 2; d * d <= P; d++) if (P % d === 0) refuse("bad-argument", `${P} is not prime (${d} divides it); codes here are over prime fields`);
  const mod = (a) => ((a % P) + P) % P;
  const inv = (a) => {
    let [r0, r1, s0, s1] = [mod(a), P, 1, 0];
    if (r0 === 0) refuse("not-invertible", "0 has no inverse");
    while (r1) {
      const q = Math.floor(r0 / r1);
      [r0, r1, s0, s1] = [r1, r0 - q * r1, s1, s0 - q * s1];
    }
    return mod(s0);
  };
  return { p: P, mod, add: (a, b) => mod(a + b), sub: (a, b) => mod(a - b), mul: (a, b) => mod(a * b), inv, div: (a, b) => mod(a * inv(b)), pow: (a, e) => {
    let r = 1;
    let b = mod(a);
    let k = e;
    while (k > 0) {
      if (k & 1) r = mod(r * b);
      b = mod(b * b);
      k >>= 1;
    }
    return r;
  } };
}

/** Row-reduce a matrix over Z_p in place; returns the pivot columns. */
function rref(F, M) {
  const rows = M.length;
  const cols = M[0]?.length ?? 0;
  const piv = [];
  let r = 0;
  for (let c = 0; c < cols && r < rows; c++) {
    const i = M.findIndex((row, k) => k >= r && row[c] !== 0);
    if (i < 0) continue;
    [M[r], M[i]] = [M[i], M[r]];
    const iv = F.inv(M[r][c]);
    M[r] = M[r].map((x) => F.mul(x, iv));
    for (let k = 0; k < rows; k++) if (k !== r && M[k][c] !== 0) {
      const f = M[k][c];
      M[k] = M[k].map((x, j) => F.sub(x, F.mul(f, M[r][j])));
    }
    piv.push(c);
    r++;
  }
  M.length = r;
  return piv;
}

/** Solve A x = b over Z_p; returns one solution (free variables 0) or null. */
function solveMod(F, A, b) {
  const M = A.map((row, i) => [...row, b[i]]);
  const n = A[0].length;
  const piv = rref(F, M);
  if (piv.includes(n)) return null;
  const x = new Array(n).fill(0);
  piv.forEach((c, i) => (x[c] = M[i][n]));
  return x;
}

const weight = (w) => w.reduce((s, x) => s + (x !== 0 ? 1 : 0), 0);

/**
 * A linear [n, k] code over Z_p from a generator matrix (rows span the code;
 * dependent rows are dropped).
 *   linearCode([[1,0,0,0,0,1,1], …], { p: 2 })
 */
export class LinearCode {
  constructor(generator, { p = 2 } = {}) {
    const F = field(p);
    this.F = F;
    this.p = F.p;
    const G = generator.map((r) => r.map((x) => F.mod(Number(x))));
    this.n = G[0]?.length ?? 0;
    const M = G.map((r) => r.slice());
    const piv = rref(F, M);
    this.k = M.length;
    this.generator = M; // reduced: identity on the pivot columns
    this.pivots = piv;
    // parity check: for each non-pivot column j, the row e_j − Σ (G_i[j]) e_{piv_i}
    const free = [...Array(this.n).keys()].filter((j) => !piv.includes(j));
    this.parityCheck = free.map((j) => {
      const h = new Array(this.n).fill(0);
      h[j] = 1;
      piv.forEach((c, i) => (h[c] = F.sub(0, M[i][j])));
      return h;
    });
  }
  /** The redundancy n − k. */
  get redundancy() {
    return this.n - this.k;
  }
  /** The codeword for a message of k symbols: message · G. */
  encode(message) {
    if (message.length !== this.k) refuse("bad-argument", `a message has ${this.k} symbols`);
    const F = this.F;
    return Array.from({ length: this.n }, (_, j) => message.reduce((s, m, i) => F.add(s, F.mul(F.mod(m), this.generator[i][j])), 0));
  }
  /** The message a codeword carries (read off the pivot positions). */
  messageOf(codeword) {
    return this.pivots.map((c) => codeword[c]);
  }
  /** The syndrome H·wᵀ; zero exactly for codewords. */
  syndrome(word) {
    const F = this.F;
    return this.parityCheck.map((h) => h.reduce((s, x, j) => F.add(s, F.mul(x, F.mod(word[j]))), 0));
  }
  isCodeword(word) {
    return this.syndrome(word).every((x) => x === 0);
  }
  /** Every codeword (p^k of them), up to a limit. */
  codewords({ limit = 1 << 20 } = {}) {
    const total = this.p ** this.k;
    if (total > limit) refuse("too-large", `${total} codewords is more than the limit of ${limit}`);
    const out = [];
    const m = new Array(this.k).fill(0);
    for (let t = 0; t < total; t++) {
      out.push(this.encode(m));
      for (let i = this.k - 1; i >= 0; i--) {
        m[i]++;
        if (m[i] < this.p) break;
        m[i] = 0;
      }
    }
    return out;
  }
  /** How many codewords have each weight: [A₀, A₁, …, Aₙ]. */
  weightDistribution() {
    const A = new Array(this.n + 1).fill(0);
    for (const c of this.codewords()) A[weight(c)]++;
    return A;
  }
  /** The minimum distance (the least weight of a non-zero codeword), with a codeword that has it. */
  minimumDistance() {
    let best = null;
    for (const c of this.codewords()) {
      const w = weight(c);
      if (w > 0 && (!best || w < best.distance)) best = { distance: w, codeword: c };
    }
    return best ?? { distance: Infinity, codeword: null };
  }
  /** The dual code, generated by the parity-check matrix. */
  dual() {
    return new LinearCode(this.parityCheck.length ? this.parityCheck : [new Array(this.n).fill(0)], { p: this.p });
  }
  /** The syndrome table: for each syndrome, a lightest error pattern with it (a coset leader). */
  cosetLeaders({ limit = 1 << 20 } = {}) {
    if (this._leaders) return this._leaders;
    const want = this.p ** this.redundancy;
    if (want > limit) refuse("too-large", `${want} syndromes is more than the limit`);
    const table = new Map();
    const e = new Array(this.n).fill(0);
    table.set(this.syndrome(e).join(","), e.slice());
    // error patterns by weight
    for (let w = 1; w <= this.n && table.size < want; w++) {
      const choose = (start, left, pos) => {
        if (table.size >= want) return;
        if (left === 0) {
          // all non-zero values on the chosen positions
          const vals = (i) => {
            if (i === pos.length) {
              const err = new Array(this.n).fill(0);
              pos.forEach((p2, j) => (err[p2] = cur[j]));
              const s = this.syndrome(err).join(",");
              if (!table.has(s)) table.set(s, err);
              return;
            }
            for (let v = 1; v < this.p; v++) {
              cur[i] = v;
              vals(i + 1);
            }
          };
          const cur = new Array(pos.length).fill(1);
          vals(0);
          return;
        }
        for (let i = start; i <= this.n - left; i++) choose(i + 1, left - 1, [...pos, i]);
      };
      choose(0, w, []);
    }
    this._leaders = table;
    return table;
  }
  /**
   * Syndrome decoding: the received word minus the coset leader of its
   * syndrome, which is a nearest codeword. { codeword, error, syndrome, message, steps }
   */
  decode(received) {
    const F = this.F;
    const r = received.map((x) => F.mod(Number(x)));
    const s = this.syndrome(r);
    const err = this.cosetLeaders().get(s.join(","));
    const codeword = r.map((x, i) => F.sub(x, err[i]));
    const steps = [
      `received ${r.join("")}`,
      `syndrome H·rᵀ = ${s.join("")}${s.every((x) => x === 0) ? ": a codeword, nothing to correct" : ""}`,
      `the lightest error with that syndrome is ${err.join("")} (weight ${weight(err)})`,
      `corrected codeword ${codeword.join("")}, message ${this.messageOf(codeword).join("")}`,
    ];
    return Object.freeze({ codeword, error: err, syndrome: s, message: this.messageOf(codeword), steps });
  }
  toString() {
    return `[${this.n}, ${this.k}] code over Z_${this.p}`;
  }
}
export const linearCode = (generator, options) => new LinearCode(generator, options);

/** The Hamming code with r check symbols over Z_p: length (p^r − 1)/(p − 1), distance 3, perfect. */
export function hammingCode(r, { p = 2 } = {}) {
  const P = Number(p);
  // columns: non-zero vectors of length r whose first non-zero entry is 1
  const cols = [];
  const total = P ** r;
  for (let x = 1; x < total; x++) {
    const v = [];
    let t = x;
    for (let i = 0; i < r; i++) {
      v.unshift(t % P);
      t = Math.floor(t / P);
    }
    if (v.find((y) => y !== 0) === 1) cols.push(v);
  }
  const H = Array.from({ length: r }, (_, i) => cols.map((c) => c[i]));
  const C = new LinearCode(H, { p: P }).dual();
  C.name = `Hamming(${r}) over Z_${P}`;
  return C;
}
/** The repetition code of length n. */
export const repetitionCode = (n, { p = 2 } = {}) => new LinearCode([new Array(n).fill(1)], { p });
/** The parity-check code of length n (all words whose symbols add to 0). */
export const parityCode = (n, { p = 2 } = {}) => new LinearCode(Array.from({ length: n - 1 }, (_, i) => Array.from({ length: n }, (_, j) => (j === i ? 1 : j === n - 1 ? p - 1 : 0))), { p });

const binom = (n, k) => {
  let r = 1n;
  for (let i = 0n; i < BigInt(k); i++) r = (r * (BigInt(n) - i)) / (i + 1n);
  return r;
};
/** The volume of a Hamming ball of radius t in Z_qⁿ. */
export const ballSize = (n, t, q = 2) => {
  let s = 0n;
  for (let i = 0; i <= t; i++) s += binom(n, i) * BigInt(q - 1) ** BigInt(i);
  return s;
};
/**
 * Bounds on the largest code of length n and minimum distance d over an
 * alphabet of q symbols:
 *   hamming (sphere packing): at most qⁿ / V(n, ⌊(d−1)/2⌋)
 *   singleton: at most q^(n−d+1)
 *   gilbertVarshamov: some code has at least qⁿ / V(n, d−1)
 * Sizes as BigInts (floors and ceilings).
 */
export function codeBounds(n, d, q = 2) {
  const Q = BigInt(q) ** BigInt(n);
  const t = Math.floor((d - 1) / 2);
  const vh = ballSize(n, t, q);
  const vg = ballSize(n, d - 1, q);
  return Object.freeze({ hamming: Q / vh, singleton: BigInt(q) ** BigInt(n - d + 1), gilbertVarshamov: (Q + vg - 1n) / vg });
}
/** A code meets the Hamming bound exactly. */
export function isPerfect(code) {
  const d = code.minimumDistance().distance;
  const t = Math.floor((d - 1) / 2);
  return BigInt(code.p) ** BigInt(code.k) * ballSize(code.n, t, code.p) === BigInt(code.p) ** BigInt(code.n);
}

// ---- Reed–Solomon -----------------------------------------------------------------------------------

/**
 * A Reed–Solomon code over Z_p: a message (f₀, …, f_{k−1}) is the polynomial
 * f(x) = f₀ + f₁x + …, and its codeword is (f(α₁), …, f(αₙ)) at n distinct
 * points (1, 2, …, n unless given). Distance n − k + 1, so it corrects
 * ⌊(n − k)/2⌋ errors.
 */
export function reedSolomon({ p, n, k, points }) {
  const F = field(p);
  const alpha = (points ?? Array.from({ length: n }, (_, i) => i + 1)).map(F.mod);
  if (alpha.length !== n || new Set(alpha).size !== n) refuse("bad-argument", `${n} distinct points are needed in Z_${F.p}`);
  if (k < 1 || k > n) refuse("bad-argument", "1 ≤ k ≤ n");
  const evalAt = (f, x) => f.reduceRight((acc, c) => F.add(F.mul(acc, x), c), 0);
  const t = Math.floor((n - k) / 2);
  return Object.freeze({
    p: F.p,
    n,
    k,
    points: alpha,
    distance: n - k + 1,
    corrects: t,
    encode: (message) => {
      if (message.length !== k) refuse("bad-argument", `a message has ${k} symbols`);
      return alpha.map((a) => evalAt(message.map(F.mod), a));
    },
    /**
     * Berlekamp–Welch: find E(x), monic of degree e = ⌊(n − k)/2⌋, and Q(x) of
     * degree below e + k with Q(αᵢ) = yᵢE(αᵢ) for every i. Then f = Q/E, and
     * the roots of E are where the errors were.
     * { message, codeword, errors: positions, steps } or { failed, steps }
     */
    decode: (received) => {
      const y = received.map(F.mod);
      const e = t;
      const steps = [`received ${y.join(" ")}; at most e = ${e} errors can be corrected`];
      // unknowns: Q₀ … Q_{e+k−1}, E₀ … E_{e−1} (E_e = 1)
      const A = [];
      const b = [];
      for (let i = 0; i < n; i++) {
        const row = [];
        for (let j = 0; j < e + k; j++) row.push(F.pow(alpha[i], j));
        for (let j = 0; j < e; j++) row.push(F.sub(0, F.mul(y[i], F.pow(alpha[i], j))));
        A.push(row);
        b.push(F.mul(y[i], F.pow(alpha[i], e)));
      }
      steps.push(`solve ${n} equations Q(αᵢ) = yᵢ·E(αᵢ) for ${e + k} coefficients of Q and ${e} of E`);
      const sol = solveMod(F, A, b);
      if (!sol) return Object.freeze({ failed: true, steps: [...steps, "no solution: too many errors"] });
      const Q = sol.slice(0, e + k);
      const E = [...sol.slice(e + k), 1];
      steps.push(`E(x) = ${fmt(E)}, Q(x) = ${fmt(Q)}`);
      // divide Q by E
      const q = Q.slice();
      const f = new Array(Math.max(q.length - E.length + 1, 0)).fill(0);
      for (let d = q.length - 1; d >= E.length - 1; d--) {
        const c = q[d];
        const s = d - (E.length - 1);
        f[s] = c;
        for (let j = 0; j < E.length; j++) q[s + j] = F.sub(q[s + j], F.mul(c, E[j]));
      }
      if (q.some((x) => x !== 0)) return Object.freeze({ failed: true, steps: [...steps, "E does not divide Q: too many errors"] });
      const message = Array.from({ length: k }, (_, i) => f[i] ?? 0);
      const codeword = alpha.map((a) => evalAt(message, a));
      const errors = alpha.map((a, i) => (evalAt(E, a) === 0 ? i : -1)).filter((i) => i >= 0 && codeword[i] !== y[i]);
      steps.push(`f = Q/E = ${fmt(message)}; E vanishes at ${alpha.filter((a) => evalAt(E, a) === 0).join(", ") || "no point"}`);
      steps.push(`errors at positions ${errors.join(", ") || "none"}; codeword ${codeword.join(" ")}`);
      return Object.freeze({ message, codeword, errors, steps });
    },
  });
}
const fmt = (c) => {
  const parts = [];
  for (let i = c.length - 1; i >= 0; i--) if (c[i] !== 0) parts.push(i === 0 ? `${c[i]}` : `${c[i] === 1 ? "" : c[i]}x${i > 1 ? `^${i}` : ""}`);
  return parts.join(" + ") || "0";
};

// ---- Latin squares ----------------------------------------------------------------------------------

/** Each row and each column of the n × n square holds every symbol once. { latin, problem } */
export function isLatinSquare(L) {
  const n = L.length;
  const symbols = new Set(L[0]);
  if (symbols.size !== n) return { latin: false, problem: "the first row repeats a symbol" };
  for (let i = 0; i < n; i++) {
    if (L[i].length !== n || new Set(L[i]).size !== n || L[i].some((x) => !symbols.has(x))) return { latin: false, problem: `row ${i + 1}` };
    const col = L.map((r) => r[i]);
    if (new Set(col).size !== n || col.some((x) => !symbols.has(x))) return { latin: false, problem: `column ${i + 1}` };
  }
  return { latin: true, problem: null };
}
/** Superimposing A and B gives every ordered pair of symbols exactly once. { orthogonal, repeated } */
export function areOrthogonal(A, B) {
  const n = A.length;
  const seen = new Map();
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const k = `${A[i][j]}|${B[i][j]}`;
    if (seen.has(k)) return { orthogonal: false, repeated: [seen.get(k), [i, j]] };
    seen.set(k, [i, j]);
  }
  return { orthogonal: true, repeated: null };
}
/** The cyclic Latin square L[i][j] = (i + j) mod n. */
export const cyclicLatinSquare = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i + j) % n));
/** p − 1 mutually orthogonal Latin squares of prime order p: Lₖ[i][j] = k·i + j mod p. */
export function orthogonalLatinSquares(p) {
  const F = field(p);
  return Array.from({ length: F.p - 1 }, (_, k) => Array.from({ length: F.p }, (_, i) => Array.from({ length: F.p }, (_, j) => F.add(F.mul(k + 1, i), j))));
}

// ---- block designs ------------------------------------------------------------------------------------

/**
 * Check a block design: the points, the number of blocks b, the block size k
 * (if constant), the replication r (if constant), and λ (if every pair of
 * points lies in the same number of blocks). A 2-(v, k, λ) design is
 * "balanced"; then bk = vr and r(k − 1) = λ(v − 1) must hold, and Fisher's
 * inequality b ≥ v.
 */
export function blockDesign(blocks, points) {
  const P = points ?? [...new Set(blocks.flat())].sort((a, b) => (a < b ? -1 : 1));
  const v = P.length;
  const b = blocks.length;
  const sizes = new Set(blocks.map((B) => new Set(B).size));
  const k = sizes.size === 1 ? [...sizes][0] : null;
  const rep = new Map(P.map((x) => [String(x), 0]));
  for (const B of blocks) for (const x of new Set(B)) rep.set(String(x), rep.get(String(x)) + 1);
  const reps = new Set(rep.values());
  const r = reps.size === 1 ? [...reps][0] : null;
  const pairCount = new Map();
  for (const B of blocks) {
    const s = [...new Set(B)].map(String);
    for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) {
      const key = [s[i], s[j]].sort().join("|");
      pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
    }
  }
  let lambda = null;
  const counts = new Set();
  for (let i = 0; i < v; i++) for (let j = i + 1; j < v; j++) counts.add(pairCount.get([String(P[i]), String(P[j])].sort().join("|")) ?? 0);
  if (counts.size === 1) lambda = [...counts][0];
  const balanced = k !== null && r !== null && lambda !== null && lambda > 0;
  const checks = balanced ? { bk_vr: b * k === v * r, r_k1_lambda_v1: r * (k - 1) === lambda * (v - 1), fisher: k < v ? b >= v : true } : null;
  return Object.freeze({ v, b, k, r, lambda, balanced, checks, symmetric: balanced && b === v });
}
/** Develop a difference set D modulo v: the blocks D + i, i = 0 … v − 1. */
export function fromDifferenceSet(D, v) {
  // check it is a difference set: every non-zero residue is a difference equally often
  const diffs = new Map();
  for (const a of D) for (const c of D) if (a !== c) {
    const d = (((a - c) % v) + v) % v;
    diffs.set(d, (diffs.get(d) ?? 0) + 1);
  }
  const vals = new Set([...Array(v - 1).keys()].map((i) => diffs.get(i + 1) ?? 0));
  if (vals.size !== 1) refuse("bad-argument", `{${D.join(", ")}} is not a difference set mod ${v}: the differences do not occur equally often`);
  return Array.from({ length: v }, (_, i) => D.map((x) => (x + i) % v).sort((a, b) => a - b));
}
/** The projective plane over Z_p: p² + p + 1 points and as many lines, each line with p + 1 points; points labelled 0 … */
export function projectivePlane(p) {
  const F = field(p);
  const P = F.p;
  const norm = (v) => {
    const i = v.findIndex((x) => x !== 0);
    const iv = F.inv(v[i]);
    return v.map((x) => F.mul(x, iv));
  };
  const pts = [];
  const seen = new Set();
  for (let a = 0; a < P; a++) for (let b = 0; b < P; b++) for (let c = 0; c < P; c++) {
    if (!a && !b && !c) continue;
    const v = norm([a, b, c]);
    const k = v.join(",");
    if (!seen.has(k)) {
      seen.add(k);
      pts.push(v);
    }
  }
  const lines = pts.map((l) => pts.map((x, i) => (F.add(F.add(F.mul(l[0], x[0]), F.mul(l[1], x[1])), F.mul(l[2], x[2])) === 0 ? i : -1)).filter((i) => i >= 0));
  return lines;
}
/** The affine plane over Z_p: p² points (x, y) numbered xp + y, and p² + p lines. */
export function affinePlane(p) {
  const F = field(p);
  const P = F.p;
  const lines = [];
  for (let m = 0; m < P; m++) for (let c = 0; c < P; c++) lines.push([...Array(P).keys()].map((x) => x * P + F.add(F.mul(m, x), c)));
  for (let c = 0; c < P; c++) lines.push([...Array(P).keys()].map((y) => c * P + y));
  return lines;
}
/**
 * A Steiner triple system on v = 6m + 3 points by Bose's construction (from
 * the idempotent commutative quasigroup x∘y = (x + y)/2 on Z_(2m+1)), or the
 * Fano plane for v = 7. Points 0 … v − 1.
 */
export function steinerTripleSystem(v) {
  if (v === 7) return fromDifferenceSet([0, 1, 3], 7);
  if (v % 6 !== 3) refuse("bad-argument", "this builds Steiner triple systems for v = 7 and v ≡ 3 (mod 6) (Bose)");
  const n = v / 3; // odd
  const half = (n + 1) / 2; // inverse of 2 mod n
  const op = (x, y) => ((x + y) * half) % n;
  const pt = (x, i) => x + n * i;
  const out = [];
  for (let x = 0; x < n; x++) out.push([pt(x, 0), pt(x, 1), pt(x, 2)]);
  for (let x = 0; x < n; x++) for (let y = x + 1; y < n; y++) for (let i = 0; i < 3; i++) out.push([pt(x, i), pt(y, i), pt(op(x, y), (i + 1) % 3)]);
  return out;
}
