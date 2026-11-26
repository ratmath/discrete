import { expect, test } from "bun:test";
import { Rational } from "@ratmath/core";
import {
  mex, impartialGame, nim, subtractionGame, Game, cgame, starGame, up, down, partizanGame, backwardInduction,
  cooperativeGame, shapley, core, inCore, weightedVoting,
  plurality, borda, instantRunoff, condorcet, approval, apportion, adjustedWinner,
} from "../index.js";

test("mex and Sprague–Grundy values against a direct recursion", () => {
  expect(mex([0, 1, 3])).toBe(2);
  // take 1, 2 or 5 from a heap: compute by hand-rolled memo, compare
  const S = [1, 2, 5];
  const memo = [];
  const brute = (n) => (memo[n] ??= mex(S.filter((s) => s <= n).map((s) => brute(n - s))));
  const g = impartialGame((n) => S.filter((s) => s <= n).map((s) => n - s));
  for (let n = 0; n < 40; n++) expect(g.grundy(n)).toBe(brute(n));
  const sub = subtractionGame(S, 40);
  expect(sub.values.slice(0, 40)).toEqual(Array.from({ length: 40 }, (_, n) => brute(n)));
  expect(subtractionGame([1, 3, 4], 30).period).toEqual({ start: 0, length: 7 });
});

test("nim: the nim-sum decides, and the winning moves make it zero", () => {
  const r = nim([3, 4, 5]);
  expect(r.nimSum).toBe(2n);
  for (const m of r.winningMoves) {
    const hs = [3n, 4n, 5n];
    hs[m.heap] = m.to;
    expect(nim(hs).losing).toBe(true);
  }
  expect(nim([1, 2, 3]).losing).toBe(true);
});

test("Conway games: numbers, nimbers, up, and sums", () => {
  expect(String(cgame([0], []))).toBe("1");
  expect(String(cgame([0], [1]))).toBe("1/2");
  expect(String(cgame(["1/2"], ["3/4"]))).toBe("5/8");
  expect(String(cgame([0], [0]))).toBe("*");
  expect(String(starGame(3))).toBe("*3");
  expect(String(starGame(2).add(starGame(3)))).toBe("*");
  expect(String(starGame(1).add(starGame(1)))).toBe("0");
  expect(String(up().add(up()))).toBe("⇑");
  expect(String(up().add(down()))).toBe("0");
  expect(up().compare(0)).toBe(">");
  expect(starGame(1).compare(0)).toBe("‖");
  expect(up().compare(starGame(1))).toBe("‖");
  expect(cgame([2], [-1]).outcome).toBe("first player");
  expect(String(cgame([1], []).add(cgame([], [-1])))).toBe("0");
});

test("blue-red Hackenbush stalks give the binary-fraction values", () => {
  const stalk = (s) => partizanGame(s,
    (p) => [...p].map((c, i) => (c === "B" ? p.slice(0, i) : null)).filter((x) => x !== null),
    (p) => [...p].map((c, i) => (c === "R" ? p.slice(0, i) : null)).filter((x) => x !== null));
  expect(String(stalk("BR"))).toBe("1/2");
  expect(String(stalk("BRR"))).toBe("1/4");
  expect(String(stalk("BBRB"))).toBe("7/4");
  expect(String(stalk("RB"))).toBe("-1/2");
  expect(stalk("BR").add(stalk("BR")).equals(stalk("B"))).toBe(true);
});

test("backward induction on an entry game", () => {
  const tree = { player: "A", moves: { in: { player: "B", moves: { fight: { payoff: { A: -1, B: -1 } }, share: { payoff: { A: 1, B: 1 } } } }, out: { payoff: { A: 0, B: 2 } } } };
  const r = backwardInduction(tree);
  expect(r.path).toEqual(["in", "share"]);
  expect(String(r.value.A)).toBe("1");
});

const subsets = (xs) => xs.reduce((acc, x) => acc.concat(acc.map((s) => [...s, x])), [[]]);

