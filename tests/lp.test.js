// Linear programming and games, checked two ways: every certificate is checked
// by arithmetic on the problem (each optimum by its dual), and on small random
// problems the answer is compared with brute force over all vertices, all
// integer points, or all pure strategy pairs.
import { describe, expect, test } from "bun:test";
import { Rational } from "@ratmath/core";
import * as D from "../index.js";

const R = (x) => new Rational(x);
const Q = (n, d = 1) => new Rational(BigInt(n), BigInt(d));
const ZERO = Q(0);
const seed = D.rng("lp tests");
const s = (xs) => xs.map(String);

/** Every vertex of { x ≥ 0 (or free), rows }: solve each choice of n tight constraints. */
function vertices(P) {
  const n = P.names.length;
  const planes = [
    ...P.rows.map((r) => ({ a: r.a, b: r.b })),
    ...P.names.map((_, j) => (P.free[j] ? null : { a: P.names.map((_, k) => (k === j ? Q(1) : ZERO)), b: ZERO })),
  ].filter(Boolean);
  const out = [];
  for (const pick of D.combinations([...planes.keys()], n)) {
    const x = D.solveSquare(
      pick.map((i) => planes[i].a),
      pick.map((i) => planes[i].b),
    );
    if (x && D.isFeasible(P, x)) out.push(x);
  }
  return out;
}
const dot = (a, b) => a.reduce((t, v, i) => t.add(v.multiply(b[i])), ZERO);

function randomProblem(r, { n = 2, m = 3, range = 5, free = false } = {}) {
  const v = () => Q(r.between(-range, range));
  const rel = () => r.pick(["<=", "<=", ">=", "="]);
  return D.parseProblem({
    [r.bool() ? "maximize" : "minimize"]: Array.from({ length: n }, v),
    constraints: Array.from({ length: m }, () => [Array.from({ length: n }, v), rel(), v()]),
    free: free ? [0] : [],
  });
}

describe("linear programs", () => {
  test("a textbook problem, with its prices", () => {
    const r = D.linearProgram({
      maximize: { chairs: 30, tables: 50 },
      constraints: [
        [{ chairs: 2, tables: 4 }, "<=", 100, "wood"],
        [{ chairs: 3, tables: 2 }, "<=", 90, "labour"],
      ],
    });
    expect(r.status).toBe("optimal");
    expect(String(r.value)).toBe("1350");
    expect(s(r.x)).toEqual(["20", "15"]);
    expect(Object.fromEntries(Object.entries(r.prices).map(([k, v]) => [k, String(v)]))).toEqual({ wood: "45/4", labour: "5/2" });
    expect(r.binding).toEqual(["wood", "labour"]);
    expect(r.check()).toBe(true);
  });
  test("fractions stay exact, and a minimum carries its prices", () => {
    const r = D.linearProgram({ minimize: ["1/3", "1/2"], constraints: [[[1, 1], ">=", "7/2"], [[1, -2], "<=", 0]] });
    expect(r.status).toBe("optimal");
    expect(r.check()).toBe(true);
    expect(String(r.value)).toBe(String(dot(r.x, [Q(1, 3), Q(1, 2)])));
  });
  test("infeasible problems come with a Farkas vector, unbounded ones with a ray", () => {
    const bad = D.linearProgram({ maximize: [1, 1], constraints: [[[1, 1], "<=", 1], [[1, 1], ">=", 2]] });
    expect(bad.status).toBe("infeasible");
    expect(bad.check()).toBe(true);
    const open = D.linearProgram({ maximize: [1, 2], constraints: [[[1, -1], "<=", 1], [[-1, 1], "<=", 3]] });
    expect(open.status).toBe("unbounded");
    expect(open.check()).toBe(true);
  });
  test("a wrong certificate is caught", () => {
    const P = { maximize: [3, 2], constraints: [[[1, 1], "<=", 4], [[1, 3], "<=", 6]] };
    const r = D.linearProgram(P);
    expect(() => D.checkLinearProgram(P, { status: "optimal", x: r.x, dual: [Q(2), Q(1)] })).toThrow(/dual|c·x/);
    expect(() => D.checkLinearProgram(P, { status: "optimal", x: [Q(3), Q(1)], dual: r.dual })).toThrow(/c·x/);
    expect(() => D.checkLinearProgram(P, { status: "optimal", x: [Q(5), Q(0)], dual: r.dual })).toThrow(/breaks/);
    expect(() => D.checkLinearProgram(P, { status: "infeasible", farkas: [Q(1), Q(1)] })).toThrow();
  });
  test("degenerate and redundant constraints, and free variables", () => {
    const r = D.linearProgram({ maximize: [1, 1], constraints: [[[1, 1], "=", 2], [[2, 2], "=", 4], [[1, 0], "<=", 1], [[0, 1], "<=", 1], [[1, -1], "<=", 0]] });
    expect(r.status).toBe("optimal");
    expect(r.check()).toBe(true);
    const f = D.linearProgram({ minimize: [1, 0], constraints: [[[1, 1], ">=", -3], [[1, -1], ">=", -5]], free: ["x1", "x2"] });
    expect(String(f.value)).toBe("-4");
    expect(f.check()).toBe(true);
  });
  test("400 random problems: every certificate checks, and every optimum is the best vertex", () => {
    const r = seed.fork("random");
    const seen = { optimal: 0, infeasible: 0, unbounded: 0 };
    for (let t = 0; t < 400; t++) {
      const P = randomProblem(r, { n: r.between(1, 3), m: r.between(1, 4), free: t % 5 === 0 });
      const res = D.linearProgram(P);
      seen[res.status]++;
      expect(res.check()).toBe(true);
      const V = vertices(P);
      const hasFree = P.free.some(Boolean);
      if (res.status === "optimal" && V.length) {
        const best = V.map((x) => dot(P.c, x)).reduce((a, b) => ((P.sense === "maximize" ? b.compareTo(a) > 0 : b.compareTo(a) < 0) ? b : a));
        expect(String(res.value)).toBe(String(best));
      }
      if (res.status === "infeasible" && !hasFree) expect(V.length).toBe(0);
      if (res.status !== "infeasible" && !hasFree) expect(V.length).toBeGreaterThan(0);
    }
    expect(seen.optimal).toBeGreaterThan(50);
    expect(seen.infeasible).toBeGreaterThan(20);
    expect(seen.unbounded).toBeGreaterThan(20);
  });
});

