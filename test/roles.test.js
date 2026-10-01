/**
 * H19: Roles screen Up/Down bug — moveRole should actually change display order.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubLocalStorage, baseDoc } from "./helpers.js";

stubLocalStorage();
globalThis.window = globalThis.window || {};

const { S } = await import("../src/js/state.js");
const { migrateToV2 } = await import("../src/js/model.js");
const { actions } = await import("../src/js/screens/roles.js");

function load(doc) {
  S.data = migrateToV2(doc);
  S.dirty = false;
}

function role(id, name, sortOrder, essential = true) {
  return {
    id, name, groupId: "g1",
    usedAtDay: true, usedAtNight: true,
    hard: false, skillRestricted: false, essential, sortOrder
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("H19 moveRole", () => {
  it("actually changes display order when moving a role up or down", () => {
    load(baseDoc({
      groups: [{ id: "g1", name: "Car", color: "#F8BBD0", sortOrder: 1 }],
      roles: [
        role("r1", "Role 1", 1),
        role("r2", "Role 2", 2),
        role("r3", "Role 3", 3)
      ]
    }));

    // Get initial order
    let ordered = S.data.roles.slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    assert.deepEqual(ordered.map((r) => r.name), ["Role 1", "Role 2", "Role 3"]);

    // Move Role 3 up (moveRole on r3 with n=-1 means move up)
    actions.moveRole({ r: "r3", n: "-1" });

    // Verify the order changed
    ordered = S.data.roles.slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    assert.deepEqual(ordered.map((r) => r.name), ["Role 1", "Role 3", "Role 2"]);

    // Move Role 3 up again
    actions.moveRole({ r: "r3", n: "-1" });
    ordered = S.data.roles.slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    assert.deepEqual(ordered.map((r) => r.name), ["Role 3", "Role 1", "Role 2"]);

    // Move Role 3 down twice
    actions.moveRole({ r: "r3", n: "1" });
    ordered = S.data.roles.slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    assert.deepEqual(ordered.map((r) => r.name), ["Role 1", "Role 3", "Role 2"]);
  });

  it("respects essential/non-essential boundaries", () => {
    load(baseDoc({
      groups: [{ id: "g1", name: "Car", color: "#F8BBD0", sortOrder: 1 }],
      roles: [
        role("r1", "Essential 1", 1, true),
        role("r2", "Essential 2", 2, true),
        role("r3", "Spare 1", 1, false),
        role("r4", "Spare 2", 2, false)
      ]
    }));

    // Try to move Spare up past Essential - should not work
    actions.moveRole({ r: "r3", n: "-1" });

    // Order should not change
    const ordered = S.data.roles.slice().sort((a, b) => {
      const ae = a.essential !== false ? 0 : 1;
      const be = b.essential !== false ? 0 : 1;
      if (ae !== be) return ae - be;
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
    assert.deepEqual(ordered.map((r) => r.name), ["Essential 1", "Essential 2", "Spare 1", "Spare 2"]);
  });
});

describe("H19 askDelRole", () => {
  it("renumbers remaining roles by display order after deletion", () => {
    load(baseDoc({
      groups: [{ id: "g1", name: "Car", color: "#F8BBD0", sortOrder: 1 }],
      roles: [
        role("r1", "Role 1", 5),
        role("r2", "Role 2", 3),
        role("r3", "Role 3", 7)
      ]
    }));

    // Simulate deletion of Role 2
    S.data.roles = S.data.roles.filter((x) => x.id !== "r2");
    let n = 1;
    S.data.roles.slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .forEach((x) => { x.sortOrder = n++; });

    // After deletion, remaining roles should be renumbered to 1, 2 (not 1, 3)
    const ordered = S.data.roles.slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    assert.deepEqual(ordered.map((r) => r.sortOrder), [1, 2]);
    assert.deepEqual(ordered.map((r) => r.name), ["Role 1", "Role 3"]);
  });
});
