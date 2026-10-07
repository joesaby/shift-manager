/**
 * H76 — Borrowed people: someone brought in from another unit for this block gets an extra row at the
 * bottom of the Roster, can take any unfilled role, and never touches the fixed team (generation, People,
 * Attendance counts, rotation history).
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubLocalStorage, baseDoc } from "./helpers.js";

stubLocalStorage();

const { S } = await import("../src/js/state.js");
const M = await import("../src/js/model.js");
const { assignRoleToPerson, unassignPerson, generate, canTakeParkedRole } = await import("../src/js/generator.js");
const { buildSnapshot, buildDayBrief } = await import("../src/js/snapshot.js");

const { migrateToV2, addBorrowed, removeBorrowed, borrowedPeople, activePeople, block, rosterDays, openRolesForDay, personById, qual } = M;

function load(doc) { S.data = migrateToV2(doc); S.dirty = false; }

function role(id, name, opts = {}) {
  return { id, name, groupId: "g1", usedAtDay: true, usedAtNight: true, hard: false, skillRestricted: false, essential: opts.essential !== false, sortOrder: opts.sortOrder ?? 1, files: !!opts.files };
}
function person(id, name) { return { id, name, active: true, fixedRoleId: null }; }
function pr(personId, roleId) { return { personId, roleId }; }

/** Two essential roles, one team member (so one role is short), roster already generated. */
function shortDoc() {
  return baseDoc({
    roles: [role("r1", "Car 1", { sortOrder: 1 }), role("r2", "Car 2", { sortOrder: 2 })],
    people: [person("a", "Alice")],
    personRoles: [pr("a", "r1"), pr("a", "r2")],
    blocks: {
      current: {
        id: "b_current", startDate: "2026-09-21", shifts: ["Day", "Day", "Night", "Night"],
        stale: false, generatedAt: "2026-09-21T00:00:00.000Z", attendance: [],
        assignments: [{ date: "2026-09-21", roleId: "r1", personId: "a", source: "generated" }],
        spareNotes: []
      },
      history: []
    }
  });
}

beforeEach(() => { localStorage.clear(); });

describe("H76 borrowed people: model", () => {
  it("opening an older file gives the block an empty borrowed list", () => {
    load(shortDoc());
    assert.deepEqual(block().borrowed, []);
  });

  it("addBorrowed keeps the person out of the team", () => {
    load(shortDoc());
    const b = addBorrowed("  Sgt Murphy ");
    assert.equal(b.name, "Sgt Murphy");
    assert.deepEqual(borrowedPeople().map((p) => p.name), ["Sgt Murphy"]);
    assert.deepEqual(M.D().people.map((p) => p.id), ["a"]);
    assert.deepEqual(activePeople().map((p) => p.id), ["a"]);
    assert.equal(M.statusCountsForDay(0).find((c) => c.label === "Present").n, 1);
  });

  it("refuses a blank name or one already on the roster", () => {
    load(shortDoc());
    assert.equal(addBorrowed("   "), null);
    assert.equal(addBorrowed("alice"), null);
    assert.ok(addBorrowed("Murphy"));
    assert.equal(addBorrowed("MURPHY"), null);
    assert.equal(borrowedPeople().length, 1);
  });

  it("a borrowed person is qualified for every role except Files", () => {
    const doc = shortDoc();
    doc.roles.push(role("f", "Files", { essential: false, sortOrder: 3, files: true }));
    load(doc);
    const b = addBorrowed("Murphy");
    assert.equal(qual(personById(b.id), "r2"), true);
    assert.equal(qual(personById(b.id), "f"), false);
  });

  it("can take an unfilled role, which then counts as filled, and give it back", () => {
    load(shortDoc());
    const b = addBorrowed("Murphy");
    assert.deepEqual(openRolesForDay(0).map((r) => r.id), ["r2"]);
    assert.equal(canTakeParkedRole(0, "r2", b.id), true);
    assert.equal(assignRoleToPerson(0, "r2", b.id), true);
    assert.equal(rosterDays()[0].assign.r2, b.id);
    assert.equal(openRolesForDay(0).length, 0);
    assert.equal(unassignPerson(0, b.id), true);
    assert.equal(rosterDays()[0].assign.r2, null);
  });

  it("removeBorrowed drops the row and frees their roles", () => {
    load(shortDoc());
    const b = addBorrowed("Murphy");
    assignRoleToPerson(0, "r2", b.id);
    removeBorrowed(b.id);
    assert.equal(borrowedPeople().length, 0);
    assert.equal(rosterDays()[0].assign.r2, null);
    assert.ok(!block().assignments.some((a) => a.personId === b.id));
  });

  it("Regenerate never uses a borrowed person and clears them", () => {
    const doc = shortDoc();
    doc.people.push(person("c", "Cathy"));
    doc.personRoles.push(pr("c", "r1"), pr("c", "r2"));
    load(doc);
    const b = addBorrowed("Murphy");
    assignRoleToPerson(0, "r2", b.id);
    generate();
    assert.ok(!block().assignments.some((a) => a.personId === b.id));
    assert.deepEqual(borrowedPeople(), []);
  });

  it("borrowed work is ignored by rotation history", () => {
    load(shortDoc());
    const b = addBorrowed("Murphy");
    assignRoleToPerson(0, "r2", b.id);
    assert.deepEqual(Object.keys(M.historicRoleCounts()).filter((k) => k.startsWith("a|")), []);
  });
});

