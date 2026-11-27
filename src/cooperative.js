// Cooperative games, voting and apportionment, where exact fractions decide
// the outcome.
//
// A cooperative game gives each coalition a value. The Shapley value shares
// the grand coalition's value by average marginal contribution; the core is
// the set of shares no coalition can improve on, found (or shown empty) by
// exact linear programming: when it is empty, the dual solution is a balanced
// collection of coalitions that proves it (Bondareva and Shapley).

import { Rational } from "@ratmath/core";
import { refuse } from "./counting.js";
import { exact, linearProgram, solveSquare } from "./lp.js";

const ZERO = new Rational(0n);
const ONE = new Rational(1n);
const fact = (n) => {
  let f = 1n;
  for (let i = 2n; i <= BigInt(n); i++) f *= i;
  return f;
};

/**
 * A cooperative game on named players: value(coalition) with the coalition
 * an array of player names (in any order). Give the values as a function, or
 * as an object keyed by the sorted names joined with commas ("" for none).
 */
export function cooperativeGame(players, values) {
  const P = players.map(String);
  const memo = new Map();
  const v = (coalition) => {
    const k = [...coalition].map(String).sort().join(",");
    if (memo.has(k)) return memo.get(k);
    let x;
    if (typeof values === "function") x = values([...coalition].map(String).sort());
    else x = values[k] ?? (k === "" ? 0 : refuse("bad-argument", `no value given for the coalition {${k}}`));
    const r = exact(x, "value");
    memo.set(k, r);
    return r;
  };
  return Object.freeze({ players: P, value: v });
}
const subsetsOf = (P) => {
  const out = [];
  for (let m = 0; m < 1 << P.length; m++) out.push(P.filter((_, i) => (m >> i) & 1));
  return out;
};

/** The Shapley value: φᵢ = Σ over coalitions S without i of |S|!(n − |S| − 1)!/n! · (v(S ∪ {i}) − v(S)). */
export function shapley(game) {
  const { players: P, value: v } = game;
  const n = P.length;
  const nf = fact(n);
  const out = {};
  for (const i of P) {
    let s = ZERO;
    for (const S of subsetsOf(P.filter((p) => p !== i))) {
      const w = new Rational(fact(S.length) * fact(n - S.length - 1), nf);
      s = s.add(w.multiply(v([...S, i]).subtract(v(S))));
    }
    out[i] = s;
  }
  return out;
}

/**
 * The core: an allocation x with x(N) = v(N) and x(S) ≥ v(S) for every
 * coalition S, or the proof there is none.
 *   { empty: false, allocation: { player: Rational } }
 *   { empty: true, balanced: [{ coalition, weight }], reason }
 * Solved as: minimise Σ xᵢ subject to x(S) ≥ v(S) for all S. The minimum is
 * v(N) exactly when the core is not empty; otherwise the dual weights λ_S are
 * balanced (each player's coalitions weigh 1 in total) and Σ λ_S v(S) > v(N).
 */
export function core(game) {
  const { players: P, value: v } = game;
  const coalitions = subsetsOf(P).filter((S) => S.length);
  const constraints = coalitions.map((S) => ({ coefficients: Object.fromEntries(S.map((p) => [p, 1])), relation: ">=", rhs: v(S), name: S.join(",") }));
  const r = linearProgram({ minimize: Object.fromEntries(P.map((p) => [p, 1])), constraints, names: P, free: P });
  if (r.status !== "optimal") throw new Error("internal: the core's program is always bounded");
  const vN = v(P);
  if (r.value.equals(vN)) return Object.freeze({ empty: false, allocation: r.solution });
  const prices = r.prices;
  const balanced = coalitions.map((S) => ({ coalition: S, weight: prices[S.join(",")] })).filter((x) => x.weight.numerator !== 0n);
  const total = balanced.reduce((s, b) => s.add(b.weight.multiply(v(b.coalition))), ZERO);
  return Object.freeze({ empty: true, balanced, reason: `these coalitions, with these weights, cover every player exactly once and are worth ${total} together, more than v(N) = ${vN}` });
}
/**
 * The vertices of the core polytope, by exact linear algebra: every vertex
 * makes x(N) = v(N) and n − 1 independent coalition constraints tight, so the
 * candidates are solved exactly and kept when they satisfy every constraint.
 *   { kind: "empty" | "point" | "polytope", vertices: [allocation], dimension }
 * `kind` is "empty" with no vertices, "point" when the core is one
 * allocation, and "polytope" otherwise (dimension 1 is a segment). For up to
 * 6 players.
 */
