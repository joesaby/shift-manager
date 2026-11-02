/**
 * H81 — a role can be ticked "Many people": any number of people can hold it on a day.
 * It is never auto-filled by Generate and never counts as unfilled.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubLocalStorage, baseDoc } from "./helpers.js";

stubLocalStorage();

const { S } = await import("../src/js/state.js");
const M = await import("../src/js/model.js");
const { migrateToV2, block, rosterDays, roleOfPerson, openRolesForDay } = M;
const { generate, assignRoleToPerson, unassignPerson } = await import("../src/js/generator.js");
const { buildSnapshot } = await import("../src/js/snapshot.js");

const role = (id, name, extra = {}) => ({ id, name, groupId: "g1", usedAtDay: true, usedAtNight: true, hard: false, skillRestricted: false, essential: true, sortOrder: 1, ...extra });
const person = (id, name) => ({ id, name, active: true, fixedRoleId: null });

function load() {
  const ids = ["p1", "p2", "p3", "p4"];
  const doc = baseDoc({
    roles: [role("re", "Escort"), role("rx", "Event", { essential: false, multi: true, sortOrder: 2 })],
    people: ids.map((id, i) => person(id, "P" + i)),
    personRoles: ids.flatMap((p) => [{ personId: p, roleId: "re" }, { personId: p, roleId: "rx" }])
  });
  doc.blocks.current.startDate = "2026-10-23";
  doc.blocks.current.shifts = ["Day", "Day"];
  S.data = migrateToV2(doc);
  S.dirty = false;
}

beforeEach(() => { localStorage.clear(); load(); });

describe("H81 many-holder role", () => {
  it("Generate leaves it alone", () => {
    generate();
    assert.ok(!block().assignments.some((a) => a.roleId === "rx"));
  });

  it("several people can hold it on one day and it is never unfilled", () => {
    generate();
    ["p2", "p3", "p4"].forEach((p) => assert.equal(assignRoleToPerson(0, "rx", p), true));
    const held = block().assignments.filter((a) => a.date === "2026-10-23" && a.roleId === "rx").map((a) => a.personId);
    assert.deepEqual(held.sort(), ["p2", "p3", "p4"]);
    assert.equal(roleOfPerson(rosterDays()[0], "p3"), "rx");
    assert.ok(!buildSnapshot().unfilled[0].includes("Event"));
  });

  it("is always offered in Add role, even after people hold it", () => {
    generate();
    assignRoleToPerson(0, "rx", "p2");
    assert.ok(openRolesForDay(0).some((r) => r.id === "rx"));
  });

  it("taking it replaces the person's other role; × removes only that person", () => {
    generate();
    const before = block().assignments.filter((a) => a.date === "2026-10-23" && a.roleId === "re").map((a) => a.personId)[0];
    assignRoleToPerson(0, "rx", before);
    assert.ok(!block().assignments.some((a) => a.date === "2026-10-23" && a.roleId === "re" && a.personId === before));
    assignRoleToPerson(0, "rx", "p4");
    unassignPerson(0, "p4");
    const held = block().assignments.filter((a) => a.date === "2026-10-23" && a.roleId === "rx").map((a) => a.personId);
    assert.deepEqual(held, [before]);
  });

  it("survives a manual swap elsewhere on the same day", () => {
    generate();
    assignRoleToPerson(0, "rx", "p4");
    const holder = rosterDays()[0].assign.re;
    const other = ["p1", "p2", "p3"].find((p) => p !== holder);
    assignRoleToPerson(0, "re", other);
    assert.ok(block().assignments.some((a) => a.date === "2026-10-23" && a.roleId === "rx" && a.personId === "p4"));
  });
});
