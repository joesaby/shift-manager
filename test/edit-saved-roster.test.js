/**
 * H68 — reopen a saved roster for editing (prompt + save first when there is unsaved work).
 * H69 — a roster whose block has passed can be corrected but never regenerated.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubLocalStorage, baseDoc } from "./helpers.js";

stubLocalStorage();

const { S } = await import("../src/js/state.js");
const { migrateToV2, block, history, setStatus, isPastBlock, canRegenerate, canEditHistory } = await import("../src/js/model.js");
const { generate } = await import("../src/js/generator.js");
const { saveRoster, editSavedRoster, isRosterUnsaved } = await import("../src/js/snapshot.js");
import { setAuditTestSink } from "../src/js/audit.js";

const role = (id, name) => ({ id, name, groupId: "g1", usedAtDay: true, usedAtNight: true, hard: false, skillRestricted: false, essential: true, sortOrder: 1 });
const person = (id, name) => ({ id, name, active: true, fixedRoleId: null });

function load(startDate = "2026-09-21") {
  const doc = baseDoc({
    roles: [role("re", "Escort")],
    people: [person("p1", "Joe"), person("p2", "Ann")],
    personRoles: [{ personId: "p1", roleId: "re" }, { personId: "p2", roleId: "re" }]
  });
  doc.blocks.current.startDate = startDate;
  S.data = migrateToV2(doc);
  S.dirty = false;
  S.ui.confirm = null;
  S.ui.screen = "att";
}

/** Save the block starting at `start`, then move the working block on to `next` (ungenerated). */
function saveThenMoveOn(start, next) {
  load(start);
  generate();
  saveRoster();
  block().startDate = next;
  block().generatedAt = null;
  block().attendance = [];
  block().assignments = [];
}

beforeEach(() => { localStorage.clear(); setAuditTestSink(null); });

describe("H69 isPastBlock / canRegenerate", () => {
  it("is past only once the block's last day is before today", () => {
    load("2026-09-21"); // days 21..24
    assert.equal(isPastBlock("2026-09-25"), true);
    assert.equal(isPastBlock("2026-09-24"), false, "last day is today: still current");
    assert.equal(isPastBlock("2026-09-21"), false);
    assert.equal(isPastBlock("2026-09-01"), false, "future block");
  });

  it("blocks regenerate for a past block that has a roster, not for a past block without one", () => {
    load("2026-09-21");
    assert.equal(canRegenerate("2026-10-30"), true, "no roster yet: first generate is allowed");
    generate();
    assert.equal(canRegenerate("2026-10-30"), false);
    assert.equal(canRegenerate("2026-09-22"), true, "current block can be regenerated");
  });
});

describe("H68 editSavedRoster", () => {
  it("reads a saved entry back into the working block without touching the log", () => {
    saveThenMoveOn("2026-09-21", "2026-09-25");
    const id = history()[0].id;
    assert.equal(canEditHistory(history()[0]), true);
    editSavedRoster(id);
    assert.equal(block().startDate, "2026-09-21");
    assert.notEqual(block().generatedAt, null);
    assert.equal(S.ui.screen, "ros");
    assert.equal(isRosterUnsaved(), false, "reopened roster equals the saved one");
    setStatus("p2", 0, "Sick leave");
    assert.equal(history()[0].attendance.length, 0, "editing the working copy never mutates the log entry");
  });

  it("saving after an edit replaces that block's log entry (still one entry)", () => {
    saveThenMoveOn("2026-09-21", "2026-09-25");
    editSavedRoster(history()[0].id);
    setStatus("p2", 0, "Sick leave");
    saveRoster();
    assert.equal(history().length, 1);
    assert.equal(history()[0].attendance.length, 1);
  });

  it("asks to save first when the working roster has unsaved changes, and does nothing until confirmed", () => {
    saveThenMoveOn("2026-09-21", "2026-09-28");
    const id = history()[0].id;
    generate(); // working block 28th, generated but never saved
    assert.equal(isRosterUnsaved(), true);
    editSavedRoster(id);
    assert.ok(S.ui.confirm, "confirm shown");
    assert.equal(block().startDate, "2026-09-28", "not switched yet");
    S.ui.confirm.fn();
    assert.equal(history().length, 2, "working roster was saved first");
    assert.equal(block().startDate, "2026-09-21");
  });

  it("warns before replacing attendance typed for a block with no roster yet", () => {
    saveThenMoveOn("2026-09-21", "2026-09-28");
    setStatus("p1", 0, "Annual leave");
    editSavedRoster(history()[0].id);
    assert.ok(S.ui.confirm);
    assert.equal(block().startDate, "2026-09-28");
    S.ui.confirm.fn();
    assert.equal(block().startDate, "2026-09-21");
  });

  it("opens straight away when nothing would be lost", () => {
    saveThenMoveOn("2026-09-21", "2026-09-28");
    editSavedRoster(history()[0].id);
    assert.equal(S.ui.confirm, null);
    assert.equal(block().startDate, "2026-09-21");
  });

  it("does not open an older-format entry that has no dates / assignments to edit", () => {
    load("2026-09-21");
    history().push({ id: "old", startDate: "2026-09-01", savedAt: new Date().toISOString(), snap: { layout: "person-role", byDay: [] } });
    assert.equal(canEditHistory(history()[0]), false);
    editSavedRoster("old");
    assert.equal(block().startDate, "2026-09-21");
  });
});
