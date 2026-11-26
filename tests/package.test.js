import { expect, test } from "bun:test";
import * as lib from "../index.js";

test("the package loads and says what is still planned", () => {
  expect(Array.isArray(lib.plan)).toBe(true);
  expect(lib.plan.length).toBe(6);
  lib.plan.forEach((p, i) => {
    expect(p.phase).toBe([3, 4, 6, 7, 8, 9][i]);
    expect(typeof p.contents).toBe("string");
    expect(typeof p.estimate).toBe("string");
  });
  expect(Object.isFrozen(lib.plan)).toBe(true);
});