test("Shapley values are efficient, symmetric, and match the permutation average", () => {
  const glove = cooperativeGame(["L1", "L2", "R"], (S) => (S.includes("R") && (S.includes("L1") || S.includes("L2")) ? 1 : 0));
  const sh = shapley(glove);
  expect([sh.L1, sh.L2, sh.R].map(String)).toEqual(["1/6", "1/6", "2/3"]);
  const v = (S) => S.length * S.length; // v(S) = |S|²
  const g = cooperativeGame(["a", "b", "c", "d"], v);
  const s = shapley(g);
  let total = new Rational(0n);
  for (const p of ["a", "b", "c", "d"]) total = total.add(s[p]);
  expect(String(total)).toBe("16");
  expect(String(s.a)).toBe("4");
});

test("the core: a point when it exists, a balanced collection when it is empty", () => {
  const glove = cooperativeGame(["L1", "L2", "R"], (S) => (S.includes("R") && (S.includes("L1") || S.includes("L2")) ? 1 : 0));
  const c = core(glove);
  expect(c.empty).toBe(false);
  expect(inCore(glove, c.allocation).inCore).toBe(true);
  expect(inCore(glove, { L1: "1/2", L2: 0, R: "1/2" }).inCore).toBe(false);
  const maj = cooperativeGame(["a", "b", "c"], (S) => (S.length >= 2 ? 1 : 0));
  const e = core(maj);
  expect(e.empty).toBe(true);
  // check the balanced collection independently: weights cover each player exactly once
  for (const p of ["a", "b", "c"]) {
    let w = new Rational(0n);
    for (const { coalition, weight } of e.balanced) if (coalition.includes(p)) w = w.add(weight);
    expect(String(w)).toBe("1");
  }
});

test("weighted voting: power indices and dummies", () => {
  const w = weightedVoting({ quota: 51, weights: { A: 49, B: 48, C: 3 } });
  expect(["A", "B", "C"].map((p) => String(w.shapleyShubik[p]))).toEqual(["1/3", "1/3", "1/3"]);
  const d = weightedVoting({ quota: 8, weights: { A: 5, B: 3, C: 1 } });
  expect(d.dummies).toEqual(["C"]);
});

test("voting methods can disagree on one profile", () => {
  const ballots = [{ ranking: ["A", "B", "C"], count: 8 }, { ranking: ["B", "C", "A"], count: 5 }, { ranking: ["C", "B", "A"], count: 4 }];
  expect(plurality(ballots).winners).toEqual(["A"]);
  expect(borda(ballots).winners).toEqual(["B"]);
  expect(instantRunoff(ballots).winners).toEqual(["B"]);
  expect(condorcet(ballots).winner).toBe("B");
  expect(condorcet([["a", "b", "c"], ["b", "c", "a"], ["c", "a", "b"]]).cycle).toEqual(["a", "b", "c", "a"]);
  expect(approval([["a", "b"], ["b"], ["c"]]).winners).toEqual(["b"]);
});

test("apportionment: totals, quota, and the Alabama paradox", () => {
  const pops = { A: 1500, B: 1000, C: 600, D: 400 };
  for (const method of ["hamilton", "jefferson", "webster", "adams", "huntington-hill"]) {
    const r = apportion(pops, 10, { method });
    expect(Object.values(r.seats).reduce((a, b) => a + BigInt(b), 0n)).toBe(10n);
  }
  expect(String(apportion(pops, 10, { method: "jefferson" }).seats.A)).toBe("5");
  // more seats, yet C loses one
  expect(String(apportion({ A: 6, B: 6, C: 2 }, 10).seats.C)).toBe("2");
  expect(String(apportion({ A: 6, B: 6, C: 2 }, 11).seats.C)).toBe("1");
});

test("adjusted winner gives equal points and is envy-free", () => {
  const r = adjustedWinner({ house: 50, car: 20, boat: 30 }, { house: 40, car: 40, boat: 20 });
  expect(String(r.points.A)).toBe(String(r.points.B));
  expect(String(r.points.A)).toBe("520/9");
});
