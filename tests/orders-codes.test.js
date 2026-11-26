import { expect, test } from "bun:test";
import {
  relation, fromPartition, poset, divisorLattice, booleanLattice, partitionLattice,
  cycleIndex, countColourings, patternInventory, symmetry,
  LinearCode, linearCode, hammingCode, repetitionCode, parityCode, ballSize, codeBounds, isPerfect, reedSolomon,
  isLatinSquare, areOrthogonal, cyclicLatinSquare, orthogonalLatinSquares,
  blockDesign, fromDifferenceSet, projectivePlane, affinePlane, steinerTripleSystem,
  truthTable, minimize, logic,
} from "../index.js";

test("relations: properties with witnesses, closures, equivalence classes", () => {
  const R = relation([1, 2, 3, 4], [[1, 2], [2, 3]]);
  const p = R.properties();
  expect(p.transitive.holds).toBe(false);
  expect(p.transitive.witness).toEqual([1, 2, 3]);
  expect(String(R.transitiveClosure())).toBe("{(1, 2), (1, 3), (2, 3)}");
  expect(relation([1, 2, 3], (a, b) => (a - b) % 2 === 0).classes()).toEqual([[1, 3], [2]]);
  const E = fromPartition([[1, 2], [3]]);
  expect(E.properties().symmetric.holds && E.properties().transitive.holds && E.properties().reflexive.holds).toBe(true);
});

test("posets: Hasse diagram, levels, Dilworth's width, Möbius function", () => {
  const D = divisorLattice(60);
  expect(D.hasse().length).toBe(20);
  expect(D.levels().map((l) => l.length)).toEqual([1, 3, 4, 3, 1]);
  const w = D.width();
  expect(w.width).toBe(4);
  expect(w.chains.length).toBe(4);
  expect(w.chains.flat().length).toBe(12);
  for (let i = 0; i < w.antichain.length; i++) for (let j = i + 1; j < w.antichain.length; j++) expect(D.comparable(w.antichain[i], w.antichain[j])).toBe(false);
  // μ(1, n) on divisors is the number-theoretic Möbius function
  expect(String(D.mobius(1, 60))).toBe("0");
  expect(String(D.mobius(1, 30))).toBe("-1");
  expect(String(D.mobius(1, 6))).toBe("1");
  expect(D.isDistributive().distributive).toBe(true);
  expect(String(partitionLattice(4).mobius("1|2|3|4", "1234"))).toBe("-6");
  expect(() => poset([1, 2], [[1, 2], [2, 1]])).toThrow();
  const N5 = poset(["0", "a", "b", "c", "1"], [["0", "a"], ["a", "b"], ["0", "c"], ["b", "1"], ["c", "1"]]);
  expect(N5.isLattice().lattice).toBe(true);
  expect(N5.isDistributive().distributive).toBe(false);
});

test("linear extensions: counted and listed agree", () => {
  const B = booleanLattice(3);
  expect(B.countLinearExtensions()).toBe(48n);
  expect(B.linearExtensions().length).toBe(48);
  // an antichain of 5 has 5! extensions
  expect(poset([1, 2, 3, 4, 5], []).countLinearExtensions()).toBe(120n);
});

test("Pólya counting agrees with counting orbits directly", () => {
  const orbits = (group, k) => {
    const n = group.degree;
    const seen = new Set();
    let count = 0;
    for (let c = 0; c < k ** n; c++) {
      const col = Array.from({ length: n }, (_, i) => Math.floor(c / k ** i) % k);
      const key = col.join();
      if (seen.has(key)) continue;
      count++;
      for (const g of group.elements) {
        const img = new Array(n);
        g.forEach((gi, i) => (img[gi] = col[i]));
        seen.add(img.join());
      }
    }
    return count;
  };
  for (const [G, k] of [[symmetry.dihedral(6), 2], [symmetry.cyclic(6), 2], [symmetry.cyclic(5), 3], [symmetry.dihedral(5), 3], [symmetry.cubeFaces(), 3], [symmetry.symmetric(4), 3]]) {
    expect(Number(countColourings(G, k))).toBe(orbits(G, k));
  }
  expect(cycleIndex(symmetry.dihedral(4)).toString()).toBe("(1/4) s4 + (1/4) s1^2 s2 + (3/8) s2^2 + (1/8) s1^4");
  expect(patternInventory(symmetry.dihedral(4), ["r", "b"]).toString()).toBe("r^4 + r^3b + 2r^2b^2 + rb^3 + b^4");
});

const allWords = (n, q) => Array.from({ length: q ** n }, (_, c) => Array.from({ length: n }, (_, i) => Math.floor(c / q ** i) % q));
const dist = (a, b) => a.reduce((s, x, i) => s + (x !== b[i] ? 1 : 0), 0);

