/**
 * H28 — Generate rotates roles fairly across every saved block, not just the current four days.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubLocalStorage, baseDoc } from "./helpers.js";

stubLocalStorage();

const { S } = await import("../src/js/state.js");
const { migrateToV2, rosterDays, block, historicRoleCounts } = await import("../src/js/model.js");
const { generate } = await import("../src/js/generator.js");

function load(doc) { S.data = migrateToV2(doc); S.dirty = false; }

function role(id, name, groupId, opts = {}) {
  return {
    id, name, groupId, usedAtDay: true, usedAtNight: true,
    hard: false, skillRestricted: false, essential: true, sortOrder: 1, ...opts
  };
}

const GROUPS = [
  { id: "g1", name: "Car", color: "#F8BBD0", sortOrder: 1 },
  { id: "g2", name: "Beat", color: "#C8E6C9", sortOrder: 2 },
  { id: "g3", name: "Inside", color: "#FFE0B2", sortOrder: 3 }
];

function addDays(iso, n) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Save the live block to the log the way Save roster does (assignments are what counting reads). */
function saveToLog() {
  const b = block();
  S.data.blocks.history.push({
    id: "h_" + b.startDate, startDate: b.startDate, shifts: b.shifts.slice(),
    attendance: [], assignments: b.assignments.map((a) => ({ ...a })), records: []
  });
}

beforeEach(() => localStorage.clear());

describe("H28 historic role counts", () => {
  it("counts each person × role across saved rotas, skipping the saved copy of the live block", () => {
    load(baseDoc({
      groups: GROUPS,
      roles: [role("car", "Car", "g1"), role("beat", "Beat", "g2")],
      people: [{ id: "a", name: "Ann", active: true }, { id: "b", name: "Bob", active: true }],
      blocks: {
        current: { id: "cur", startDate: "2026-09-21", shifts: ["Day", "Day", "Night", "Night"], attendance: [], assignments: [] },
        history: [
          { id: "h1", startDate: "2026-09-13", attendance: [], assignments: [
            { date: "2026-09-13", roleId: "car", personId: "a" },
            { date: "2026-09-14", roleId: "car", personId: "a" },
            { date: "2026-09-14", roleId: "beat", personId: "b" }
          ] },
          { id: "h2", startDate: "2026-09-21", attendance: [], assignments: [
            { date: "2026-09-21", roleId: "car", personId: "b" }
          ] }
        ]
      }
    }));
    const c = historicRoleCounts();
    assert.equal(c["a|car"], 2);
    assert.equal(c["b|beat"], 1);
    assert.equal(c["b|car"], undefined, "the saved copy of the block being generated is not counted");
  });
});

describe("H28 generate uses history", () => {
  it("gives a role to whoever has done it least across older blocks", () => {
    const history = [];
    for (let i = 0; i < 10; i++) {
      history.push({ id: "h" + i, startDate: "2026-08-0" + (i % 9 + 1), attendance: [],
        assignments: [{ date: "2026-08-0" + (i % 9 + 1), roleId: "car", personId: "a" }] });
    }
    for (let run = 0; run < 20; run++) {
      load(baseDoc({
        groups: GROUPS,
        roles: [role("car", "Car", "g1"), role("beat", "Beat", "g2")],
        people: [{ id: "a", name: "Ann", active: true }, { id: "b", name: "Bob", active: true }],
        personRoles: ["a", "b"].flatMap((p) => [{ personId: p, roleId: "car" }, { personId: p, roleId: "beat" }]),
        blocks: {
          current: { id: "cur", startDate: "2026-09-21", shifts: ["Day", "Day", "Night", "Night"], attendance: [], assignments: [] },
          history
        }
      }));
      generate();
      assert.equal(rosterDays()[0].assign.car, "b", "Bob has never done Car, Ann has done it 10 times");
    }
  });

  it("evens out each role over many blocks (Duty stats counts stay close)", () => {
    const people = ["a", "b", "c", "d", "e", "f"].map((id) => ({ id, name: id, active: true, fixedRoleId: null }));
    const roles = [
      role("c1", "Car 1", "g1", { sortOrder: 1, hard: true }),
      role("c2", "Car 2", "g1", { sortOrder: 2 }),
      role("b1", "Beat 1", "g2", { sortOrder: 3 }),
      role("b2", "Beat 2", "g2", { sortOrder: 4, hard: true }),
      role("i1", "Inside 1", "g3", { sortOrder: 5 }),
      role("i2", "Inside 2", "g3", { sortOrder: 6 })
    ];
    load(baseDoc({
      groups: GROUPS, roles, people,
      personRoles: people.flatMap((p) => roles.map((r) => ({ personId: p.id, roleId: r.id })))
    }));
    const blocks = 12;
    for (let k = 0; k < blocks; k++) {
      block().startDate = addDays("2026-01-01", k * 8);
      generate();
      saveToLog();
    }
    block().startDate = "2027-01-01";
    const c = historicRoleCounts();
    roles.forEach((r) => {
      const n = people.map((p) => c[p.id + "|" + r.id] || 0);
      assert.ok(Math.max(...n) - Math.min(...n) <= 2, r.name + " spread " + n.join(","));
    });
  });

  it("fills a role only one Present person can do, without relying on a skill flag", () => {
    for (let run = 0; run < 20; run++) {
      load(baseDoc({
        groups: GROUPS,
        roles: [role("beat", "Beat", "g2", { sortOrder: 1 }), role("car", "Car", "g1", { sortOrder: 2 })],
        people: [{ id: "a", name: "Ann", active: true }, { id: "b", name: "Bob", active: true }],
        personRoles: [{ personId: "a", roleId: "car" }, { personId: "a", roleId: "beat" }, { personId: "b", roleId: "beat" }]
      }));
      generate();
      rosterDays().forEach((day, d) => {
        assert.equal(day.assign.car, "a", "day " + d + " Car");
        assert.equal(day.assign.beat, "b", "day " + d + " Beat");
      });
    }
  });
});
