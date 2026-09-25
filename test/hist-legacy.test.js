/**
 * Historic roster: entries saved before the person × day snapshot are converted for display.
 * Their "unfilled" list would be guessed from today's role list, so it must not be shown as a warning.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubLocalStorage, baseDoc } from "./helpers.js";

stubLocalStorage();
globalThis.window = globalThis.window || {};

const { S } = await import("../src/js/state.js");
const { migrateToV2 } = await import("../src/js/model.js");
const { generate } = await import("../src/js/generator.js");
const { saveRoster } = await import("../src/js/snapshot.js");
const { vHist } = await import("../src/js/screens/hist.js");

const role = (id, name) => ({ id, name, groupId: "g1", usedAtDay: true, usedAtNight: true, hard: false, skillRestricted: false, essential: true, sortOrder: 1 });

function load() {
  S.data = migrateToV2(baseDoc({
    roles: [role("re", "Escort"), role("rs", "Scene")],
    people: [{ id: "p1", name: "Ann One", active: true, fixedRoleId: null }],
    personRoles: [{ personId: "p1", roleId: "re" }, { personId: "p1", roleId: "rs" }]
  }));
  S.ui.histYear = null; S.ui.histMonth = null; S.ui.histId = null;
}

beforeEach(() => { localStorage.clear(); load(); });

describe("Historic roster", () => {
  it("a current-format entry shows its own saved unfilled warning", () => {
    generate();
    saveRoster(); /* 1 person, 2 essential roles: one is always unfilled */
    const html = vHist();
    assert.ok(html.includes("Unfilled essential"));
    assert.ok(!html.includes("older saved layout"));
  });

  it("an entry from before person × day snapshots shows the grid without guessing at unfilled roles", () => {
    S.data.blocks.history.push({
      id: "old1", startDate: "2026-09-07", shifts: ["Day", "Day", "Night", "Night"],
      records: [{ date: "2026-09-07", shift: "Day", person: "Ann One", status: "Present", role: "Escort" }]
    });
    const html = vHist();
    assert.ok(html.includes("Ann One") && html.includes("Escort"));
    assert.ok(!html.includes("Unfilled essential"), "no guessed warning");
    assert.ok(html.includes("older saved layout"), "explains why");
  });
});
