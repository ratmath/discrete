// Exact linear programming: a rational simplex method that returns, with every
// answer, the certificate that proves it.
//
//   optimal     the solution x and the dual solution y (shadow prices), with
//               c·x = b·y. Weak duality makes the pair a proof: no feasible
//               point does better than b·y, and x reaches it.
//   infeasible  a Farkas vector y: a combination of the constraints that
//               says 0 ≤ (something negative).
//   unbounded   a feasible point and a ray: moving along the ray stays
//               feasible and improves the objective for ever.
//
// `checkLinearProgram` checks a certificate against the problem using only
// arithmetic on the constraints; it never runs the simplex method. Every
// result's `check()` calls it.
//
// The method is the two-phase simplex method on a tableau of Core Rationals,
// with Bland's rule, so it cannot cycle. Integer programs are solved by branch
// and bound on top of it, for small problems.

import { Rational } from "@ratmath/core";
import { refuse } from "./counting.js";
import { toWeight } from "./graph.js";

const ZERO = new Rational(0n);
const ONE = new Rational(1n);
const sgn = (r) => (r.numerator > 0n ? 1 : r.numerator < 0n ? -1 : 0);
const isZero = (r) => r.numerator === 0n;
const sum = (xs) => xs.reduce((a, b) => a.add(b), ZERO);
const dot = (a, b) => a.reduce((s, v, i) => (isZero(v) || isZero(b[i]) ? s : s.add(v.multiply(b[i]))), ZERO);

/** Read a number exactly: integers, BigInts, text such as "2/3" or "0.25", Rationals. */
export function exact(v, what = "value") {
  try {
    if (typeof v === "number" && !Number.isInteger(v) && Number.isFinite(v)) return new Rational(String(v));
    return toWeight(v);
  } catch {
    refuse("not-exact", `cannot read ${String(v)} as an exact ${what}`);
  }
}

const RELATIONS = { "<=": "<=", "≤": "<=", ">=": ">=", "≥": ">=", "=": "=", "==": "=" };

/**
 * Normalise a problem. Accepts
 *   { maximize | minimize: [c…] or { name: c },
 *     constraints: [ [coefficients, relation, rhs] | { coefficients, relation, rhs, name } ],
 *     names?: [...], free?: [names or indices] }
 * where coefficients are an array or an object keyed by variable name.
 */
export function parseProblem(problem) {
  if (problem instanceof Problem) return problem;
  if (!problem || typeof problem !== "object") refuse("bad-problem", "a linear program is an object with maximize or minimize, and constraints");
  const sense = "maximize" in problem ? "maximize" : "minimize" in problem ? "minimize" : null;
  if (!sense) refuse("bad-problem", "say maximize or minimize");
  const objective = problem[sense];
  const raw = (problem.constraints ?? problem.subjectTo ?? []).map((c, i) => {
    if (Array.isArray(c)) return { coefficients: c[0], relation: c[1], rhs: c[2], name: c[3] ?? `c${i + 1}` };
    return { name: `c${i + 1}`, ...c };
  });
  // the variable names: given, or from the object keys in order of appearance, or x1, x2, …
  let names = problem.names ? [...problem.names].map(String) : null;
  if (!names) {
    const keyed = [objective, ...raw.map((c) => c.coefficients)].filter((v) => v && !Array.isArray(v));
    if (keyed.length) {
      const seen = [];
      for (const o of keyed) for (const k of Object.keys(o)) if (!seen.includes(k)) seen.push(k);
      names = seen;
    } else {
      const n = Math.max(Array.isArray(objective) ? objective.length : 0, ...raw.map((c) => c.coefficients.length));
      names = Array.from({ length: n }, (_, i) => `x${i + 1}`);
    }
  }
  const n = names.length;
  const vec = (v, what) => {
    if (Array.isArray(v)) {
      if (v.length > n) refuse("bad-problem", `${what} has ${v.length} coefficients for ${n} variables`);
      return names.map((_, j) => (j < v.length ? exact(v[j], "coefficient") : ZERO));
    }
    for (const k of Object.keys(v)) if (!names.includes(k)) refuse("bad-problem", `${what} names an unknown variable ${k}`);
    return names.map((k) => (k in v ? exact(v[k], "coefficient") : ZERO));
  };
  const c = vec(objective, "the objective");
  const rows = raw.map((r) => {
    const rel = RELATIONS[r.relation];
    if (!rel) refuse("bad-problem", `unknown relation ${r.relation}: use "<=", ">=" or "="`);
    return Object.freeze({ name: String(r.name), a: Object.freeze(vec(r.coefficients, `constraint ${r.name}`)), relation: rel, b: exact(r.rhs, "right-hand side") });
  });
  const free = new Array(n).fill(false);
  for (const f of problem.free ?? []) {
    const j = typeof f === "number" ? f : names.indexOf(String(f));
    if (j < 0 || j >= n) refuse("bad-problem", `free names an unknown variable ${f}`);
    free[j] = true;
  }
  return new Problem(sense, names, c, rows, free);
}

