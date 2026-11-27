// Helpers added for the Course Test roadmap, batch A8 (ratmath/shelf course-test/ROADMAP.md).
import { describe, expect, test } from "bun:test";
import { Rational } from "@ratmath/core";
import { transportation, integerProgram, cooperativeGame, coreVertices, inCore, linearProgram } from "../index.js";

const Q = (n, d = 1) => new Rational(BigInt(n), BigInt(d));
const S = (xs) => xs.map((r) => r.map(String));

// independent: the cheapest plan by trying every whole-number plan (small totals)
function bruteTransport(supply, demand, cost) {
  const m = supply.length, n = demand.length;
  let best = Infinity;
  const x = Array.from({ length: m }, () => Array(n).fill(0));
  const go = (k) => {
    if (k === m * n) {
      if (supply.every((s, i) => x[i].reduce((a, b) => a + b, 0) === s) && demand.every((d, j) => x.reduce((a, r) => a + r[j], 0) === d)) {
        best = Math.min(best, x.flat().reduce((a, v, t) => a + v * cost[Math.floor(t / n)][t % n], 0));
      }
      return;
    }
    const [i, j] = [Math.floor(k / n), k % n];
    const room = Math.min(supply[i] - x[i].reduce((a, b) => a + b, 0), demand[j] - x.reduce((a, r) => a + r[j], 0));
    for (let v = 0; v <= room; v++) {
      x[i][j] = v;
      go(k + 1);
    }
    x[i][j] = 0;
  };
  go(0);
  return best;
}

describe("transportation", () => {
  test("the textbook problem: cost 465, checked by brute force and the LP certificate", () => {
    const t = transportation([20, 30], [10, 25, 15], [[8, 6, 10], [9, 12, 13]]);
    expect(t.status).toBe("optimal");
    expect(String(t.cost)).toBe("465");
    expect(S(t.plan)).toEqual([["0", "20", "0"], ["10", "5", "15"]]);
    expect(t.dummy).toBe(null);
    expect(t.lp.check()).toBe(true);
    expect(bruteTransport([20, 30], [10, 25, 15], [[8, 6, 10], [9, 12, 13]])).toBe(465);
  });
  test("unbalanced problems get a dummy sink or source", () => {
    const cost = [[8, 6, 10], [9, 12, 13]];
    const more = transportation([4, 8], [2, 5, 3], cost);
    expect(more.dummy).toBe("sink");
    expect(more.plan.length).toBe(2);
    expect(more.plan[0].length).toBe(3);
    expect(more.leftover.reduce((a, b) => a.add(b), Q(0)).equals(Q(2))).toBe(true);
    // independent: with the dummy written out by hand
    expect(more.cost.equals(Q(bruteTransport([4, 8], [2, 5, 3, 2], [[8, 6, 10, 0], [9, 12, 13, 0]])))).toBe(true);
    const less = transportation([4, 4], [2, 5, 3], cost);
    expect(less.dummy).toBe("source");
    expect(less.unmet.reduce((a, b) => a.add(b), Q(0)).equals(Q(2))).toBe(true);
    expect(less.cost.equals(Q(bruteTransport([4, 4, 2], [2, 5, 3], [...cost, [0, 0, 0]])))).toBe(true);
  });
  test("fractional supplies stay exact, and bad tables are refused", () => {
    const t = transportation(["1/2", "1/3"], ["5/6"], [[1], [2]]);
    expect(t.cost.equals(Q(7, 6))).toBe(true);
    expect(() => transportation([1], [1, 2], [[1]])).toThrow(/1 × 2/);
  });
});

describe("0–1 integer programs", () => {
  test("a knapsack in one call matches every subset", () => {
    const values = [10, 13, 7, 8, 4], weights = [5, 6, 4, 5, 2];
    const k = integerProgram({ maximize: values, constraints: [[weights, "<=", 13]] }, { binary: true });
    let best = 0;
    for (let m = 0; m < 32; m++) {
      let w = 0, v = 0;
      for (let i = 0; i < 5; i++) if ((m >> i) & 1) { w += weights[i]; v += values[i]; }
      if (w <= 13 && v > best) best = v;
    }
    expect(Number(k.value.numerator)).toBe(best);
    expect(k.x.every((v) => v.equals(Q(0)) || v.equals(Q(1)))).toBe(true);
    expect(k.check()).toBe(true);
  });
  test("binary on some variables only, the others continuous", () => {
    const r = integerProgram({ maximize: { x: 3, y: 1 }, constraints: [[{ x: 2, y: 1 }, "<=", "7/2"]] }, { binary: ["x"] });
    expect(r.solution.x.equals(Q(1))).toBe(true);
    expect(r.solution.y.equals(Q(3, 2))).toBe(true);
    expect(() => integerProgram({ maximize: [1], constraints: [] }, { binary: ["z"] })).toThrow(/unknown/);
  });
});

describe("vertices of the core", () => {
  test("glove game: one point (1, 0, 0)", () => {
    const g = cooperativeGame(["L", "R1", "R2"], (S) => (S.includes("L") && S.length >= 2 ? 1 : 0));
    const c = coreVertices(g);
    expect(c.kind).toBe("point");
    expect(c.dimension).toBe(0);
    expect(Object.fromEntries(Object.entries(c.vertices[0]).map(([k, v]) => [k, String(v)]))).toEqual({ L: "1", R1: "0", R2: "0" });
    // independent: maximising and minimising each share over the core gives the same number
    const P = ["L", "R1", "R2"];
    const subsets = [["L"], ["R1"], ["R2"], ["L", "R1"], ["L", "R2"], ["R1", "R2"]];
    const constraints = [...subsets.map((s) => [Object.fromEntries(s.map((p) => [p, 1])), ">=", g.value(s)]), [{ L: 1, R1: 1, R2: 1 }, "=", 1]];
    for (const p of P) {
      const lo = linearProgram({ minimize: { [p]: 1 }, constraints, names: P });
      const hi = linearProgram({ maximize: { [p]: 1 }, constraints, names: P });
      expect(lo.value.equals(hi.value)).toBe(true);
    }
  });
  test("a segment when only A and B together are worth anything", () => {
    const g = cooperativeGame(["A", "B", "C"], (S) => (S.length === 3 ? 1 : S.join("") === "AB" ? 1 : 0));
    const c = coreVertices(g);
    expect(c.kind).toBe("polytope");
    expect(c.dimension).toBe(1);
    expect(c.vertices.length).toBe(2);
    for (const x of c.vertices) expect(inCore(g, x).inCore).toBe(true);
  });
  test("empty for the majority game; a 4-player game with a 3-dimensional core", () => {
    expect(coreVertices(cooperativeGame(["a", "b", "c"], (S) => (S.length >= 2 ? 1 : 0))).kind).toBe("empty");
    const additive = cooperativeGame(["a", "b", "c", "d"], (S) => (S.length === 4 ? 1 : 0));
    const c = coreVertices(additive);
    // the core is the whole simplex: its vertices are the four unit allocations
    expect(c.dimension).toBe(3);
    expect(c.vertices.length).toBe(4);
  });
});
