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
const { RULES, LOOKBACK_MONTHS } = await import("../src/js/rules.js");

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

describe("H28 look-back and Present-only counting", () => {
  const cur = (extra = {}) => ({ id: "cur", startDate: "2026-09-21", shifts: ["Day", "Day", "Night", "Night"], attendance: [], assignments: [], ...extra });
  const entry = (date, pid = "a", extra = {}) => ({ id: "h_" + date + pid, startDate: date, attendance: [], assignments: [{ date, roleId: "car", personId: pid }], ...extra });

  it("counts only the " + 12 + " months before the block starts (no older, no saved future blocks)", () => {
    assert.equal(LOOKBACK_MONTHS, 12);
    load(baseDoc({
      groups: GROUPS, roles: [role("car", "Car", "g1")],
      people: [{ id: "a", name: "Ann", active: true }],
      blocks: { current: cur(), history: [entry("2025-09-01"), entry("2025-10-01"), entry("2026-09-13"), entry("2026-10-05")] }
    }));
    assert.equal(historicRoleCounts()["a|car"], 2, "2025-10-01 and 2026-09-13 only");
  });

  it("does not count a saved duty on a day the person was not Present", () => {
    load(baseDoc({
      groups: GROUPS, roles: [role("car", "Car", "g1")],
      people: [{ id: "a", name: "Ann", active: true }, { id: "b", name: "Bob", active: true, longTermSick: { from: "2026-09-01", to: "" } }],
      blocks: { current: cur(), history: [
        entry("2026-08-01", "a", { attendance: [{ date: "2026-08-01", personId: "a", statusId: "sick_leave" }] }),
        entry("2026-08-05", "a"),
        entry("2026-09-05", "b")
      ] }
    }));
    const c = historicRoleCounts();
    assert.equal(c["a|car"], 1, "sick day not counted");
    assert.equal(c["b|car"], undefined, "long-term sick day not counted");
  });

  it("scores by share of the person's own duties", () => {
    const leastDone = RULES.find((r) => r.key === "leastDone");
    assert.equal(leastDone.score({ count: 30, total: 120 }), 0.25);
    assert.equal(leastDone.score({ count: 0, total: 0 }), 0);
    assert.equal(leastDone.score({ count: 1, total: 2 }), 0.5);
  });

  it("a new starter does not monopolise a role veterans have done for a year", () => {
    const people = ["a", "b", "n", "x", "y"].map((id) => ({ id, name: id, active: true }));
    const roles = [
      role("car", "Car", "g1", { sortOrder: 1 }), role("beat", "Beat", "g2", { sortOrder: 2 }),
      role("desk", "Desk", "g3", { sortOrder: 3 }), role("files", "Files", "g4", { sortOrder: 4 }),
      role("admin", "Admin", "g5", { sortOrder: 5 })
    ];
    const groups = GROUPS.concat([{ id: "g4", name: "Files", color: "#fff", sortOrder: 4 }, { id: "g5", name: "Admin", color: "#fff", sortOrder: 5 }]);
    const personRoles = people.flatMap((p) => roles.filter((r) => r.id !== "car" || ["a", "b", "n"].includes(p.id)).map((r) => ({ personId: p.id, roleId: r.id })));
    /* A year of veterans' history: a and b each drove 30 times but mostly did Desk / Files (Car share 1/6). */
    const history = [];
    for (let k = 0; k < 60; k++) {
      const date = addDays("2025-10-01", k * 5);
      const drv = k % 2 ? "a" : "b"; const other = k % 2 ? "b" : "a";
      const asg = [{ date, roleId: "car", personId: drv }, { date, roleId: "beat", personId: other }];
      for (let e = 1; e <= 4; e++) {
        const dd = addDays(date, e);
        asg.push({ date: dd, roleId: "desk", personId: "a" }, { date: dd, roleId: "files", personId: "b" });
      }
      history.push({ id: "v" + k, startDate: date, attendance: [], assignments: asg });
    }
    load(baseDoc({ groups, roles, people, personRoles, blocks: { current: { id: "cur", startDate: "2026-09-21", shifts: ["Day", "Day", "Night", "Night"], attendance: [], assignments: [] }, history } }));
    let carN = 0;
    for (let k = 0; k < 6; k++) {
      block().startDate = addDays("2026-09-21", k * 8);
      generate();
      carN += rosterDays().filter((day) => day.assign.car === "n").length;
      saveToLog();
    }
    /* Raw counts: every other day (12) until they reach 30; by share they settle near the veterans' 1 in 6. */
    assert.ok(carN <= 8, "new starter drove " + carN + " of 24 days");
  });
});