export class Problem {
  constructor(sense, names, c, rows, free) {
    this.sense = sense;
    this.names = Object.freeze(names);
    this.c = Object.freeze(c);
    this.rows = Object.freeze(rows);
    this.free = Object.freeze(free);
    Object.freeze(this);
  }
  /** The same problem with more constraints. */
  withRows(more) {
    return new Problem(this.sense, this.names, this.c, [...this.rows, ...more], this.free);
  }
  toString() {
    const term = (a) =>
      a
        .map((v, j) => (isZero(v) ? null : `${sgn(v) < 0 ? "− " : "+ "}${v.abs().equals(ONE) ? "" : `${v.abs()}·`}${this.names[j]}`))
        .filter(Boolean)
        .join(" ")
        .replace(/^\+ /, "")
        .replace(/^− /, "−") || "0";
    const lines = [`${this.sense} ${term(this.c)}`];
    for (const r of this.rows) lines.push(`  ${r.name}: ${term(r.a)} ${r.relation === "<=" ? "≤" : r.relation === ">=" ? "≥" : "="} ${r.b}`);
    const nonneg = this.names.filter((_, j) => !this.free[j]);
    if (nonneg.length) lines.push(`  ${nonneg.join(", ")} ≥ 0`);
    return lines.join("\n");
  }
}

// ---- the simplex method -------------------------------------------------------

/** Solve a square system exactly; null when it is singular. */
export function solveSquare(M, rhs) {
  const n = M.length;
  const A = M.map((row, i) => [...row, rhs[i]]);
  for (let col = 0; col < n; col++) {
    let p = col;
    while (p < n && isZero(A[p][col])) p++;
    if (p === n) return null;
    [A[col], A[p]] = [A[p], A[col]];
    const inv = ONE.divide(A[col][col]);
    A[col] = A[col].map((v) => v.multiply(inv));
    for (let r = 0; r < n; r++) {
      if (r === col || isZero(A[r][col])) continue;
      const f = A[r][col];
      A[r] = A[r].map((v, k) => v.subtract(f.multiply(A[col][k])));
    }
  }
  return A.map((row) => row[n]);
}

/**
 * The tableau in standard form: max cs·z subject to As z = bs, z ≥ 0, bs ≥ 0.
 * Columns: for each variable its + part (and − part when free), then one slack
 * or surplus for each inequality, then the artificials.
 */