describe("H76 borrowed people: print and log", () => {
  it("snapshot puts borrowed rows last, blank on days without a duty", () => {
    load(shortDoc());
    const b = addBorrowed("Murphy");
    assignRoleToPerson(0, "r2", b.id);
    const snap = buildSnapshot();
    assert.deepEqual(snap.people.map((p) => p.name), ["Alice", "Murphy"]);
    assert.equal(snap.people[1].borrowed, true);
    assert.equal(snap.cells[1][0].text, "Car 2");
    assert.equal(snap.cells[1][1].kind, "spare");
    assert.equal(snap.cells[1][1].blank, true);
    assert.equal(snap.cells[0][1].blank, undefined);
    assert.ok(snap.records.some((r) => r.person === "Murphy" && r.role === "Car 2"));
    assert.ok(!snap.records.some((r) => r.person === "Murphy" && r.role === "Spare"));
  });

  it("briefing sheet lists a borrowed person on the day they work", () => {
    load(shortDoc());
    const b = addBorrowed("Murphy");
    assignRoleToPerson(0, "r2", b.id);
    assert.deepEqual(buildDayBrief(0).rows.map((r) => r.personName), ["Alice", "Murphy"]);
    assert.deepEqual(buildDayBrief(1).rows, []);
  });

  it("saved roster keeps borrowed people and reopening restores them", () => {
    load(shortDoc());
    const b = addBorrowed("Murphy");
    assignRoleToPerson(0, "r2", b.id);
    const entry = M.snapshotBlockForHistory(buildSnapshot());
    assert.deepEqual(entry.borrowed.map((p) => p.name), ["Murphy"]);
    M.upsertHistoryEntry(entry);
    removeBorrowed(b.id);
    assert.equal(M.loadHistoryForEdit(M.history()[0].id), true);
    assert.deepEqual(borrowedPeople().map((p) => p.name), ["Murphy"]);
    assert.equal(rosterDays()[0].assign.r2, b.id);
  });

  it("Historic roster shows the borrowed person by name", () => {
    load(shortDoc());
    const b = addBorrowed("Murphy");
    assignRoleToPerson(0, "r2", b.id);
    const entry = M.snapshotBlockForHistory(buildSnapshot());
    removeBorrowed(b.id);
    const model = M.historicRosterModel(entry);
    assert.ok(model.people.some((p) => p.name === "Murphy"));
    assert.ok(!model.people.some((p) => p.name === b.id));
  });
});

describe("H76 borrowed people: Overtime tick", () => {
  it("is off by default and can be ticked for a borrowed person only", () => {
    load(shortDoc());
    const b = addBorrowed("Murphy");
    assert.equal(!!b.overtime, false);
    M.setOvertime(b.id, true);
    assert.equal(personById(b.id).overtime, true);
    M.setOvertime("a", true);
    assert.equal(personById("a").overtime, undefined);
    M.setOvertime(b.id, false);
    assert.equal(!!personById(b.id).overtime, false);
  });

  it("prints 'Overtime' beside the name only when ticked", async () => {
    const { rotaHTML } = await import("../src/js/snapshot.js");
    load(shortDoc());
    const b = addBorrowed("Murphy");
    assignRoleToPerson(0, "r2", b.id);
    const row = (html) => html.match(/<tr><td[^>]*>Murphy[^]*?<\/td>/)[0];
    assert.doesNotMatch(row(rotaHTML(buildSnapshot())), /Overtime/);
    M.setOvertime(b.id, true);
    const snap = buildSnapshot();
    assert.equal(snap.people[1].overtime, true);
    assert.equal(snap.people[0].overtime, undefined);
    assert.match(row(rotaHTML(snap)), /Murphy[^<]*<span class="overtime-tag">Overtime<\/span>/);
  });

  it("is saved with the roster and restored on Edit", () => {
    load(shortDoc());
    const b = addBorrowed("Murphy");
    assignRoleToPerson(0, "r2", b.id);
    M.setOvertime(b.id, true);
    M.upsertHistoryEntry(M.snapshotBlockForHistory(buildSnapshot()));
    removeBorrowed(b.id);
    M.loadHistoryForEdit(M.history()[0].id);
    assert.equal(borrowedPeople()[0].overtime, true);
  });
});
