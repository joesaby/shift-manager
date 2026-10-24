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
const { migrateToV2, block, history, rolesForDay, setOvertimeDay, overtimeDaysOf, isOvertime, toggleHoliday, isHoliday, loadHistoryForEdit } = M;
const { generate } = await import("../src/js/generator.js");
const { buildSnapshot, saveRoster, isRosterUnsaved, overtimeLabel } = await import("../src/js/snapshot.js");

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

describe("H80 overtime for a team member (per day)", () => {
  it("is ticked per day, shows the weekday on the snapshot, and is an unsaved change", () => {
    load();
    generate();
    saveRoster();
    assert.equal(isRosterUnsaved(), false);
    setOvertimeDay("p2", "2026-10-25", true); // Sunday
    assert.deepEqual(overtimeDaysOf("p2"), ["2026-10-25"]);
    assert.equal(isOvertime(M.personById("p2")), true);
    assert.equal(isOvertime(M.personById("p1")), false);
    const snap = buildSnapshot();
    assert.deepEqual(snap.people.find((p) => p.id === "p2").overtime, ["Sunday"]);
    assert.equal(snap.people.find((p) => p.id === "p1").overtime, undefined);
    assert.equal(isRosterUnsaved(), true);
    setOvertimeDay("p2", "2026-10-24", true);
    assert.deepEqual(buildSnapshot().people.find((p) => p.id === "p2").overtime, ["Saturday", "Sunday"], "in date order");
    setOvertimeDay("p2", "2026-10-25", false);
    setOvertimeDay("p2", "2026-10-24", false);
    assert.equal(isOvertime(M.personById("p2")), false);
  });

  it("every day of the block prints as plain Overtime; a date outside the block is ignored", () => {
    load();
    ["2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26"].forEach((d) => setOvertimeDay("p1", d, true));
    assert.equal(buildSnapshot().people.find((p) => p.id === "p1").overtime, true);
    setOvertimeDay("p3", "2026-12-01", true);
    assert.equal(isOvertime(M.personById("p3")), false);
  });

  it("the printed tag names the days", () => {
    assert.equal(overtimeLabel({ overtime: true }), "Overtime");
    assert.equal(overtimeLabel({ overtime: ["Sunday"] }), "Overtime Sunday");
    assert.equal(overtimeLabel({ overtime: ["Saturday", "Sunday"] }), "Overtime Saturday, Sunday");
    assert.equal(overtimeLabel({}), "");
  });

  it("survives Save → Edit and Regenerate; v1.0.47 whole-block arrays and old data still open", () => {
    load();
    setOvertimeDay("p3", "2026-10-25", true);
    generate();
    assert.deepEqual(overtimeDaysOf("p3"), ["2026-10-25"], "Regenerate keeps who is on overtime");
    saveRoster();
    assert.deepEqual(history()[0].overtime, { p3: ["2026-10-25"] });
    block().overtime = {};
    loadHistoryForEdit(history()[0].id);
    assert.deepEqual(overtimeDaysOf("p3"), ["2026-10-25"]);
    /* v1.0.47 stored a plain list of person ids = the whole block. */
    S.data.blocks.current.overtime = ["p1"];
    S.data = migrateToV2(JSON.parse(JSON.stringify(S.data)));
    assert.equal(overtimeDaysOf("p1").length, 4);
    history()[0].overtime = ["p2"];
    loadHistoryForEdit(history()[0].id);
    assert.equal(overtimeDaysOf("p2").length, 4);
    delete S.data.blocks.current.overtime;
    S.data = migrateToV2(JSON.parse(JSON.stringify(S.data)));
    assert.deepEqual(block().overtime, {});
  });
});