function standardForm(P) {
  const m = P.rows.length;
  const n = P.names.length;
  const flip = (P.sense === "minimize" ? -1 : 1);
  const cols = []; // { kind, j, sign } for structural; { kind: "slack", i, sign }; { kind: "art", i }
  for (let j = 0; j < n; j++) {
    cols.push({ kind: "x", j, sign: 1 });
    if (P.free[j]) cols.push({ kind: "x", j, sign: -1 });
  }
  const s = P.rows.map((r) => (sgn(r.b) < 0 ? -1 : 1));
  const rel = P.rows.map((r, i) => (s[i] > 0 ? r.relation : r.relation === "<=" ? ">=" : r.relation === ">=" ? "<=" : "="));
  for (let i = 0; i < m; i++) if (rel[i] !== "=") cols.push({ kind: "slack", i, sign: rel[i] === "<=" ? 1 : -1 });
  const basis = new Array(m).fill(-1);
  for (let i = 0; i < m; i++) {
    if (rel[i] === "<=") basis[i] = cols.findIndex((c) => c.kind === "slack" && c.i === i);
    else {
      cols.push({ kind: "art", i });
      basis[i] = cols.length - 1;
    }
  }
  const N = cols.length;
  const T = P.rows.map((r, i) => {
    const row = new Array(N + 1).fill(ZERO);
    // the structural part takes the row's sign flip; slacks and artificials are set after it
    cols.forEach((c, k) => {
      if (c.kind === "x") row[k] = c.sign * s[i] > 0 ? r.a[c.j] : r.a[c.j].negate();
      else if (c.i === i) row[k] = c.kind === "slack" ? (c.sign > 0 ? ONE : ONE.negate()) : ONE;
    });
    row[N] = s[i] > 0 ? r.b : r.b.negate();
    return row;
  });
  const cost = cols.map((c) => (c.kind === "x" ? (c.sign > 0 ? P.c[c.j] : P.c[c.j].negate()).multiply(new Rational(BigInt(flip))) : ZERO));
  return { T, basis, cols, cost, s, N, m, n };
}

function pivot(T, basis, r, e) {
  const N = T[0].length;
  const inv = ONE.divide(T[r][e]);
  T[r] = T[r].map((v) => (isZero(v) ? v : v.multiply(inv)));
  for (let i = 0; i < T.length; i++) {
    if (i === r || isZero(T[i][e])) continue;
    const f = T[i][e];
    const pr = T[r];
    const row = T[i];
    for (let k = 0; k < N; k++) if (!isZero(pr[k])) row[k] = row[k].subtract(f.multiply(pr[k]));
  }
  basis[r] = e;
}

/** Run the simplex method on the tableau for costs c, over the allowed columns. */
function simplex(T, basis, c, allowed, limit) {
  const m = T.length;
  const N = c.length;
  let pivots = 0;
  for (;;) {
    // reduced costs d_j = c_B·T_j − c_j; enter the first j with d_j < 0 (Bland)
    let e = -1;
    for (let j = 0; j < N && e < 0; j++) {
      if (!allowed[j] || basis.includes(j)) continue;
      let d = c[j].negate();
      for (let i = 0; i < m; i++) if (!isZero(T[i][j]) && !isZero(c[basis[i]])) d = d.add(c[basis[i]].multiply(T[i][j]));
      if (sgn(d) < 0) e = j;
    }
    if (e < 0) return { status: "optimal", pivots };
    let r = -1;
    let best = null;
    for (let i = 0; i < m; i++) {
      if (sgn(T[i][e]) <= 0) continue;
      const ratio = T[i][N].divide(T[i][e]);
      const k = best === null ? -1 : ratio.compareTo(best);
      if (best === null || k < 0 || (k === 0 && basis[i] < basis[r])) {
        best = ratio;
        r = i;
      }
    }
    if (r < 0) return { status: "unbounded", entering: e, pivots };
    pivot(T, basis, r, e);
    if (++pivots > limit) refuse("too-hard", `the simplex method took more than ${limit} pivots`);
  }
}

/** Duals of the standard form: solve Bᵀy = c_B. */
function standardDuals(T0, basis, c) {
  const m = basis.length;
  const B = Array.from({ length: m }, (_, k) => Array.from({ length: m }, (_, i) => T0[i][basis[k]]));
  const y = solveSquare(B, basis.map((j) => c[j]));
  if (!y) throw new Error("internal: the final basis is singular");
  return y;
}

/**
 * Solve a linear program exactly.
 *
 *   linearProgram({ maximize: [3, 2], constraints: [[[1, 1], "<=", 4], [[1, 3], "<=", 6]] })
 *
 * The result has `status` ("optimal", "infeasible" or "unbounded") and the
 * matching certificate; see the file header.
 */