export function coreVertices(game) {
  const { players: P, value: v } = game;
  const n = P.length;
  if (n > 6) refuse("too-hard", "coreVertices enumerates tight sets of constraints and is limited to 6 players");
  const first = core(game);
  if (first.empty) return Object.freeze({ kind: "empty", vertices: [], dimension: -1, balanced: first.balanced });
  const coalitions = subsetsOf(P).filter((S) => S.length && S.length < n);
  const row = (S) => P.map((p) => (S.includes(p) ? ONE : ZERO));
  const vN = v(P);
  const feasible = (x) => coalitions.every((S) => S.reduce((s, p) => s.add(x[P.indexOf(p)]), ZERO).greaterThanOrEqual(v(S)));
  const seen = new Map();
  const choose = (start, picked) => {
    if (picked.length === n - 1) {
      const x = solveSquare([row(P), ...picked.map(row)], [vN, ...picked.map(v)]);
      if (x && feasible(x)) {
        const key = x.map(String).join(",");
        if (!seen.has(key)) seen.set(key, x);
      }
      return;
    }
    for (let k = start; k < coalitions.length; k++) choose(k + 1, [...picked, coalitions[k]]);
  };
  if (n === 1) seen.set(String(vN), [vN]);
  else choose(0, []);
  const pts = [...seen.values()];
  // the dimension is the rank of the differences from the first vertex
  const diffs = pts.slice(1).map((x) => x.map((c, i) => c.subtract(pts[0][i])));
  const dimension = rank(diffs);
  return Object.freeze({
    kind: pts.length === 1 ? "point" : "polytope",
    vertices: pts.map((x) => Object.fromEntries(P.map((p, i) => [p, x[i]]))),
    dimension,
  });
}
function rank(rows) {
  const A = rows.map((r) => [...r]);
  let r = 0;
  const cols = A.length ? A[0].length : 0;
  for (let c = 0; c < cols && r < A.length; c++) {
    let p = r;
    while (p < A.length && A[p][c].numerator === 0n) p++;
    if (p === A.length) continue;
    [A[r], A[p]] = [A[p], A[r]];
    for (let i = 0; i < A.length; i++) {
      if (i === r || A[i][c].numerator === 0n) continue;
      const f = A[i][c].divide(A[r][c]);
      A[i] = A[i].map((x, k) => x.subtract(f.multiply(A[r][k])));
    }
    r++;
  }
  return r;
}

/** Is the allocation in the core? { inCore, blocking: coalition that gets less than its value, or null } */
export function inCore(game, allocation) {
  const { players: P, value: v } = game;
  const x = Object.fromEntries(P.map((p) => [p, exact(allocation[p] ?? 0, "share")]));
  const total = P.reduce((s, p) => s.add(x[p]), ZERO);
  if (!total.equals(v(P))) return { inCore: false, blocking: null, reason: `the shares add to ${total}, not v(N) = ${v(P)}` };
  for (const S of subsetsOf(P)) {
    if (!S.length) continue;
    const xs = S.reduce((s, p) => s.add(x[p]), ZERO);
    if (xs.lessThan(v(S))) return { inCore: false, blocking: S, reason: `{${S.join(", ")}} gets ${xs} but is worth ${v(S)} alone` };
  }
  return { inCore: true, blocking: null };
}

/**
 * A weighted voting game [quota; w₁, …, wₙ]: a coalition wins when its weight
 * reaches the quota. Returns the game with its Shapley–Shubik and Banzhaf
 * power indices (exact fractions) and the dummies (players who are never
 * pivotal).
 */