test("Hamming codes: parameters, perfection, every single error corrected", () => {
  const h = hammingCode(3);
  expect([h.n, h.k]).toEqual([7, 4]);
  expect(h.minimumDistance().distance).toBe(3);
  expect(isPerfect(h)).toBe(true);
  // minimum distance by brute force over all codeword pairs
  const cws = h.codewords();
  let d = Infinity;
  for (let i = 0; i < cws.length; i++) for (let j = i + 1; j < cws.length; j++) d = Math.min(d, dist(cws[i], cws[j]));
  expect(d).toBe(3);
  for (const m of allWords(4, 2)) {
    const cw = h.encode(m);
    for (let i = 0; i < 7; i++) {
      const r = cw.slice();
      r[i] ^= 1;
      expect(h.decode(r).codeword).toEqual(cw);
    }
  }
  expect(h.dual().minimumDistance().distance).toBe(4);
  expect(h.weightDistribution()).toEqual([1, 0, 0, 7, 7, 0, 0, 1]);
  const t = hammingCode(2, { p: 3 });
  expect([t.n, t.k, t.minimumDistance().distance]).toEqual([4, 2, 3]);
  expect(isPerfect(t)).toBe(true);
});

test("small codes and the bounds", () => {
  expect(repetitionCode(5).minimumDistance().distance).toBe(5);
  expect(parityCode(4).minimumDistance().distance).toBe(2);
  expect(ballSize(7, 1)).toBe(8n);
  const b = codeBounds(7, 3, 2);
  expect(b.hamming).toBe(16n);
  expect(b.singleton).toBe(32n);
  const c = linearCode([[1, 0, 1, 1], [0, 1, 0, 1]]);
  expect(c.codewords().length).toBe(4);
  for (const w of c.codewords()) expect(c.isCodeword(w)).toBe(true);
});

test("Reed–Solomon corrects up to (n − k)/2 errors", () => {
  const rs = reedSolomon({ p: 11, n: 10, k: 4 });
  const msg = [3, 1, 4, 1];
  const w = rs.encode(msg);
  const y = w.slice();
  y[0] = (y[0] + 1) % 11;
  y[5] = (y[5] + 3) % 11;
  y[9] = (y[9] + 7) % 11;
  const d = rs.decode(y);
  expect(d.message).toEqual(msg);
  expect(d.errors).toEqual([0, 5, 9]);
  expect(d.codeword).toEqual(w);
  // two codewords differ in at least n − k + 1 = 7 places
  expect(dist(rs.encode([0, 0, 0, 0]), rs.encode([1, 0, 0, 0]))).toBeGreaterThanOrEqual(7);
});

test("Latin squares and mutually orthogonal sets", () => {
  expect(isLatinSquare(cyclicLatinSquare(6)).latin).toBe(true);
  const L = orthogonalLatinSquares(5);
  expect(L.length).toBe(4);
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) expect(areOrthogonal(L[i], L[j]).orthogonal).toBe(true);
  expect(areOrthogonal(cyclicLatinSquare(4), cyclicLatinSquare(4)).orthogonal).toBe(false);
});

test("block designs: planes, Steiner triple systems, difference sets", () => {
  const params = (B) => {
    const b = blockDesign(B);
    return [b.v, b.b, b.k, b.r, b.lambda];
  };
  expect(params(projectivePlane(2))).toEqual([7, 7, 3, 3, 1]);
  expect(params(projectivePlane(3))).toEqual([13, 13, 4, 4, 1]);
  expect(params(affinePlane(3))).toEqual([9, 12, 3, 4, 1]);
  expect(params(steinerTripleSystem(9))).toEqual([9, 12, 3, 4, 1]);
  expect(params(steinerTripleSystem(15))).toEqual([15, 35, 3, 7, 1]);
  expect(params(fromDifferenceSet([1, 3, 4, 5, 9], 11))).toEqual([11, 11, 5, 5, 2]);
  // check λ independently for STS(15): every pair in exactly one block
  const B = steinerTripleSystem(15);
  const pts = [...new Set(B.flat())];
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) expect(B.filter((bl) => bl.includes(pts[i]) && bl.includes(pts[j])).length).toBe(1);
  expect(blockDesign([[1, 2], [2, 3]]).lambda).toBe(null);
});

test("Boolean functions come from @ratmath/logic", () => {
  expect(typeof truthTable).toBe("function");
  expect(String(minimize("a & b | a & !b").formula)).toBe("a");
  expect(logic.valid("p | !p").status).toBe("valid");
});
