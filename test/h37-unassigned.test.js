/**
 * H37 — Unassigned empty cells; spare notes / HVB deprecated.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubLocalStorage, baseDoc } from "./helpers.js";

stubLocalStorage();

const { S } = await import("../src/js/state.js");
const { migrateToV2, block } = await import("../src/js/model.js");
const { generate } = await import("../src/js/generator.js");
const { buildSnapshot, rotaHTML, snapCompareKey, saveRoster, isRosterUnsaved } = await import("../src/js/snapshot.js");

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

beforeEach(() => {
  localStorage.clear();
});

describe("H37 Unassigned cell (no spare notes)", () => {
  it("Present person with no role is kind spare with empty text", () => {
    load(baseDoc({
      roles: [role("re", "Escort")],
      people: [person("p1", "Joe"), person("p2", "Ann")],
      personRoles: [
        { personId: "p1", roleId: "re" },
        { personId: "p2", roleId: "re" }
      ]
    }));
    generate();
    const snap = buildSnapshot();
    const spareCells = snap.cells.flat().filter((c) => c.kind === "spare");
    assert.ok(spareCells.length >= 1, "at least one unassigned Present cell");
    spareCells.forEach((c) => {
      assert.equal(c.text, "");
      assert.equal(c.color, "#FFFFFF");
    });
  });

  it("buildSnapshot omits spareNotes", () => {
    load(baseDoc({
      roles: [role("re", "Escort")],
      people: [person("p1", "Joe"), person("p2", "Ann")],
      personRoles: [
        { personId: "p1", roleId: "re" },
        { personId: "p2", roleId: "re" }
      ]
    }));
    generate();
    const snap = buildSnapshot();
    assert.equal(Object.prototype.hasOwnProperty.call(snap, "spareNotes"), false);
  });

  it("rotaHTML shows Unassigned label, not HVB input", () => {
    load(baseDoc({
      roles: [role("re", "Escort")],
      people: [person("p1", "Joe"), person("p2", "Ann")],
      personRoles: [
        { personId: "p1", roleId: "re" },
        { personId: "p2", roleId: "re" }
      ]
    }));
    generate();
    const html = rotaHTML(buildSnapshot(), { editable: true });
    assert.ok(html.includes("spare-empty"), "uses spare-empty class");
    assert.ok(html.includes("Unassigned"), "shows Unassigned label");
    assert.equal(html.includes("spareNote"), false);
    assert.equal(html.includes("HVB"), false);
    assert.equal(html.includes("<input"), false);
  });

  it("migrate-on-open clears stored spareNotes", () => {
    load(baseDoc({
      blocks: {
        current: {
          id: "b_current",
          startDate: "2026-09-21",
          shifts: ["Day", "Day", "Night", "Night"],
          stale: false,
          generatedAt: null,
          attendance: [],
          assignments: [],
          spareNotes: [{ date: "2026-09-21", personId: "p_owen", text: "HVB" }]
        },
        history: []
      }
    }));
    assert.deepEqual(block().spareNotes, []);
  });

  it("legacy snap spareNotes do not affect unsaved compare", () => {
    load(baseDoc({
      roles: [role("re", "Escort")],
      people: [person("p1", "Joe")],
      personRoles: [{ personId: "p1", roleId: "re" }]
    }));
    generate();
    saveRoster();
    assert.equal(isRosterUnsaved(), false);
    const live = buildSnapshot();
    const withLegacy = { ...live, spareNotes: [{ date: "2026-09-21", personId: "p1", text: "HVB" }] };
    assert.equal(snapCompareKey(live), snapCompareKey(withLegacy));
  });
});