export function weightedVoting({ quota, weights }) {
  const P = Object.keys(weights);
  const W = Object.fromEntries(P.map((p) => [p, exact(weights[p], "weight")]));
  const q = exact(quota, "quota");
  const wins = (S) => S.reduce((s, p) => s.add(W[p]), ZERO).greaterThanOrEqual(q);
  const game = cooperativeGame(P, (S) => (wins(S) ? 1 : 0));
  const ss = shapley(game);
  const swings = Object.fromEntries(P.map((p) => [p, 0n]));
  for (const S of subsetsOf(P)) if (wins(S)) for (const p of S) if (!wins(S.filter((x) => x !== p))) swings[p]++;
  const totalSwings = Object.values(swings).reduce((a, b) => a + b, 0n);
  const banzhaf = Object.fromEntries(P.map((p) => [p, totalSwings ? new Rational(swings[p], totalSwings) : ZERO]));
  return Object.freeze({ game, shapleyShubik: ss, banzhaf, swings, dummies: P.filter((p) => swings[p] === 0n) });
}

// ---- voting -------------------------------------------------------------------------------------------

/**
 * Ballots: an array of rankings (each an array of candidates, best first), or
 * [{ ranking, count }] for repeated ballots. Rankings may leave candidates
 * out (they rank below everyone listed).
 */
function readBallots(ballots) {
  const out = ballots.map((b) => (Array.isArray(b) ? { ranking: b.map(String), count: 1n } : { ranking: b.ranking.map(String), count: BigInt(b.count ?? 1) }));
  const candidates = [...new Set(out.flatMap((b) => b.ranking))];
  return { ballots: out, candidates };
}
const winnersOf = (score, better = (a, b) => a > b) => {
  let best = null;
  for (const v of score.values()) if (best === null || better(v, best)) best = v;
  return [...score].filter(([, v]) => !better(best, v) && !better(v, best)).map(([c]) => c);
};

/** Plurality: most first places. { winners, tally } */
export function plurality(ballots) {
  const { ballots: B, candidates } = readBallots(ballots);
  const tally = new Map(candidates.map((c) => [c, 0n]));
  for (const b of B) if (b.ranking.length) tally.set(b.ranking[0], tally.get(b.ranking[0]) + b.count);
  return Object.freeze({ winners: winnersOf(tally), tally: Object.fromEntries(tally) });
}
/** The Borda count: with n candidates, a ballot gives n − 1 points to its first, n − 2 to its second, … */
export function borda(ballots) {
  const { ballots: B, candidates } = readBallots(ballots);
  const n = BigInt(candidates.length);
  const tally = new Map(candidates.map((c) => [c, 0n]));
  for (const b of B) b.ranking.forEach((c, i) => tally.set(c, tally.get(c) + b.count * (n - 1n - BigInt(i))));
  return Object.freeze({ winners: winnersOf(tally), tally: Object.fromEntries(tally) });
}
/**
 * Instant runoff: drop the candidate with fewest first places, move those
 * ballots to their next choice, repeat until someone has a majority of the
 * ballots still counting. A tie for last is reported and all tied are dropped.
 * { winners, rounds: [{ tally, eliminated }] }
 */
export function instantRunoff(ballots) {
  const { ballots: B, candidates } = readBallots(ballots);
  let alive = new Set(candidates);
  const rounds = [];
  for (;;) {
    const tally = new Map([...alive].map((c) => [c, 0n]));
    let counting = 0n;
    for (const b of B) {
      const top = b.ranking.find((c) => alive.has(c));
      if (top !== undefined) {
        tally.set(top, tally.get(top) + b.count);
        counting += b.count;
      }
    }
    const top = winnersOf(tally);
    if (top.length === 1 && tally.get(top[0]) * 2n > counting) {
      rounds.push({ tally: Object.fromEntries(tally), eliminated: [] });
      return Object.freeze({ winners: top, rounds });
    }
    if (alive.size === top.length) {
      rounds.push({ tally: Object.fromEntries(tally), eliminated: [] });
      return Object.freeze({ winners: top, rounds, tie: true });
    }
    const last = winnersOf(tally, (a, b) => a < b);
    rounds.push({ tally: Object.fromEntries(tally), eliminated: last });
    alive = new Set([...alive].filter((c) => !last.includes(c)));
  }
}
/**
 * Head-to-head counts: pairwise[a][b] = ballots ranking a above b. The
 * Condorcet winner beats every other candidate head to head; there may be
 * none, and then a cycle of majorities is reported.
 * { pairwise, winner, copeland: { candidate: wins − losses }, cycle }
 */