export function linearProgram(problem, { maxPivots = 100000 } = {}) {
  const P = parseProblem(problem);
  const S = standardForm(P);
  const { T, basis, cols, cost, N, m } = S;
  const T0 = T.map((row) => [...row]);
  const isArt = cols.map((c) => c.kind === "art");
  let pivots = 0;
  // phase 1: maximise −(sum of artificials)
  if (isArt.some(Boolean)) {
    const c1 = cols.map((c) => (c.kind === "art" ? ONE.negate() : ZERO));
    const r1 = simplex(T, basis, c1, cols.map(() => true), maxPivots);
    pivots += r1.pivots;
    const infeasibility = sum(basis.map((j, i) => (isArt[j] ? T[i][N] : ZERO)));
    if (sgn(infeasibility) > 0) {
      const ys = standardDuals(T0, basis, c1);
      const farkas = ys.map((v, i) => (S.s[i] > 0 ? v : v.negate()));
      return new LPResult(P, { status: "infeasible", farkas, pivots });
    }
    // drive zero artificials out of the basis where a real column can replace them
    for (let i = 0; i < m; i++) {
      if (!isArt[basis[i]]) continue;
      const j = cols.findIndex((c, k) => !isArt[k] && !basis.includes(k) && !isZero(T[i][k]));
      if (j >= 0) pivot(T, basis, i, j);
    }
  }
  // phase 2
  const r2 = simplex(T, basis, cost, isArt.map((a) => !a), maxPivots);
  pivots += r2.pivots;
  const z = new Array(N).fill(ZERO);
  basis.forEach((j, i) => (z[j] = T[i][N]));
  const x = P.names.map((_, j) => {
    let v = ZERO;
    cols.forEach((c, k) => {
      if (c.kind === "x" && c.j === j) v = c.sign > 0 ? v.add(z[k]) : v.subtract(z[k]);
    });
    return v;
  });
  if (r2.status === "unbounded") {
    const e = r2.entering;
    const dz = new Array(N).fill(ZERO);
    dz[e] = ONE;
    basis.forEach((j, i) => (dz[j] = T[i][e].negate()));
    const ray = P.names.map((_, j) => {
      let v = ZERO;
      cols.forEach((c, k) => {
        if (c.kind === "x" && c.j === j) v = c.sign > 0 ? v.add(dz[k]) : v.subtract(dz[k]);
      });
      return v;
    });
    return new LPResult(P, { status: "unbounded", x, ray, pivots });
  }
  const ys = standardDuals(T0, basis, cost);
  const flip = P.sense === "minimize" ? -1 : 1;
  const dual = ys.map((v, i) => (S.s[i] * flip > 0 ? v : v.negate()));
  return new LPResult(P, { status: "optimal", x, dual, pivots });
}

export class LPResult {
  constructor(problem, { status, x = null, dual = null, farkas = null, ray = null, pivots = 0 }) {
    this.problem = problem;
    this.status = status;
    this.x = x && Object.freeze(x);
    this.dual = dual && Object.freeze(dual);
    this.farkas = farkas && Object.freeze(farkas);
    this.ray = ray && Object.freeze(ray);
    this.pivots = pivots;
    this.value = status === "optimal" ? dot(problem.c, x) : null;
    Object.freeze(this);
  }
  /** The solution as { name: value }. */
  get solution() {
    return this.x && Object.fromEntries(this.problem.names.map((k, j) => [k, this.x[j]]));
  }
  /** Shadow prices as { constraint name: value }: how the optimum moves per unit of right-hand side. */
  get prices() {
    return this.dual && Object.fromEntries(this.problem.rows.map((r, i) => [r.name, this.dual[i]]));
  }
  /** The constraints that hold with equality at the solution. */
  get binding() {
    if (!this.x) return null;
    return this.problem.rows.filter((r) => dot(r.a, this.x).equals(r.b)).map((r) => r.name);
  }
  /** Check the certificate against the problem, by arithmetic alone; returns true or throws. */
  check() {
    return checkLinearProgram(this.problem, this);
  }
  toString() {
    if (this.status === "infeasible") return "infeasible (Farkas certificate attached)";
    if (this.status === "unbounded") return `unbounded: ${this.problem.sense === "maximize" ? "+∞" : "−∞"} along a ray`;
    return `optimal: ${this.value} at ${this.problem.names.map((k, j) => `${k} = ${this.x[j]}`).join(", ")}`;
  }
}

