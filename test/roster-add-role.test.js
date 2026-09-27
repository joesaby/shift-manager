/**
 * H37 (extension) — Unassigned cell "Add role" selector: which roles are offered,
 * and why none are offered when the selector is absent.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubLocalStorage, baseDoc } from "./helpers.js";

stubLocalStorage();

const { S } = await import("../src/js/state.js");
const { migrateToV2, openRolesForDay, unassignedReason } = await import("../src/js/model.js");
const { assignRoleToPerson } = await import("../src/js/generator.js");

function load(doc) {
  S.data = migrateToV2(doc);
  S.dirty = false;
}

function role(id, name, opts = {}) {
  return {
    id, name, groupId: "g1",
    usedAtDay: true, usedAtNight: true,
    hard: false, skillRestricted: false,
    essential: opts.essential !== false,
    sortOrder: opts.sortOrder ?? 1
  };
}

function person(id, name, opts = {}) {
  return { id, name, active: true, fixedRoleId: null, ...opts };
}

/** A roster that "exists" (generatedAt set) but with the given assignments, bypassing Generate's fill logic. */
function rosteredDoc(overrides, assignments = []) {
  return baseDoc({
    ...overrides,
    blocks: {
      current: {
        id: "b_current",
        startDate: "2026-09-21",
        shifts: ["Day", "Day", "Night", "Night"],
        stale: false,
        generatedAt: "2026-09-21T00:00:00.000Z",
        attendance: overrides.attendance || [],
        assignments,
        spareNotes: []
      },
      history: []
    }
  });
}

beforeEach(() => {
  localStorage.clear();
});

describe("H37 openRolesForDay / unassignedReason", () => {
  it("openRolesForDay lists unfilled roles (essential and non-essential) for the day", () => {
    load(rosteredDoc({
      roles: [role("r1", "Car 1", { essential: true }), role("r2", "Beat 1", { essential: false })],
      people: [person("p1", "Joe")],
      personRoles: [{ personId: "p1", roleId: "r1" }, { personId: "p1", roleId: "r2" }]
    }));
    const open = openRolesForDay(0);
    assert.deepEqual(open.map((r) => r.id).sort(), ["r1", "r2"]);
  });

  it("openRolesForDay excludes a role already assigned that day", () => {
    load(rosteredDoc({
      roles: [role("r1", "Car 1"), role("r2", "Beat 1", { essential: false })],
      people: [person("p1", "Joe"), person("p2", "Ann")],
      personRoles: [{ personId: "p1", roleId: "r1" }, { personId: "p2", roleId: "r2" }]
    }, [{ date: "2026-09-21", roleId: "r1", personId: "p1" }]));
    assert.deepEqual(openRolesForDay(0).map((r) => r.id), ["r2"]);
  });

  it("unassignedReason is 'none-open' when nothing is unfilled for anyone that day", () => {
    load(rosteredDoc({
      roles: [role("r1", "Car 1")],
      people: [person("p1", "Joe"), person("p2", "Ann")],
      personRoles: [{ personId: "p1", roleId: "r1" }, { personId: "p2", roleId: "r1" }]
    }, [{ date: "2026-09-21", roleId: "r1", personId: "p1" }]));
    assert.equal(openRolesForDay(0).length, 0);
    assert.equal(unassignedReason(0, "p2"), "none-open");
  });

  it("unassignedReason is 'not-qualified' when a role is open but this person can't do it", () => {
    load(rosteredDoc({
      roles: [role("r1", "Car 1", { essential: false })],
      people: [person("p1", "Joe"), person("p2", "Ann")],
      personRoles: [{ personId: "p1", roleId: "r1" }]
    }));
    assert.equal(openRolesForDay(0).length, 1, "r1 stays open — nobody assigned yet");
    assert.equal(unassignedReason(0, "p2"), "not-qualified");
    assert.equal(unassignedReason(0, "p1"), null, "p1 is qualified, so an option exists");
  });

  it("unassignedReason is 'not-eligible' for a person not Present that day", () => {
    load(rosteredDoc({
      roles: [role("r1", "Car 1", { essential: false })],
      people: [person("p1", "Joe"), person("p2", "Ann")],
      personRoles: [{ personId: "p1", roleId: "r1" }, { personId: "p2", roleId: "r1" }],
      attendance: [{ date: "2026-09-21", personId: "p2", statusId: "sick_leave" }]
    }));
    assert.equal(unassignedReason(0, "p2"), "not-eligible");
  });

  it("unassignedReason turns null once assignRoleToPerson fills the role, then 'none-open' for others", () => {
    load(rosteredDoc({
      roles: [role("r1", "Car 1", { essential: false })],
      people: [person("p1", "Joe"), person("p2", "Ann")],
      personRoles: [{ personId: "p1", roleId: "r1" }, { personId: "p2", roleId: "r1" }]
    }));
    assert.equal(unassignedReason(0, "p1"), null);
    assignRoleToPerson(0, "r1", "p1");
    assert.equal(openRolesForDay(0).length, 0);
    assert.equal(unassignedReason(0, "p2"), "none-open");
  });
});