export function condorcet(ballots) {
  const { ballots: B, candidates } = readBallots(ballots);
  const pw = Object.fromEntries(candidates.map((a) => [a, Object.fromEntries(candidates.filter((b) => b !== a).map((b) => [b, 0n]))]));
  for (const b of B) {
    const pos = (c) => {
      const i = b.ranking.indexOf(c);
      return i < 0 ? Infinity : i;
    };
    for (const a of candidates) for (const c of candidates) if (a !== c && pos(a) < pos(c)) pw[a][c] += b.count;
  }
  const beats = (a, c) => pw[a][c] > pw[c][a];
  const winner = candidates.find((a) => candidates.every((c) => c === a || beats(a, c))) ?? null;
  const copeland = Object.fromEntries(candidates.map((a) => [a, candidates.filter((c) => c !== a && beats(a, c)).length - candidates.filter((c) => c !== a && beats(c, a)).length]));
  let cycle = null;
  if (!winner) {
    // a cycle in the majority relation, if any
    const nextOf = (a) => candidates.filter((c) => c !== a && beats(a, c));
    const dfs = (path) => {
      for (const c of nextOf(path[path.length - 1])) {
        if (c === path[0] && path.length > 2) return [...path, c];
        if (!path.includes(c)) {
          const r = dfs([...path, c]);
          if (r) return r;
        }
      }
      return null;
    };
    for (const a of candidates) if ((cycle = dfs([a]))) break;
  }
  return Object.freeze({ pairwise: pw, winner, copeland, cycle });
}
/** Approval voting: ballots are sets of approved candidates. */
export function approval(ballots) {
  const tally = new Map();
  for (const b of ballots) for (const c of new Set(b.map(String))) tally.set(c, (tally.get(c) ?? 0n) + 1n);
  return Object.freeze({ winners: winnersOf(tally), tally: Object.fromEntries(tally) });
}

// ---- apportionment ------------------------------------------------------------------------------------

/**
 * Share `seats` among states in proportion to `populations`, exactly.
 *   method: "hamilton" (largest remainders), "jefferson" (D'Hondt),
 *           "webster" (Sainte-Laguë), "adams", "huntington-hill"
 * Divisor methods give seats one at a time to the state with the highest
 * priority p/d(s), where d(s) is s + 1, s + 1/2, s, or √(s(s+1)) (compared
 * exactly by squaring). Ties for a last seat are reported, not broken.
 * { seats: { state: n }, quotas: { state: Rational }, method, tie }
 */
export function apportion(populations, seats, { method = "hamilton" } = {}) {
  const S = Object.keys(populations);
  const pop = Object.fromEntries(S.map((s) => [s, exact(populations[s], "population")]));
  const total = S.reduce((a, s) => a.add(pop[s]), ZERO);
  const h = BigInt(seats);
  const quotas = Object.fromEntries(S.map((s) => [s, pop[s].multiply(new Rational(h)).divide(total)]));
  const out = Object.fromEntries(S.map((s) => [s, 0n]));
  let tie = null;
  if (method === "hamilton") {
    let given = 0n;
    for (const s of S) {
      out[s] = quotas[s].floor().numerator ?? BigInt(quotas[s].floor());
      given += out[s];
    }
    const rem = S.map((s) => ({ s, r: quotas[s].subtract(new Rational(out[s])) })).sort((a, b) => b.r.compareTo(a.r));
    const left = Number(h - given);
    for (let i = 0; i < left; i++) out[rem[i].s] += 1n;
    if (left < rem.length && left > 0 && rem[left].r.equals(rem[left - 1].r)) tie = rem.filter((x) => x.r.equals(rem[left - 1].r)).map((x) => x.s);
  } else {
    const prio = {
      jefferson: (p, s) => ({ num: p, den2: null, den: new Rational(s + 1n) }),
      webster: (p, s) => ({ num: p, den: new Rational(2n * s + 1n, 2n) }),
      adams: (p, s) => ({ num: p, den: s === 0n ? null : new Rational(s) }),
      "huntington-hill": (p, s) => ({ num: p, sq: s * (s + 1n) }),
    }[method];
    if (!prio) refuse("bad-argument", "method is hamilton, jefferson, webster, adams or huntington-hill");
    // compare priorities exactly; null denominator = infinite priority
    const cmp = (a, b) => {
      const A = prio(pop[a], out[a]);
      const B = prio(pop[b], out[b]);
      if (method === "huntington-hill") {
        if (A.sq === 0n || B.sq === 0n) return A.sq === 0n && B.sq === 0n ? pop[a].compareTo(pop[b]) : A.sq === 0n ? 1 : -1;
        // p_a²/sq_a vs p_b²/sq_b
        return pop[a].multiply(pop[a]).multiply(new Rational(B.sq)).compareTo(pop[b].multiply(pop[b]).multiply(new Rational(A.sq)));
      }
      if (A.den === null || B.den === null) return A.den === null && B.den === null ? pop[a].compareTo(pop[b]) : A.den === null ? 1 : -1;
      return A.num.divide(A.den).compareTo(B.num.divide(B.den));
    };
    for (let k = 0n; k < h; k++) {
      const order = [...S].sort((a, b) => cmp(b, a));
      if (k === h - 1n && order.length > 1 && cmp(order[0], order[1]) === 0) tie = order.filter((s) => cmp(s, order[0]) === 0);
      out[order[0]] += 1n;
    }
  }
  return Object.freeze({ seats: out, quotas, method, tie });
}

