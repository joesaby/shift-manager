/**
 * H8 / H73 — a fixed-role person taken off their role on a day can take Files or another role that day.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubLocalStorage, baseDoc } from "./helpers.js";

stubLocalStorage();

const { S } = await import("../src/js/state.js");
const { migrateToV2, rosterDays, roleOfPerson, canDoOn, personById, unassignedReason, filesRole } = await import("../src/js/model.js");
const { generate, assignRoleToPerson, canTakeParkedRole } = await import("../src/js/generator.js");

const role = (id, name, o = {}) => ({ id, name, groupId: "g1", usedAtDay: true, usedAtNight: true, hard: false, skillRestricted: false, essential: true, sortOrder: 1, ...o });

beforeEach(() => localStorage.clear());

describe("fixed-role person released for the day", () => {
  it("can take Files once another person has their fixed role", () => {
    const ids = ["ann", "bob", "cat"];
    S.data = migrateToV2(baseDoc({
      roles: [role("esc", "Escort"), role("fil", "Files", { essential: false, files: true, sortOrder: 2 })],
      people: ids.map((id) => ({ id, name: id, active: true, fixedRoleId: id === "ann" ? "esc" : null })),
      personRoles: ids.flatMap((id) => ["esc", "fil"].map((r) => ({ personId: id, roleId: r })))
    }));
    S.dirty = false;
    generate();
    const d = 0;
    assert.equal(roleOfPerson(rosterDays()[d], "ann"), "esc");
    assert.equal(canTakeParkedRole(d, "fil", "ann"), false, "still on fixed role: no other role offered");
    assert.equal(canDoOn(personById("ann"), "fil", d), false);

    assert.ok(assignRoleToPerson(d, "esc", "bob"));
    const day = rosterDays()[d];
    assert.equal(day.assign.esc, "bob");
    assert.equal(roleOfPerson(day, "ann"), null);
    assert.equal(unassignedReason(d, "ann"), null, "Ann now has an Add role option");
    assert.ok(canTakeParkedRole(d, "fil", "ann"));

    assert.ok(assignRoleToPerson(d, "fil", "ann"));
    assert.equal(roleOfPerson(rosterDays()[d], "ann"), filesRole().id);
  });
});
