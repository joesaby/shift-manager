/**
 * H15 / H48–H52 — Save roster upsert, unsaved derivation, audit on save, duty-stats no double-count.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubLocalStorage, baseDoc } from "./helpers.js";

stubLocalStorage();

const { S } = await import("../src/js/state.js");
const {
  migrateToV2, setStatus, block, history, personLoadByMonth, findHistoryIndexForStart
} = await import("../src/js/model.js");
const { generate } = await import("../src/js/generator.js");
const { buildSnapshot, saveRoster, isRosterUnsaved } = await import("../src/js/snapshot.js");
import { setAuditTestSink } from "../src/js/audit.js";

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
    sortOrder: opts.sortOrder ?? 1,
    ...opts
  };
}

function person(id, name) {
  return { id, name, active: true, fixedRoleId: null };
}

function miniRoster() {
  return baseDoc({
    roles: [role("re", "Escort")],
    people: [person("p1", "Joe"), person("p2", "Ann")],
    personRoles: [
      { personId: "p1", roleId: "re" },
      { personId: "p2", roleId: "re" }
    ]
  });
}

beforeEach(() => {
  localStorage.clear();
  setAuditTestSink(null);
});

describe("H15 / H49 Save roster upsert", () => {
  it("save twice for the same block start leaves exactly one history entry with latest data", () => {
    load(miniRoster());
    generate();
    saveRoster();
    assert.equal(history().length, 1);
    /* Attendance edit so the second save writes a different snap. */
    setStatus("p2", 0, "Sick leave");
    saveRoster();
    assert.equal(history().length, 1);
    assert.equal(Object.prototype.hasOwnProperty.call(history()[0].snap, "spareNotes"), false);
  });

  it("save matches and replaces a legacy start-style history entry", () => {
    load(miniRoster());
    generate();
    const snap = buildSnapshot();
    history().push({
      id: "legacy",
      savedAt: "2026-01-01T00:00:00.000Z",
      start: "2026-09-21",
      shifts: ["Day", "Day", "Night", "Night"],
      attendance: [],
      assignments: [],
      snap,
      records: snap.records
    });
    assert.equal(findHistoryIndexForStart("2026-09-21"), 0);
    saveRoster();
    assert.equal(history().length, 1);
    assert.equal(history()[0].startDate, "2026-09-21");
    assert.equal(history()[0].id, "legacy");
  });
});

describe("H49 Duty stats no double-count", () => {
  it("personLoadByMonth does not double-count after repeated saves", () => {
    load(miniRoster());
    generate();
    saveRoster();
    saveRoster();
    const rows = personLoadByMonth("p1", { month: "2026-09" });
    const duties = rows[0] ? rows[0].duties : 0;
    const live = block().assignments.filter((a) => a.personId === "p1").length;
    assert.equal(duties, live);
    assert.equal(history().length, 1);
  });
});

describe("H51 unsaved derivation", () => {
  it("false right after Save; true after edit or attendance change", () => {
    load(miniRoster());
    generate();
    assert.equal(isRosterUnsaved(), true, "never saved yet");
    saveRoster();
    assert.equal(isRosterUnsaved(), false);
    const a = block().assignments.find((x) => x.date === "2026-09-21");
    if (a) {
      a.personId = a.personId === "p1" ? "p2" : "p1";
      assert.equal(isRosterUnsaved(), true);
      saveRoster();
      assert.equal(isRosterUnsaved(), false);
    }
    setStatus("p1", 0, "Sick leave");
    assert.equal(isRosterUnsaved(), true);
  });
});

describe("H50 audit on each Save", () => {
  it("records an audit line on each Save roster", () => {
    const calls = [];
    setAuditTestSink((action, detail) => { calls.push({ action, detail }); });
    load(miniRoster());
    generate();
    saveRoster();
    saveRoster();
    assert.equal(calls.length, 2);
    assert.ok(calls.every((c) => c.action === "ROSTER_SAVED"));
  });
});
