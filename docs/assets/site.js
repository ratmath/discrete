// Shared page furniture for the discrete docs: the contents column, the theme
// switch and the code boxes. Add each topic page to PAGES as it is written.

import * as A from "./discrete.js?v=a9f47ac7f9";
import { mountRunboxes } from "./runbox.js?v=a9f47ac7f9";

export { A };

export const PAGES = [
  { href: "index.html", title: "Overview" },
  { href: "reference.html", title: "Reference" },
  { href: "explore.html", title: "Explore" },
  { group: "Topics" },
  { href: "counting.html", title: "Counting", blurb: "Binomials, Stirling, Bell, Catalan, partitions: exact at any size" },
  { href: "inclusion-exclusion.html", title: "Inclusion and exclusion", blurb: "Unions by adding and subtracting, the sieve formula, pigeonholes" },
  { href: "enumeration.html", title: "Enumeration", blurb: "Every family as a numbered list: rank, unrank, iterate, draw" },
  { href: "random.html", title: "The seeded generator", blurb: "Reproducible streams, exactly uniform integers, exact probabilities" },
  { group: "Generating functions and recurrences" },
  { href: "generating-functions.html", title: "Generating functions", blurb: "Exact power series: products, reciprocals, composition, exp and log, EGFs, rational series" },
  { href: "recurrences.html", title: "Recurrences", blurb: "Closed forms with exact algebraic roots, Berlekamp–Massey, closed sums, the master theorem" },
  { group: "Graphs" },
  { href: "graphs.html", title: "Graphs", blurb: "Graphs as text, exact weights, the standard families, products and line graphs" },
  { href: "connectivity.html", title: "Connectivity", blurb: "Searches, components, bridges, strong components, topological order, two colours" },
  { href: "shortest-paths.html", title: "Shortest paths", blurb: "Dijkstra, Bellman–Ford, Floyd–Warshall with exact distances; negative cycles as the reason" },
  { href: "tours.html", title: "Euler and Hamilton", blurb: "Every edge once by Hierholzer; every vertex once by exhaustive search" },
  { href: "trees.html", title: "Trees", blurb: "Minimum spanning trees, the matrix-tree theorem, Prüfer codes and Cayley's formula" },
  { group: "Graph theory" },
  { href: "matchings-flows.html", title: "Matchings and flows", blurb: "Blossoms with Tutte–Berge sets, König and Hall, assignment, stable matching, max flow and min cut" },
  { href: "colouring.html", title: "Colouring and cliques", blurb: "Chromatic number with the reason no fewer colours work, the chromatic polynomial, cliques" },
  { href: "planarity.html", title: "Planarity", blurb: "Faces for a planar graph, a Kuratowski subdivision for one that is not" },
  { href: "isomorphism-spectra.html", title: "Isomorphism and spectra", blurb: "Colour refinement, automorphism groups, exact eigenvalues, walks and spanning trees" },
  { group: "Optimisation and games" },
  { href: "linear-programming.html", title: "Linear programming", blurb: "An exact simplex method; every answer with its proof: dual prices, a Farkas vector or a ray" },
  { href: "integer-programs.html", title: "Integer programs", blurb: "Branch and bound on exact relaxations, for small problems" },
  { href: "matrix-games.html", title: "Matrix games", blurb: "Zero-sum games: optimal mixed strategies and the value as fractions" },
  { href: "bimatrix-games.html", title: "Bimatrix games", blurb: "Dominance, every Nash equilibrium by support enumeration, Lemke–Howson" },
  { href: "combinatorial-games.html", title: "Combinatorial games", blurb: "Sprague–Grundy, nim, Conway's numbers, nimbers and up, backward induction" },
  { href: "cooperative-voting.html", title: "Cooperative games and voting", blurb: "Shapley values, the core or a balanced certificate, voting power, voting methods, apportionment" },
  { group: "Orders and structures" },
  { href: "relations-orders.html", title: "Relations and orders", blurb: "Properties with counterexamples, closures, Hasse diagrams, Dilworth, Möbius functions, lattices" },
  { href: "polya.html", title: "Pólya counting", blurb: "Colourings up to symmetry: Burnside's lemma, the cycle index, the pattern inventory" },
  { group: "Codes and designs" },
  { href: "codes.html", title: "Error-correcting codes", blurb: "Linear codes, syndrome decoding with steps, Hamming codes, bounds, Reed–Solomon" },
  { href: "designs.html", title: "Latin squares and designs", blurb: "Orthogonal Latin squares, block designs, finite planes, difference sets, Steiner triple systems" },
];

export const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid !== null && kid !== undefined && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  return el;
};

// ---- chrome -------------------------------------------------------------------

function theme() {
  let saved = null;
  try {
    saved = localStorage.getItem("ratmath-theme");
  } catch {
    /* storage may be blocked */
  }
  const apply = (t) => {
    if (t === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
    try {
      localStorage.setItem("ratmath-theme", t);
    } catch {
      /* ignore */
    }
    for (const b of document.querySelectorAll(".theme button")) b.classList.toggle("on", b.dataset.t === t);
  };
  if (saved) apply(saved);
  return h("div", { class: "theme", role: "group", "aria-label": "Theme" },
    ["auto", "light", "dark"].map((t) => h("button", { "data-t": t, class: (saved ?? "auto") === t ? "on" : "", onclick: () => apply(t) }, t)));
}

function chrome() {
  const here = location.pathname.split("/").pop() || "index.html";
  const aside = document.querySelector("aside");
  if (!aside) return;
  const nav = h("nav", { class: "toc", "aria-label": "Contents" });
  const sel = h("select", { id: "toc-select", "aria-label": "Page", onchange: (e) => (location.href = e.target.value) });
  let group = null;
  for (const p of PAGES) {
    if (p.group) {
      nav.append(h("div", { class: "group" }, p.group));
      group = h("optgroup", { label: p.group });
      sel.append(group);
      continue;
    }
    nav.append(h("a", { href: p.href, class: p.href === here ? "on" : null, "aria-current": p.href === here ? "page" : null }, p.title));
    (group ?? sel).append(h("option", { value: p.href, selected: p.href === here }, p.title));
  }
  aside.append(
    h("header", { class: "brand" }, h("a", { href: "index.html" }, h("div", { class: "mark" }, "RatMath ", h("span", {}, "discrete"))), h("small", {}, "Counting, graphs and games")),
    sel, nav, theme(),
  );
}

/** Topic cards for the overview page (pages that have a blurb). */
export function topicCards(el) {
  el.append(...PAGES.filter((p) => p.blurb).map((p) => h("a", { href: p.href }, h("strong", {}, p.title), h("span", {}, p.blurb))));
}

chrome();
mountRunboxes(document, { scope: A });