describe("integer programs", () => {
  test("a knapsack", () => {
    const r = D.integerProgram({ maximize: [5, 4], constraints: [[[6, 4], "<=", 24], [[1, 2], "<=", 6]] });
    expect(String(r.value)).toBe("20");
    expect(String(r.relaxation.value)).toBe("21");
    expect(r.check()).toBe(true);
  });
  test("150 random bounded problems against every integer point", () => {
    const r = seed.fork("ip");
    for (let t = 0; t < 150; t++) {
      const n = r.between(1, 3);
      const P = randomProblem(r, { n, m: r.between(1, 3), range: 6 });
      const box = P.names.map((_, j) => [P.names.map((_, k) => (k === j ? 1 : 0)), "<=", 4]);
      const B = D.parseProblem({ [P.sense]: P.c, constraints: [...P.rows.map((row) => [row.a, row.relation, row.b]), ...box] });
      const res = D.integerProgram(B);
      let best = null;
      const pts = n === 1 ? [[0], [1], [2], [3], [4]].map((p) => p) : [];
      const grid = (k) => (k === 0 ? [[]] : grid(k - 1).flatMap((p) => [0, 1, 2, 3, 4].map((v) => [...p, v])));
      for (const p of n === 1 ? pts : grid(n)) {
        const x = p.map((v) => Q(v));
        if (!D.isFeasible(B, x)) continue;
        const v = dot(B.c, x);
        if (best === null || (B.sense === "maximize" ? v.compareTo(best) > 0 : v.compareTo(best) < 0)) best = v;
      }
      if (best === null) expect(res.status).toBe("infeasible");
      else {
        expect(res.status).toBe("optimal");
        expect(String(res.value)).toBe(String(best));
        expect(res.check()).toBe(true);
      }
    }
  });
});

