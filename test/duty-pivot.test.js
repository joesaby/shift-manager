/**
 * H59/H60 — Duty stats pivot: person × role counts, tallies at the end, sortable columns.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubLocalStorage, baseDoc } from "./helpers.js";

stubLocalStorage();
globalThis.window = globalThis.window || {};

const { S } = await import("../src/js/state.js");
const { migrateToV2, dutyPivot, sortPivotRows, nextPivotSort } = await import("../src/js/model.js");
const { vStats } = await import("../src/js/screens/stats.js");

const role = (id, name, o = {}) => ({
  id, name, groupId: "g1", usedAtDay: true, usedAtNight: true,
  hard: false, skillRestricted: false, essential: true, sortOrder: 1, ...o
});
const person = (id, name) => ({ id, name, active: true, fixedRoleId: null });
const asg = (date, roleId, personId) => ({ date, roleId, personId, source: "manual" });

function load(extra = {}) {
  S.data = migrateToV2(baseDoc({
    roles: [
      role("rs", "Scene", { sortOrder: 2 }),
      role("re", "Escort", { sortOrder: 1, hard: true }),
      role("nf1", "Files 1", { essential: false, sortOrder: 3 })
    ],
    people: [person("p1", "Ann One"), person("p2", "Bob Two"), person("p3", "Cal Three")],
    personRoles: [],
    blocks: {
      current: {
        id: "b_current", startDate: "2026-09-21",
        shifts: ["Day", "Day", "Night", "Night"], stale: false,
        generatedAt: "2026-09-20T12:00:00.000Z", attendance: [],
        assignments: [
          asg("2026-09-21", "re", "p1"), asg("2026-09-22", "re", "p1"),
          asg("2026-09-21", "rs", "p2"), asg("2026-09-22", "rs", "p1"),
          asg("2026-09-23", "rs", "p2"), asg("2026-09-24", "nf1", "p2")
        ],
        spareNotes: []
      },
      history: extra.history || []
    }
  }));
  S.dirty = false;
}

beforeEach(() => { localStorage.clear(); });

describe("dutyPivot counts and columns", () => {
  it("counts how many times each person did each role in the month", () => {
    load();
    const { rows } = dutyPivot("2026-09");
    const by = Object.fromEntries(rows.map((r) => [r.person.id, r]));
    assert.deepEqual(by.p1.counts, { Escort: 2, Scene: 1 });
    assert.deepEqual(by.p2.counts, { Scene: 2, "Files 1": 1 });
    assert.equal(by.p1.duties, 3);
    assert.equal(by.p2.duties, 3);
  });

  it("orders columns essential first (by list order), then non-essential", () => {
    load();
    assert.deepEqual(dutyPivot("2026-09").roles.map((r) => r.name), ["Escort", "Scene", "Files 1"]);
  });

  it("keeps a column for a duty that was later removed from the role list", () => {
    load({
      history: [{
        id: "h1", startDate: "2026-09-07", shifts: ["Day", "Day", "Night", "Night"],
        records: [{ date: "2026-09-07", shift: "Day", person: "Cal Three", status: "Present", role: "Old Duty" }]
      }]
    });
    const pivot = dutyPivot("2026-09");
    assert.equal(pivot.roles[pivot.roles.length - 1].name, "Old Duty");
    const cal = pivot.rows.find((r) => r.person.id === "p3");
    assert.equal(cal.counts["Old Duty"], 1);
  });

  it("flags hard roles on the column so the header can say so", () => {
    load();
    const cols = Object.fromEntries(dutyPivot("2026-09").roles.map((r) => [r.name, r]));
    assert.equal(cols.Escort.hard, true);
    assert.equal(cols.Scene.hard, false);
  });
});

describe("dutyPivot tallies at the end", () => {
  it("totals every role column and the grand total, and they agree", () => {
    load();
    const { totals, rows } = dutyPivot("2026-09");
    assert.deepEqual(totals.counts, { Escort: 2, Scene: 3, "Files 1": 1 });
    assert.equal(totals.duties, 6);
    assert.equal(totals.duties, rows.reduce((n, r) => n + r.duties, 0));
    assert.equal(totals.hard, 2);
  });
});

describe("sorting", () => {
  const rows = () => dutyPivot("2026-09").rows;
  const names = (rs) => rs.map((r) => r.person.name);

  it("sorts by a role column, most first, ties by name", () => {
    load();
    assert.deepEqual(names(sortPivotRows(rows(), "role:Escort", "desc")), ["Ann One", "Bob Two", "Cal Three"]);
    assert.deepEqual(names(sortPivotRows(rows(), "role:Scene", "desc")), ["Bob Two", "Ann One", "Cal Three"]);
  });

  it("ascending reverses the count order but keeps ties by name", () => {
    load();
    assert.deepEqual(names(sortPivotRows(rows(), "role:Scene", "asc")), ["Cal Three", "Ann One", "Bob Two"]);
  });

  it("sorts by person name and by total", () => {
    load();
    assert.deepEqual(names(sortPivotRows(rows(), "person", "desc")), ["Cal Three", "Bob Two", "Ann One"]);
    assert.deepEqual(names(sortPivotRows(rows(), "duties", "desc")), ["Ann One", "Bob Two", "Cal Three"]);
  });

  it("does not mutate the rows it is given", () => {
    load();
    const r = rows(); const before = names(r);
    sortPivotRows(r, "person", "desc");
    assert.deepEqual(names(r), before);
  });

  it("first click sorts numbers high-to-low and names A-Z; clicking again flips", () => {
    assert.deepEqual(nextPivotSort({ key: "duties", dir: "desc" }, "role:Escort"), { key: "role:Escort", dir: "desc" });
    assert.deepEqual(nextPivotSort({ key: "duties", dir: "desc" }, "person"), { key: "person", dir: "asc" });
    assert.deepEqual(nextPivotSort({ key: "role:Escort", dir: "desc" }, "role:Escort"), { key: "role:Escort", dir: "asc" });
  });
});

describe("explicit ascending / descending", () => {
  it("an explicit direction is used as given, whatever the current sort", () => {
    assert.deepEqual(nextPivotSort({ key: "duties", dir: "desc" }, "role:Escort", "asc"), { key: "role:Escort", dir: "asc" });
    assert.deepEqual(nextPivotSort({ key: "role:Escort", dir: "asc" }, "role:Escort", "asc"), { key: "role:Escort", dir: "asc" });
    assert.deepEqual(nextPivotSort({ key: "role:Escort", dir: "desc" }, "person", "desc"), { key: "person", dir: "desc" });
  });
});

describe("Duty stats screen", () => {
  it("renders the pivot with sortable headers, a Total column and a Total row, without Day/Night", () => {
    load();
    S.ui.statsMonth = "2026-09"; S.ui.statsSort = undefined;
    const html = vStats();
    assert.ok(html.includes('data-act="statsSort"'));
    assert.ok(html.includes('data-k="role:Escort"'));
    for (const key of ["person", "role:Escort", "hard", "skill", "duties"]) {
      assert.ok(html.includes(`data-k="${key}" data-d="asc"`), "ascending button on " + key);
      assert.ok(html.includes(`data-k="${key}" data-d="desc"`), "descending button on " + key);
    }
    assert.ok(/<th[^>]*>[\s\S]*Total/.test(html), "Total column header");
    assert.ok(html.includes("pivot-total-row"), "Total row");
    assert.ok(!html.includes(">Day<") && !html.includes(">Night<"), "no Day / Night columns");
  });
});