// ---- the independent check ------------------------------------------------------

const fail = (why) => refuse("certificate-fails", why);
const holds = (lhs, rel, b) => {
  const k = lhs.compareTo(b);
  return rel === "<=" ? k <= 0 : rel === ">=" ? k >= 0 : k === 0;
};

/** Check that x satisfies every constraint and sign condition. */
export function isFeasible(problem, x) {
  const P = parseProblem(problem);
  const xs = x.map((v) => exact(v));
  if (xs.length !== P.names.length) return false;
  if (xs.some((v, j) => !P.free[j] && sgn(v) < 0)) return false;
  return P.rows.every((r) => holds(dot(r.a, xs), r.relation, r.b));
}

/**
 * Check a result of `linearProgram` (or any { status, x, dual, farkas, ray })
 * using arithmetic on the problem alone. Returns true, or throws a
 * DiscreteError with code "certificate-fails" saying what is wrong.
 */
export function checkLinearProgram(problem, result) {
  const P = parseProblem(problem);
  const n = P.names.length;
  const max = P.sense === "maximize";
  const rows = P.rows;
  if (result.status === "optimal" || result.status === "unbounded") {
    if (!isFeasible(P, result.x)) fail("the solution breaks a constraint");
  }
  if (result.status === "optimal") {
    const y = result.dual;
    if (!y || y.length !== rows.length) fail("no dual solution");
    // sign of each price: tightening a constraint can only hurt
    rows.forEach((r, i) => {
      const s = sgn(y[i]);
      const want = r.relation === "=" ? 0 : (r.relation === "<=") === max ? 1 : -1;
      if (want !== 0 && s !== 0 && s !== want) fail(`the price of ${r.name} has the wrong sign`);
    });
    // reduced costs: c_j − Σ y_i a_ij must be ≤ 0 (max) or ≥ 0 (min), and 0 for free variables
    for (let j = 0; j < n; j++) {
      const red = P.c[j].subtract(sum(rows.map((r, i) => r.a[j].multiply(y[i]))));
      if (P.free[j] ? !isZero(red) : sgn(red) === (max ? 1 : -1)) fail(`the dual constraint for ${P.names[j]} fails`);
    }
    const primal = dot(P.c, result.x);
    const dualValue = dot(rows.map((r) => r.b), y);
    if (!primal.equals(dualValue)) fail(`c·x = ${primal} but b·y = ${dualValue}`);
    return true;
  }
  if (result.status === "infeasible") {
    const y = result.farkas;
    if (!y || y.length !== rows.length) fail("no Farkas vector");
    rows.forEach((r, i) => {
      if (r.relation === "<=" && sgn(y[i]) < 0) fail(`the multiplier of ${r.name} must be ≥ 0`);
      if (r.relation === ">=" && sgn(y[i]) > 0) fail(`the multiplier of ${r.name} must be ≤ 0`);
    });
    for (let j = 0; j < n; j++) {
      const col = sum(rows.map((r, i) => r.a[j].multiply(y[i])));
      if (P.free[j] ? !isZero(col) : sgn(col) < 0) fail(`the combination fails for ${P.names[j]}`);
    }
    if (sgn(dot(rows.map((r) => r.b), y)) >= 0) fail("the combination's right-hand side is not negative");
    return true;
  }
  if (result.status === "unbounded") {
    const d = result.ray;
    if (!d || d.length !== n) fail("no ray");
    if (d.some((v, j) => !P.free[j] && sgn(v) < 0)) fail("the ray leaves the sign conditions");
    rows.forEach((r) => {
      if (!holds(dot(r.a, d), r.relation, ZERO)) fail(`the ray breaks ${r.name}`);
    });
    if (sgn(dot(P.c, d)) !== (max ? 1 : -1)) fail("the ray does not improve the objective");
    return true;
  }
  fail(`unknown status ${result.status}`);
}