describe("matrix games", () => {
  test("rock, paper, scissors, and a game with a saddle point", () => {
    const g = D.matrixGame([[0, -1, 1], [1, 0, -1], [-1, 1, 0]]);
    expect(String(g.value)).toBe("0");
    expect(s(g.row)).toEqual(["1/3", "1/3", "1/3"]);
    expect(g.check()).toBe(true);
    const h = D.matrixGame([[4, 2, 3], [1, 0, 5], [3, 1, 2]]);
    expect(String(h.value)).toBe("2");
    expect(D.saddlePoints([[4, 2, 3], [1, 0, 5], [3, 1, 2]]).map((p) => [p.row, p.column])).toEqual([[0, 1]]);
  });
  test("300 random games: the guarantee equals the cap, and shifts and scalings move the value as they should", () => {
    const r = seed.fork("zero-sum");
    for (let t = 0; t < 300; t++) {
      const m = r.between(1, 4);
      const n = r.between(1, 4);
      const A = Array.from({ length: m }, () => Array.from({ length: n }, () => r.between(-6, 6)));
      const g = D.matrixGame(A);
      expect(g.check()).toBe(true);
      // the value lies between the pure maximin and minimax
      const maximin = Math.max(...A.map((row) => Math.min(...row)));
      const minimax = Math.min(...A[0].map((_, j) => Math.max(...A.map((row) => row[j]))));
      expect(g.value.compareTo(Q(maximin))).toBeGreaterThanOrEqual(0);
      expect(g.value.compareTo(Q(minimax))).toBeLessThanOrEqual(0);
      if (t % 10 === 0) {
        const h = D.matrixGame(A.map((row) => row.map((v) => 3 * v + 2)));
        expect(String(h.value)).toBe(String(g.value.multiply(Q(3)).add(Q(2))));
        // the transposed, negated game is the same game seen from the other side
        const T = D.matrixGame(A[0].map((_, j) => A.map((row) => -row[j])));
        expect(String(T.value)).toBe(String(g.value.negate()));
      }
    }
  });
});

describe("bimatrix games", () => {
  test("the prisoner's dilemma: defection dominates", () => {
    const g = D.bimatrixGame([[3, 0], [5, 1]], [[3, 5], [0, 1]], { rows: ["C", "D"], columns: ["C", "D"] });
    expect(g.pureEquilibria().map(String)).toEqual(["(D; D) paying 1 and 1"]);
    const d = g.dominance();
    expect(d.rows).toEqual(["D"]);
    expect(d.columns).toEqual(["D"]);
  });
  test("a strategy dominated only by a mixture", () => {
    const g = D.bimatrixGame([[3, 0], [0, 3], [1, 1]], [[1, 0], [0, 1], [0, 0]]);
    expect(g.dominance({ pureOnly: true }).rows).toEqual(["r1", "r2", "r3"]);
    const d = g.dominance();
    expect(d.rows).toEqual(["r1", "r2"]);
    expect(Object.keys(d.steps[0].by)).toEqual(["r1", "r2"]);
  });
  test("the battle of the sexes has three equilibria; Lemke–Howson finds one of them from every label", () => {
    const g = D.bimatrixGame([[2, 0], [0, 1]], [[1, 0], [0, 2]]);
    const eq = g.equilibria();
    expect(eq.complete).toBe(true);
    expect(eq.map(String)).toEqual(["(r1; c1) paying 2 and 1", "(r2; c2) paying 1 and 2", "(2/3 r1 + 1/3 r2; 1/3 c1 + 2/3 c2) paying 2/3 and 2/3"]);
    for (let k = 0; k < 4; k++) expect(eq.map(String)).toContain(String(g.lemkeHowson(k)));
  });
  test("200 random games: equilibria check, their number is odd, and Lemke–Howson lands on one", () => {
    const r = seed.fork("bimatrix");
    let generic = 0;
    for (let t = 0; t < 200; t++) {
      const m = r.between(1, 4);
      const n = r.between(1, 4);
      // random payoffs from a wide range are nondegenerate with high probability
      const M = () => Array.from({ length: m }, () => Array.from({ length: n }, () => r.between(-1000, 1000)));
      const g = D.bimatrixGame(M(), M());
      const eq = g.equilibria();
      expect(eq.length).toBeGreaterThan(0);
      for (const e of eq) expect(e.check()).toBe(true);
      // every pure equilibrium is among them
      for (const p of g.pureEquilibria()) expect(eq.map(String)).toContain(String(p));
      if (!eq.complete) continue;
      generic++;
      expect(eq.length % 2).toBe(1);
      const lh = g.lemkeHowson(r.int(m + n));
      expect(eq.map(String)).toContain(String(lh));
    }
    expect(generic).toBeGreaterThan(150);
  });
  test("a zero-sum bimatrix game agrees with the matrix game", () => {
    const A = [[3, -1, 2], [-2, 1, 0]];
    const eq = D.bimatrixGame(A).equilibria();
    const g = D.matrixGame(A);
    expect(eq.every((e) => e.payoffs.row.equals(g.value))).toBe(true);
  });
});
