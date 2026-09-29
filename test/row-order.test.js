/**
 * H64 — Roster row highlight: ↑/↓ pick the neighbouring visible row (selection only, never reorders).
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubLocalStorage, baseDoc } from "./helpers.js";

stubLocalStorage();

const { S } = await import("../src/js/state.js");
const { migrateToV2, activePeople } = await import("../src/js/model.js");
const { adjacentPersonId } = await import("../src/js/generator.js");

const person = (id, active = true) => ({ id, name: id.toUpperCase(), active, fixedRoleId: null });
const order = () => activePeople().map((p) => p.id);

function load(people) {
  S.data = migrateToV2(baseDoc({ people }));
  S.dirty = false;
}

beforeEach(() => localStorage.clear());

describe("H64 adjacentPersonId (arrow-key navigation)", () => {
  it("returns the visible row above / below, skipping inactive people", () => {
    load([person("a"), person("x", false), person("b"), person("c")]);
    assert.equal(adjacentPersonId("a", 1), "b");
    assert.equal(adjacentPersonId("b", -1), "a");
    assert.equal(adjacentPersonId("b", 1), "c");
  });

  it("returns null at the ends and for an unknown person, and never changes the order", () => {
    load([person("a"), person("b")]);
    assert.equal(adjacentPersonId("a", -1), null);
    assert.equal(adjacentPersonId("b", 1), null);
    assert.equal(adjacentPersonId("zzz", 1), null);
    assert.deepEqual(order(), ["a", "b"]);
    assert.equal(S.dirty, false);
  });
});
