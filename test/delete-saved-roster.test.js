/**
 * H77 — a saved roster can be deleted from the Log only while its block is still
 * forward-facing (last day not yet passed); historic rosters are never deletable.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubLocalStorage, baseDoc } from "./helpers.js";

stubLocalStorage();

const { S } = await import("../src/js/state.js");
const { migrateToV2, block, history, canDeleteHistory } = await import("../src/js/model.js");
const { generate } = await import("../src/js/generator.js");
const { saveRoster, deleteSavedRoster } = await import("../src/js/snapshot.js");
import { setAuditTestSink } from "../src/js/audit.js";

const role = (id, name) => ({ id, name, groupId: "g1", usedAtDay: true, usedAtNight: true, hard: false, skillRestricted: false, essential: true, sortOrder: 1 });
const person = (id, name) => ({ id, name, active: true, fixedRoleId: null });

function saveBlock(start) {
  const doc = baseDoc({
    roles: [role("re", "Escort")],
    people: [person("p1", "Joe"), person("p2", "Ann")],
    personRoles: [{ personId: "p1", roleId: "re" }, { personId: "p2", roleId: "re" }]
  });
  doc.blocks.current.startDate = start;
  S.data = migrateToV2(doc);
  S.dirty = false;
  S.ui.confirm = null;
  generate();
  return saveRoster();
}

beforeEach(() => { localStorage.clear(); setAuditTestSink(null); });

describe("H77 canDeleteHistory", () => {
  it("allows a block whose last day has not passed, refuses one that has", () => {
    const e = saveBlock("2026-09-21"); // days 21..24
    assert.equal(canDeleteHistory(e, "2026-09-10"), true, "planned");
    assert.equal(canDeleteHistory(e, "2026-09-22"), true, "in progress");
    assert.equal(canDeleteHistory(e, "2026-09-24"), true, "last day is today");
    assert.equal(canDeleteHistory(e, "2026-09-25"), false, "historic");
  });

  it("refuses an entry with no readable dates", () => {
    assert.equal(canDeleteHistory({ id: "x" }, "2026-01-01"), false);
    assert.equal(canDeleteHistory(null, "2026-01-01"), false);
  });
});

describe("H77 deleteSavedRoster", () => {
  it("removes only that forward-facing entry and writes an audit line", () => {
    const e = saveBlock("2026-09-21");
    const lines = [];
    setAuditTestSink((a, d) => lines.push(a + " " + d));
    assert.equal(deleteSavedRoster(e.id, "2026-09-10"), true);
    assert.equal(history().length, 0);
    assert.ok(lines.some((l) => l.startsWith("ROSTER_DELETED") && l.includes("2026-09-21")));
  });

  it("refuses to delete a historic entry, leaving the log untouched", () => {
    const e = saveBlock("2026-09-21");
    assert.equal(deleteSavedRoster(e.id, "2026-10-30"), false);
    assert.equal(history().length, 1);
    assert.equal(block().startDate, "2026-09-21");
  });

  it("unknown id is a no-op", () => {
    saveBlock("2026-09-21");
    assert.equal(deleteSavedRoster("nope", "2026-09-10"), false);
    assert.equal(history().length, 1);
  });
});