/**
 * Adjusted winner (Brams and Taylor) for two parties who each spread 100
 * points (or any equal totals) over the items. Each item first goes to whoever
 * values it more; then items pass from the richer to the poorer in increasing
 * order of the ratio of their values, and the last is split by an exact
 * fraction so both end with the same number of points.
 * { A: { item: share }, B: { item: share }, points: Rational }
 */
export function adjustedWinner(a, b) {
  const items = Object.keys(a);
  const va = Object.fromEntries(items.map((i) => [i, exact(a[i], "points")]));
  const vb = Object.fromEntries(items.map((i) => [i, exact(b[i] ?? 0, "points")]));
  const one = new Rational(1n);
  const shareA = Object.fromEntries(items.map((i) => [i, va[i].greaterThanOrEqual(vb[i]) ? one : ZERO]));
  const pts = (who) => items.reduce((s, i) => s.add((who === "A" ? va[i].multiply(shareA[i]) : vb[i].multiply(one.subtract(shareA[i])))), ZERO);
  let PA = pts("A");
  let PB = pts("B");
  if (!PA.equals(PB)) {
    const richA = PA.greaterThan(PB);
    // the richer party's items, by ratio richer/poorer value, smallest first
    const mine = items.filter((i) => (richA ? shareA[i].equals(one) : shareA[i].equals(ZERO)));
    const ratio = (i) => (richA ? (vb[i].numerator === 0n ? null : va[i].divide(vb[i])) : va[i].numerator === 0n ? null : vb[i].divide(va[i]));
    mine.sort((x, y) => {
      const rx = ratio(x);
      const ry = ratio(y);
      return rx === null ? 1 : ry === null ? -1 : rx.compareTo(ry);
    });
    for (const i of mine) {
      if (ratio(i) === null) break;
      // move fraction t of item i: rich loses t·v_rich, poor gains t·v_poor
      const vr = richA ? va[i] : vb[i];
      const vp = richA ? vb[i] : va[i];
      const gap = richA ? PA.subtract(PB) : PB.subtract(PA);
      const t = gap.divide(vr.add(vp));
      if (t.greaterThanOrEqual(one)) {
        shareA[i] = richA ? ZERO : one;
        PA = pts("A");
        PB = pts("B");
        if (PA.equals(PB)) break;
        if (richA !== PA.greaterThan(PB)) break; // cannot happen when t ≥ 1 was exact
        continue;
      }
      shareA[i] = richA ? one.subtract(t) : t;
      PA = pts("A");
      PB = pts("B");
      break;
    }
  }
  return Object.freeze({
    A: Object.fromEntries(items.filter((i) => shareA[i].numerator !== 0n).map((i) => [i, shareA[i]])),
    B: Object.fromEntries(items.filter((i) => !shareA[i].equals(one)).map((i) => [i, one.subtract(shareA[i])])),
    points: { A: PA, B: PB },
  });
}
