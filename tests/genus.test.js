// The genus of a graph by rotation systems: each embedding returned is traced
// again by embeddingGenus, and the values are compared with Ringel–Youngs.
import { describe, expect, test } from "bun:test";
import * as D from "../index.js";

describe("genus by rotation systems", () => {
  test("K5, K3,3 and the Petersen graph embed in the torus and not the sphere", () => {
    for (const g of [D.complete(5), D.completeBipartite(3, 3), D.petersen()]) {
      const t = D.genus(g);
      expect(t.genus).toBe(1);
      expect(t.proven).toBe(true);
      const b = t.blocks[0];
      // the embedding returned is checked on its own: V − E + F = 0
      const again = D.embeddingGenus(g, b.rotation);
      expect(again.genus).toBe(1);
      expect(again.euler).toBe(0);
      expect(again.faces.length).toBe(b.faces.length);
      // every edge borders two face sides
      expect(again.faces.reduce((s, f) => s + f.length, 0)).toBe(2 * g.size);
    }
  });
  test("planar graphs have genus 0", () => {
    for (const g of [D.complete(4), D.cycleGraph(6), D.grid(3, 3), D.platonic("dodecahedron"), D.pathGraph(4)]) {
      const t = D.genus(g);
      expect(t.genus).toBe(0);
      expect(t.planar).toBe(true);
    }
  });
  test("Ringel–Youngs for K6 and K7; K4,4 and the 4-cube", () => {
    const ry = (n) => Math.ceil(((n - 3) * (n - 4)) / 12);
    for (const n of [5, 6, 7]) expect(D.genus(D.complete(n)).genus).toBe(ry(n));
    expect(D.genus(D.completeBipartite(4, 4)).genus).toBe(1);
    expect(D.genus(D.hypercube(4)).genus).toBe(1);
  });
  test("the genus adds over blocks", () => {
    // two copies of K5 sharing one vertex
    const g = D.graph({ edges: [] });
    const add = (vs) => vs.forEach((u, i) => vs.slice(i + 1).forEach((w) => g.addEdge(u, w)));
    add(["a", "b", "c", "d", "x"]);
    add(["p", "q", "r", "s", "x"]);
    const t = D.genus(g);
    expect(t.genus).toBe(2);
    expect(t.blocks.length).toBe(2);
  });
  test("bounds only when the search cannot close the gap, and a rotation that is not one", () => {
    const t = D.genus(D.complete(8));
    expect(t.lower).toBe(2);
    expect(t.upper).toBeGreaterThanOrEqual(2);
    if (!t.proven) expect(t.genus).toBe(null);
    expect(() => D.embeddingGenus(D.complete(4), { 1: [2, 3], 2: [1, 3, 4], 3: [1, 2, 4], 4: [1, 2, 3] })).toThrow();
    // the planar rotation of K4 and a toroidal one
    expect(D.embeddingGenus(D.complete(4), { 1: [2, 3, 4], 2: [1, 4, 3], 3: [1, 2, 4], 4: [1, 3, 2] }).genus).toBe(0);
    expect(D.embeddingGenus(D.complete(4), { 1: [2, 3, 4], 2: [1, 3, 4], 3: [1, 2, 4], 4: [1, 2, 3] }).genus).toBe(1);
  });
});
