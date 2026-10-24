/**
 * H78 — a role can be "Weekday day only": not offered on Day shifts at weekends or bank holidays.
 * H79 — a day can be ticked Bank holiday (Attendance).
 * H80 — a team member can be ticked Overtime (prints beside their name, like a borrowed person's).
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubLocalStorage, baseDoc } from "./helpers.js";

stubLocalStorage();

const { S } = await import("../src/js/state.js");
const M = await import("../src/js/model.js");
const { migrateToV2, block, history, rolesForDay, setOvertime, isOvertime, toggleHoliday, isHoliday, loadHistoryForEdit } = M;
const { generate } = await import("../src/js/generator.js");
const { buildSnapshot, saveRoster, isRosterUnsaved } = await import("../src/js/snapshot.js");

const role = (id, name, extra = {}) => ({ id, name, groupId: "g1", usedAtDay: true, usedAtNight: true, hard: false, skillRestricted: false, essential: true, sortOrder: 1, ...extra });
const person = (id, name) => ({ id, name, active: true, fixedRoleId: null });

/* 2026-10-23 is a Friday: Fri, Sat, Sun, Mon. */
function load(shifts = ["Day", "Day", "Day", "Night"]) {
  const doc = baseDoc({
    roles: [role("re", "Escort"), role("rp", "Public Office", { weekdayDayOnly: true, sortOrder: 2 })],
    people: [person("p1", "Joe"), person("p2", "Ann"), person("p3", "Bob")],
    personRoles: ["p1", "p2", "p3"].flatMap((p) => [{ personId: p, roleId: "re" }, { personId: p, roleId: "rp" }])
  });
  doc.blocks.current.startDate = "2026-10-23";
  doc.blocks.current.shifts = shifts;
  S.data = migrateToV2(doc);
  S.dirty = false;
}

const names = (d) => rolesForDay(d).map((r) => r.id);

beforeEach(() => localStorage.clear());

describe("H78 weekday-only roles", () => {
  it("are offered on a weekday Day shift but not on a weekend Day shift", () => {
    load();
    assert.deepEqual(names(0), ["re", "rp"], "Friday day");
    assert.deepEqual(names(1), ["re"], "Saturday day");
    assert.deepEqual(names(2), ["re"], "Sunday day");
  });

  it("are still offered at night, even at the weekend", () => {
    load(["Night", "Night", "Night", "Night"]);
    assert.deepEqual(names(1), ["re", "rp"]);
  });

  it("are dropped on a ticked bank-holiday Day, and a normal flag is unaffected", () => {
    load(["Day", "Day", "Day", "Day"]);
    assert.deepEqual(names(3), ["re", "rp"], "Monday day");
    toggleHoliday("2026-10-26");
    assert.equal(isHoliday("2026-10-26"), true);
    assert.deepEqual(names(3), ["re"]);
    toggleHoliday("2026-10-26");
    assert.equal(isHoliday("2026-10-26"), false);
    assert.deepEqual(names(3), ["re", "rp"]);
  });

  it("Generate never gives the role on a weekend Day", () => {
    load();
    generate();
    const on = (date) => block().assignments.filter((a) => a.date === date && a.roleId === "rp");
    assert.equal(on("2026-10-23").length, 1);
    assert.equal(on("2026-10-24").length, 0);
    assert.equal(on("2026-10-25").length, 0);
    assert.equal(on("2026-10-26").length, 1, "Monday night");
  });

  it("ticking a bank holiday after Generate marks the roster stale", () => {
    load(["Day", "Day", "Day", "Day"]);
    generate();
    assert.equal(block().stale, false);
    toggleHoliday("2026-10-26");
    assert.equal(block().stale, true);
  });

  it("bank holidays survive Save → Edit and old data without the field opens", () => {
    load(["Day", "Day", "Day", "Day"]);
    toggleHoliday("2026-10-26");
    generate();
    saveRoster();
    assert.deepEqual(history()[0].holidays, ["2026-10-26"]);
    block().holidays = [];
    assert.equal(loadHistoryForEdit(history()[0].id), true);
    assert.deepEqual(block().holidays, ["2026-10-26"]);
    delete S.data.blocks.current.holidays;
    S.data = migrateToV2(JSON.parse(JSON.stringify(S.data)));
    assert.deepEqual(block().holidays, []);
  });
});

describe("H80 overtime for a team member", () => {
  it("is a per-block tick that shows on the snapshot and does not touch borrowed people", () => {
    load();
    generate();
    saveRoster();
    assert.equal(isRosterUnsaved(), false);
    setOvertime("p2", true);
    assert.equal(isOvertime(M.personById("p2")), true);
    assert.equal(isOvertime(M.personById("p1")), false);
    const snap = buildSnapshot();
    assert.equal(snap.people.find((p) => p.id === "p2").overtime, true);
    assert.equal(snap.people.find((p) => p.id === "p1").overtime, undefined);
    assert.equal(isRosterUnsaved(), true, "a new tick is an unsaved change");
    setOvertime("p2", false);
    assert.equal(isOvertime(M.personById("p2")), false);
  });

  it("survives Save → Edit and Regenerate; old data without the field opens", () => {
    load();
    setOvertime("p3", true);
    generate();
    assert.equal(isOvertime(M.personById("p3")), true, "Regenerate keeps who is on overtime");
    saveRoster();
    assert.deepEqual(history()[0].overtime, ["p3"]);
    block().overtime = [];
    loadHistoryForEdit(history()[0].id);
    assert.deepEqual(block().overtime, ["p3"]);
    delete S.data.blocks.current.overtime;
    S.data = migrateToV2(JSON.parse(JSON.stringify(S.data)));
    assert.deepEqual(block().overtime, []);
  });
});
