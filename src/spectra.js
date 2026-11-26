// Algebraic graph theory: the characteristic polynomial of the adjacency or
// Laplacian matrix, computed exactly over the integers, and its roots (the
// spectrum) as exact algebraic numbers with their multiplicities. The matrix
// is symmetric for an undirected graph, so every eigenvalue is real.
//
// Walks are counted by powers of the adjacency matrix, and the number of
// spanning trees can be read from the Laplacian spectrum (the matrix-tree
// theorem in the form τ = (λ₂ ⋯ λₙ)/n), which the tests set against the
// determinant count of trees.js.

import * as alg from "@ratmath/algebraic";
import { refuse } from "./counting.js";
import { formatInt } from "./colouring.js";

/** The adjacency matrix (BigInt entries, loops counted twice when undirected) and vertex order. */
export function adjacency(g) {
  const { vertices, matrix } = g.adjacencyMatrix();
  return { vertices, matrix: matrix.map((r) => r.map(BigInt)) };
}
/** The Laplacian D − A of an undirected graph (loops ignored). */
export function laplacian(g) {
  if (g.directed) refuse("bad-argument", "the Laplacian here is for undirected graphs");
  const { vertices, matrix } = adjacency(g);
  const L = matrix.map((r, i) => r.map((x, j) => (i === j ? 0n : -x)));
  L.forEach((r, i) => (r[i] = -r.reduce((s, x) => s + x, 0n)));
  return { vertices, matrix: L };
}

/**
 * det(xI − M) for an integer matrix, by the Faddeev–LeVerrier recursion done
 * with exact division (the divisions are exact over the integers):
 *   N₀ = I, cₙ = 1;  Mₖ = M·Nₖ₋₁,  cₙ₋ₖ = −tr(Mₖ)/k,  Nₖ = Mₖ + cₙ₋ₖ I.
 * Coefficients as BigInts, constant first.
 */
export function characteristicPolynomial(matrix) {
  const n = matrix.length;
  const M = matrix.map((r) => r.map(BigInt));
  const c = new Array(n + 1).fill(0n);
  c[n] = 1n;
  let N = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1n : 0n)));
  for (let k = 1; k <= n; k++) {
    const Mk = M.map((row) => N[0].map((_, j) => row.reduce((s, a, t) => (a === 0n ? s : s + a * N[t][j]), 0n)));
    let tr = 0n;
    for (let i = 0; i < n; i++) tr += Mk[i][i];
    if (tr % BigInt(k) !== 0n) throw new Error("internal: Faddeev–LeVerrier division is not exact");
    c[n - k] = -tr / BigInt(k);
    N = Mk.map((r, i) => r.map((x, j) => (i === j ? x + c[n - k] : x)));
  }
  return c;
}

/**
 * The spectrum: eigenvalues with multiplicities, exact.
 *   spectrum(g)                    of the adjacency matrix
 *   spectrum(g, { laplacian: true })
 * { polynomial (BigInts, constant first), eigenvalues: [{ value, multiplicity, text }], toString() }
 * `value` is an algebraic number (`value.rational` when rational); `text`
 * is its exact form when quadratic, certified digits otherwise.
 */
export function spectrum(g, { laplacian: lap = false } = {}) {
  const { matrix } = lap ? laplacian(g) : adjacency(g);
  const p = characteristicPolynomial(matrix);
  if (p.length === 1) return Object.freeze({ polynomial: p, eigenvalues: [], toString: () => "∅" });
  const rs = alg.roots(p, { complex: g.directed });
  const eigenvalues = rs.map(({ value, multiplicity }) => Object.freeze({ value, multiplicity, text: alg.format(value) }));
  const total = eigenvalues.reduce((s, e) => s + e.multiplicity, 0);
  if (total !== matrix.length && !g.directed) throw new Error("internal: a symmetric matrix has only real eigenvalues");
  return Object.freeze({
    polynomial: p,
    eigenvalues,
    toString: () => eigenvalues.map((e) => (e.multiplicity > 1 ? `${e.text} (×${e.multiplicity})` : e.text)).join(", "),
    polynomialText: formatInt(p, "x"),
  });
}

/** The number of walks of length k between every pair of vertices: the matrix A^k (BigInts). */
export function walks(g, k) {
  if (!Number.isInteger(k) || k < 0) refuse("bad-argument", "k is a whole number ≥ 0");
  const { vertices, matrix: A } = adjacency(g);
  const n = A.length;
  const mul = (X, Y) => X.map((row) => Y[0].map((_, j) => row.reduce((s, a, t) => s + a * Y[t][j], 0n)));
  let out = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1n : 0n)));
  let b = A;
  let e = k;
  while (e > 0) {
    if (e & 1) out = mul(out, b);
    b = mul(b, b);
    e >>= 1;
  }
  return { vertices, matrix: out, closed: out.reduce((s, r, i) => s + r[i], 0n) };
}

/**
 * The number of spanning trees from the Laplacian's characteristic
 * polynomial: (−1)^(n−1)·(coefficient of x)/n, which is the product of the
 * non-zero eigenvalues over n for a connected graph (and 0 otherwise).
 */
export function spanningTreesFromSpectrum(g) {
  const { matrix } = laplacian(g);
  const n = matrix.length;
  if (n === 0) return 0n;
  const p = characteristicPolynomial(matrix);
  const v = (n % 2 === 1 ? p[1] : -p[1]) / BigInt(n);
  return v;
}