// ---- integer programs -------------------------------------------------------------

const isWhole = (r) => r.denominator === 1n;
const floorOf = (r) => new Rational(r.floor());

/**
 * Branch and bound for small integer (or mixed) programs.
 *
 *   integerProgram(problem, { integer: ["x", "y"] })   // default: every variable
 *
 * Returns { status, x, value, nodes, relaxation } where `relaxation` is the
 * LP optimum without integrality (a bound on the answer). Refuses with
 * "too-hard" beyond `maxNodes` subproblems.
 */
export function integerProgram(problem, { integer, maxNodes = 20000 } = {}) {
  const P = parseProblem(problem);
  const ints = integer === undefined || integer === true ? P.names.map((_, j) => j) : integer.map((v) => (typeof v === "number" ? v : P.names.indexOf(String(v))));
  if (ints.some((j) => j < 0 || j >= P.names.length)) refuse("bad-problem", "integer names an unknown variable");
  const max = P.sense === "maximize";
  const better = (a, b) => (max ? a.compareTo(b) > 0 : a.compareTo(b) < 0);
  const root = linearProgram(P);
  if (root.status === "infeasible") return new IPResult(P, ints, { status: "infeasible", nodes: 1, relaxation: root });
  if (root.status === "unbounded") refuse("unbounded-relaxation", "the relaxation is unbounded, so branch and bound cannot bound the search");
  let best = null;
  let nodes = 0;
  const stack = [[]];
  while (stack.length) {
    const extra = stack.pop();
    if (++nodes > maxNodes) refuse("too-hard", `branch and bound needed more than ${maxNodes} subproblems`);
    const r = extra.length ? linearProgram(P.withRows(extra)) : root;
    if (r.status !== "optimal") continue;
    if (best && !better(r.value, best.value)) continue;
    const j = ints.find((k) => !isWhole(r.x[k]));
    if (j === undefined) {
      best = r;
      continue;
    }
    const f = floorOf(r.x[j]);
    const a = P.names.map((_, k) => (k === j ? ONE : ZERO));
    const down = { name: `${P.names[j]} ≤ ${f}`, a, relation: "<=", b: f };
    const up = { name: `${P.names[j]} ≥ ${f.add(ONE)}`, a, relation: ">=", b: f.add(ONE) };
    stack.push([...extra, down], [...extra, up]);
  }
  if (!best) return new IPResult(P, ints, { status: "infeasible", nodes, relaxation: root });
  return new IPResult(P, ints, { status: "optimal", x: best.x, nodes, relaxation: root });
}

export class IPResult {
  constructor(problem, ints, { status, x = null, nodes, relaxation }) {
    this.problem = problem;
    this.integer = Object.freeze(ints.map((j) => problem.names[j]));
    this.status = status;
    this.x = x && Object.freeze(x);
    this.value = x ? dot(problem.c, x) : null;
    this.nodes = nodes;
    this.relaxation = relaxation;
    Object.freeze(this);
  }
  get solution() {
    return this.x && Object.fromEntries(this.problem.names.map((k, j) => [k, this.x[j]]));
  }
  /** The solution is feasible and whole where it must be. Optimality rests on the search. */
  check() {
    if (this.status !== "optimal") return true;
    if (!isFeasible(this.problem, this.x)) fail("the solution breaks a constraint");
    for (const k of this.integer) if (!isWhole(this.x[this.problem.names.indexOf(k)])) fail(`${k} is not whole`);
    return true;
  }
  toString() {
    if (this.status !== "optimal") return `${this.status} (${this.nodes} subproblems)`;
    return `optimal: ${this.value} at ${this.problem.names.map((k, j) => `${k} = ${this.x[j]}`).join(", ")} (${this.nodes} subproblems; relaxation ${this.relaxation.value})`;
  }
}
