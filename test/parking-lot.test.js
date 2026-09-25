/**
 * H45 / H47 — parking lot (essential only); chip→person drop matrix; silent non-essential vacate.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubLocalStorage, baseDoc } from "./helpers.js";

stubLocalStorage();

const { S } = await import("../src/js/state.js");
const { migrateToV2, setStatus, vacatedEssential, rosterDays, block } = await import("../src/js/model.js");
const { assignParkedRole, swapPeople } = await import("../src/js/generator.js");

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

beforeEach(() => localStorage.clear());

function dayBlock(assignments, attendance = []) {
  return {
    current: {
      id: "b_current",
      startDate: "2026-09-21",
      shifts: ["Day", "Day", "Night", "Night"],
      stale: false,
      generatedAt: "2026-09-20T12:00:00.000Z",
      attendance,
      assignments,
      spareNotes: []
    },
    history: []
  };
}

describe("H45 parking lot essential-only", () => {
  it("sick holder of non-essential creates no parking chip", () => {
    load(baseDoc({
      roles: [
        role("re", "Escort", { essential: true }),
        role("nf", "Files 3", { essential: false, sortOrder: 2 })
      ],
      people: [person("p1", "Joe"), person("p2", "Ann")],
      personRoles: [
        { personId: "p1", roleId: "re" }, { personId: "p1", roleId: "nf" },
        { personId: "p2", roleId: "re" }, { personId: "p2", roleId: "nf" }
      ],
      blocks: dayBlock(
        [
          { date: "2026-09-21", roleId: "re", personId: "p2", source: "generated" },
          { date: "2026-09-21", roleId: "nf", personId: "p1", source: "generated" }
        ],
        [{ date: "2026-09-21", personId: "p1", statusId: "sick_leave" }]
      )
    }));
    const lot = vacatedEssential(0);
    assert.ok(!lot.some((x) => x.roleId === "nf"), "non-essential must not park");
    assert.equal(rosterDays()[0].former.nf, "p1");
  });

  it("sick holder of essential creates a parking chip", () => {
    load(baseDoc({
      roles: [role("re", "Escort")],
      people: [person("p1", "Brennan")],
      personRoles: [{ personId: "p1", roleId: "re" }],
      blocks: dayBlock(
        [{ date: "2026-09-21", roleId: "re", personId: "p1", source: "generated" }],
        [{ date: "2026-09-21", personId: "p1", statusId: "sick_leave" }]
      )
    }));
    const lot = vacatedEssential(0);
    assert.equal(lot.length, 1);
    assert.equal(lot[0].roleId, "re");
    assert.equal(lot[0].wasPersonId, "p1");
  });
});

describe("H47 chip → person drop matrix", () => {
  it("chip → non-essential holder: they take essential; non-essential dropped (no chip)", () => {
    load(baseDoc({
      roles: [
        role("re", "Escort", { essential: true }),
        role("nf", "Files 1", { essential: false, sortOrder: 2 })
      ],
      people: [person("pSick", "Joe"), person("p2", "Ann")],
      personRoles: [
        { personId: "pSick", roleId: "re" }, { personId: "pSick", roleId: "nf" },
        { personId: "p2", roleId: "re" }, { personId: "p2", roleId: "nf" }
      ],
      blocks: dayBlock(
        [
          { date: "2026-09-21", roleId: "re", personId: "pSick", source: "generated" },
          { date: "2026-09-21", roleId: "nf", personId: "p2", source: "generated" }
        ],
        [{ date: "2026-09-21", personId: "pSick", statusId: "sick_leave" }]
      )
    }));
    assert.equal(rosterDays()[0].assign.re, null);
    const ok = assignParkedRole(0, "re", "p2");
    assert.equal(ok, true);
    const day = rosterDays()[0];
    assert.equal(day.assign.re, "p2");
    assert.equal(day.assign.nf, null);
    assert.ok(!block().assignments.some((a) => a.date === "2026-09-21" && a.roleId === "nf"));
    assert.ok(!vacatedEssential(0).some((x) => x.roleId === "nf"));
  });

  it("chip → essential holder: old essential moves into the parking lot", () => {
    load(baseDoc({
      roles: [
        role("ra", "Escort", { essential: true, sortOrder: 1 }),
        role("rb", "Scene", { essential: true, sortOrder: 2 })
      ],
      people: [person("pSick", "Joe"), person("p2", "Ann")],
      personRoles: [
        { personId: "pSick", roleId: "ra" }, { personId: "pSick", roleId: "rb" },
        { personId: "p2", roleId: "ra" }, { personId: "p2", roleId: "rb" }
      ],
      blocks: dayBlock(
        [
          { date: "2026-09-21", roleId: "ra", personId: "pSick", source: "generated" },
          { date: "2026-09-21", roleId: "rb", personId: "p2", source: "generated" }
        ],
        [{ date: "2026-09-21", personId: "pSick", statusId: "sick_leave" }]
      )
    }));
    assert.equal(assignParkedRole(0, "ra", "p2"), true);
    const day = rosterDays()[0];
    assert.equal(day.assign.ra, "p2");
    assert.equal(day.assign.rb, null);
    const lot = vacatedEssential(0);
    assert.ok(lot.some((x) => x.roleId === "rb"));
  });
});

describe("H47 essential → non-essential person drag is swap", () => {
  it("swaps rather than dropping the non-essential", () => {
    load(baseDoc({
      roles: [
        role("re", "Escort", { essential: true }),
        role("nf", "Files 1", { essential: false, sortOrder: 2 })
      ],
      people: [person("p1", "One"), person("p2", "Two")],
      personRoles: [
        { personId: "p1", roleId: "re" }, { personId: "p1", roleId: "nf" },
        { personId: "p2", roleId: "re" }, { personId: "p2", roleId: "nf" }
      ],
      blocks: dayBlock([
        { date: "2026-09-21", roleId: "re", personId: "p1", source: "generated" },
        { date: "2026-09-21", roleId: "nf", personId: "p2", source: "generated" }
      ])
    }));
    assert.equal(swapPeople(0, "p1", "p2"), true);
    const day = rosterDays()[0].assign;
    assert.equal(day.re, "p2");
    assert.equal(day.nf, "p1");
  });
});
