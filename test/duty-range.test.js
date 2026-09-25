/**
 * H61/H62 — Duty stats over any date range (default: everything up to today) and a printable
 * per-person report with role counts and attendance counts.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubLocalStorage, baseDoc } from "./helpers.js";

stubLocalStorage();
globalThis.window = globalThis.window || {};

const { S } = await import("../src/js/state.js");
const {
  migrateToV2, dutyPivot, monthRange, statsRange, earliestStatsDate, personReport, attendanceForRange
} = await import("../src/js/model.js");
const { vStats, actions, changes } = await import("../src/js/screens/stats.js");

const role = (id, name, o = {}) => ({
  id, name, groupId: "g1", usedAtDay: true, usedAtNight: true,
  hard: false, skillRestricted: false, essential: true, sortOrder: 1, ...o
});
const person = (id, name, o = {}) => ({ id, name, active: true, fixedRoleId: null, ...o });
const asg = (date, roleId, personId) => ({ date, roleId, personId, source: "manual" });

function load({ generated = true, attendance = [], history = [] } = {}) {
  S.data = migrateToV2(baseDoc({
    roles: [role("re", "Escort", { sortOrder: 1, hard: true }), role("rs", "Scene", { sortOrder: 2 })],
    people: [person("p1", "Ann One", { employeeNo: "00012345", shoulderNo: "1001" }), person("p2", "Bob Two")],
    blocks: {
      current: {
        id: "b_current", startDate: "2026-09-21",
        shifts: ["Day", "Day", "Night", "Night"], stale: false,
        generatedAt: generated ? "2026-09-20T12:00:00.000Z" : null, attendance,
        assignments: [
          asg("2026-09-21", "re", "p1"), asg("2026-09-22", "re", "p1"),
          asg("2026-09-23", "rs", "p1"), asg("2026-09-22", "rs", "p2")
        ],
        spareNotes: []
      },
      history
    }
  }));
  S.dirty = false;
}

const augBlock = {
  id: "h_aug", startDate: "2026-08-10", shifts: ["Day", "Day", "Night", "Night"],
  assignments: [asg("2026-08-10", "re", "p1"), asg("2026-08-11", "rs", "p2")],
  records: [
    { date: "2026-08-10", shift: "Day", person: "Ann One", status: "Present", role: "Escort" },
    { date: "2026-08-11", shift: "Day", person: "Ann One", status: "Sick leave", role: "" },
    { date: "2026-08-12", shift: "Night", person: "Ann One", status: "Annual leave", role: "" },
    { date: "2026-08-13", shift: "Night", person: "Ann One", status: "Present", role: "Spare" }
  ]
};

beforeEach(() => { localStorage.clear(); S.ui.statsPerson = null; S.ui.statsFrom = null; S.ui.statsTo = null; S.ui.statsSort = undefined; });

describe("date range", () => {
  it("monthRange covers the whole month", () => {
    assert.deepEqual(monthRange("2026-09"), { from: "2026-09-01", to: "2026-09-31" });
  });

  it("defaults to the earliest recorded date up to today", () => {
    load({ history: [augBlock] });
    assert.equal(earliestStatsDate(), "2026-08-10");
    assert.deepEqual(statsRange(null, null, "2026-09-25"), { from: "2026-08-10", to: "2026-09-25" });
  });

  it("with no history the default starts at the current block", () => {
    load();
    assert.equal(statsRange(null, null, "2026-09-25").from, "2026-09-21");
  });

  it("keeps explicit dates and swaps them if entered the wrong way round", () => {
    load();
    assert.deepEqual(statsRange("2026-09-01", "2026-09-22", "2026-09-25"), { from: "2026-09-01", to: "2026-09-22" });
    assert.deepEqual(statsRange("2026-09-22", "2026-09-01", "2026-09-25"), { from: "2026-09-01", to: "2026-09-22" });
  });

  it("a partial range fills the missing end from the defaults", () => {
    load({ history: [augBlock] });
    assert.deepEqual(statsRange("2026-09-01", null, "2026-09-25"), { from: "2026-09-01", to: "2026-09-25" });
  });
});

describe("dutyPivot over a range", () => {
  const counts = (pivot, id) => pivot.rows.find((r) => r.person.id === id).counts;

  it("counts only duties inside the dates", () => {
    load();
    assert.deepEqual(counts(dutyPivot({ from: "2026-09-22", to: "2026-09-23" }), "p1"), { Escort: 1, Scene: 1 });
  });

  it("spans months and includes the log when the range covers them", () => {
    load({ history: [augBlock] });
    const all = dutyPivot({ from: "2026-08-01", to: "2026-09-30" });
    assert.deepEqual(counts(all, "p1"), { Escort: 3, Scene: 1 });
    assert.deepEqual(counts(all, "p2"), { Scene: 2 });
    assert.equal(all.totals.duties, 6);
  });

  it("a month string still works", () => {
    load({ history: [augBlock] });
    assert.equal(dutyPivot("2026-08").totals.duties, 2);
  });
});

describe("attendanceForRange", () => {
  const byLabel = (rows) => Object.fromEntries(rows.map((r) => [r.label, r.n]));

  it("counts each status for the current planned block, unlisted days as Present", () => {
    load({ attendance: [
      { date: "2026-09-22", personId: "p1", statusId: "sick_leave" },
      { date: "2026-09-23", personId: "p1", statusId: "annual_leave" }
    ] });
    assert.deepEqual(byLabel(attendanceForRange("p1", { from: "2026-09-01", to: "2026-09-30" }).rows),
      { Present: 2, "Annual leave": 1, "Sick leave": 1, "Duty away": 0, "Rest day": 0 });
  });

  it("adds saved log entries (their per-day records) and respects the dates", () => {
    load({ history: [augBlock] });
    const all = attendanceForRange("p1", { from: "2026-08-01", to: "2026-09-30" });
    assert.deepEqual(byLabel(all.rows), { Present: 6, "Annual leave": 1, "Sick leave": 1, "Duty away": 0, "Rest day": 0 });
    assert.equal(all.days, 8);
    const aug11 = attendanceForRange("p1", { from: "2026-08-11", to: "2026-08-11" });
    assert.equal(byLabel(aug11.rows)["Sick leave"], 1);
  });

  it("does not count the saved copy of the live block twice", () => {
    load({ history: [{ ...augBlock, startDate: "2026-09-21", id: "h_same", records: [
      { date: "2026-09-21", shift: "Day", person: "Ann One", status: "Present", role: "Escort" }
    ] }] });
    assert.equal(attendanceForRange("p1", { from: "2026-09-01", to: "2026-09-30" }).days, 4);
  });

  it("ignores a current block that has never been generated", () => {
    load({ generated: false });
    assert.equal(attendanceForRange("p1", { from: "2026-09-01", to: "2026-09-30" }).days, 0);
  });
});

describe("personReport", () => {
  it("lists every role with the person's count, plus hard / skill totals and attendance", () => {
    load({ history: [augBlock], attendance: [{ date: "2026-09-22", personId: "p1", statusId: "sick_leave" }] });
    const rep = personReport("p1", { from: "2026-08-01", to: "2026-09-30" });
    assert.equal(rep.person.name, "Ann One");
    assert.deepEqual(rep.roles.map((r) => [r.name, r.n]), [["Escort", 3], ["Scene", 1]]);
    assert.equal(rep.duties, 4);
    assert.equal(rep.hard, 3);
    assert.equal(rep.attendance.find((a) => a.label === "Sick leave").n, 2);
  });

  it("shows zero-count roles too, so the whole list is visible", () => {
    load();
    const rep = personReport("p2", { from: "2026-09-01", to: "2026-09-30" });
    assert.deepEqual(rep.roles.map((r) => [r.name, r.n]), [["Escort", 0], ["Scene", 1]]);
  });
});

describe("Duty stats screen", () => {
  it("shows date inputs and presets, and names open the person report", () => {
    load({ history: [augBlock] });
    const html = vStats();
    assert.ok(html.includes('data-ch="statsFrom"') && html.includes('data-ch="statsTo"'));
    assert.ok(html.includes('data-act="statsPreset"'));
    assert.ok(html.includes('data-act="statsPerson"'));
    assert.ok(!html.includes('data-act="goPerson"'));
  });

  it("the person report is a printable page for just that person", () => {
    load({ history: [augBlock] });
    S.ui.statsPerson = "p1";
    const html = vStats();
    assert.ok(html.includes('id="printArea"'));
    assert.ok(html.includes("Ann One") && html.includes("00012345") && html.includes("1001"));
    assert.ok(html.includes("Sick leave") && html.includes("Annual leave"));
    assert.ok(!html.includes("Bob Two"), "no other person");
    assert.ok(html.includes('data-act="statsBack"') && html.includes('data-act="print"'));
  });

  it("presets and date edits change the range; a preset clears custom dates", () => {
    load({ history: [augBlock] });
    changes.statsFrom("2026-08-11");
    changes.statsTo("2026-08-12");
    assert.deepEqual([S.ui.statsFrom, S.ui.statsTo], ["2026-08-11", "2026-08-12"]);
    actions.statsPreset({ p: "all" });
    assert.deepEqual([S.ui.statsFrom, S.ui.statsTo], [null, null]);
    actions.statsPreset({ p: "month" });
    assert.match(S.ui.statsFrom, /^\d{4}-\d{2}-01$/);
  });
});
