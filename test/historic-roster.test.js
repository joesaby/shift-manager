/**
 * H24 Historic roster — person × day snap from saved entry (unified Roster layout).
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubLocalStorage, baseDoc } from "./helpers.js";

stubLocalStorage();
globalThis.window = globalThis.window || {};

const { S } = await import("../src/js/state.js");
const { migrateToV2, writeRoster } = await import("../src/js/model.js");
const { saveRoster, personDaySnapFromHistory } = await import("../src/js/snapshot.js");
const { vHist } = await import("../src/js/screens/hist.js");

function load(doc) {
  S.data = migrateToV2(doc);
  S.dirty = false;
}

beforeEach(() => {
  localStorage.clear();
  S.ui.histYear = null;
  S.ui.histMonth = null;
  S.ui.histId = null;
  S.ui.screen = "hist";
});

describe("H24 personDaySnapFromHistory", () => {
  it("returns the saved person-day snap when present", () => {
    load(baseDoc({
      roles: [{
        id: "r1", name: "Beat 1", groupId: "g1",
        usedAtDay: true, usedAtNight: true, hard: false, skillRestricted: false, essential: true, sortOrder: 1
      }],
      people: [{ id: "p1", name: "Ann One", active: true, fixedRoleId: null, employeeNo: "111", shoulderNo: "22" }],
      personRoles: [{ personId: "p1", roleId: "r1" }]
    }));
    writeRoster([{ assign: { r1: "p1" } }, { assign: {} }, { assign: {} }, { assign: {} }]);
    saveRoster();
    const entry = S.data.blocks.history[0];
    const out = personDaySnapFromHistory(entry);
    assert.equal(out.layout, "person-day");
    assert.equal(out.people[0].name, "Ann One");
    assert.equal(out.people[0].employeeNo, "111");
    assert.equal(out.cells[0][0].kind, "role");
    assert.equal(out.cells[0][0].text, "Beat 1");
  });

  it("rebuilds a person-day snap from assignments when snap layout is missing", () => {
    load(baseDoc({
      roles: [{
        id: "r1", name: "Escort", groupId: "g1",
        usedAtDay: true, usedAtNight: true, hard: false, skillRestricted: false, essential: true, sortOrder: 1
      }],
      people: [{ id: "p1", name: "Bob Two", active: true, fixedRoleId: null, employeeNo: "", shoulderNo: "" }],
      personRoles: [{ personId: "p1", roleId: "r1" }]
    }));
    writeRoster([{ assign: { r1: "p1" } }, { assign: {} }, { assign: {} }, { assign: {} }]);
    saveRoster();
    const entry = S.data.blocks.history[0];
    delete entry.snap.layout;
    delete entry.snap.cells;
    delete entry.snap.people;
    const out = personDaySnapFromHistory(entry);
    assert.equal(out.layout, "person-day");
    assert.ok(out.people.some((p) => p.name === "Bob Two"));
    assert.equal(out.cells[0][0].kind, "role");
    assert.equal(out.cells[0][0].text, "Escort");
  });
});

describe("H24 Historic roster screen", () => {
  it("renders person × day columns like Roster (not the old role grid)", () => {
    load(baseDoc({
      roles: [{
        id: "r1", name: "Beat 1", groupId: "g1",
        usedAtDay: true, usedAtNight: true, hard: false, skillRestricted: false, essential: true, sortOrder: 1
      }],
      people: [{ id: "p1", name: "Ann One", active: true, fixedRoleId: null, employeeNo: "1", shoulderNo: "2" }],
      personRoles: [{ personId: "p1", roleId: "r1" }]
    }));
    writeRoster([{ assign: { r1: "p1" } }, { assign: {} }, { assign: {} }, { assign: {} }]);
    saveRoster();
    const html = vHist();
    assert.match(html, /Historic roster/);
    assert.match(html, /Employee no\./);
    assert.match(html, /Shoulder no\./);
    assert.match(html, /Beat 1/);
    assert.match(html, /Ann One/);
    assert.match(html, /rota-freeze/);
    assert.doesNotMatch(html, /rostergrid/);
    assert.doesNotMatch(html, /histDay/);
  });
});
