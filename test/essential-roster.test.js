/**
 * H43–H47 / H6 / H12 / H13 / H45 — essential roles, vacated derivation, swapPeople, snapshot unfilled.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubLocalStorage, baseDoc } from "./helpers.js";

stubLocalStorage();

const { S } = await import("../src/js/state.js");
const {
  migrateToV2, setStatus, rosterDays, roleOfPersonOnDay, isStale, markStale, block,
  essentialRolesForDay
} = await import("../src/js/model.js");
const { generate, assignTo, swapPeople } = await import("../src/js/generator.js");
const { vSelModal } = await import("../src/js/ui-kit.js");
const { buildSnapshot } = await import("../src/js/snapshot.js");

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

function person(id, name, fixedRoleId = null) {
  return { id, name, active: true, fixedRoleId };
}

beforeEach(() => {
  localStorage.clear();
});

describe("H43 essential default on migrate", () => {
  it("pre-existing roles without essential become essential:true", () => {
    const doc = baseDoc({
      roles: [{ id: "r1", name: "Car 1", groupId: "g1", usedAtDay: true, usedAtNight: true, hard: false, skillRestricted: false, sortOrder: 1 }]
    });
    load(doc);
    assert.equal(S.data.roles[0].essential, true);
  });
});

describe("H44 / H6 generate two-pass", () => {
  it("fills essential roles before non-essential", () => {
    load(baseDoc({
      roles: [
        role("re", "Escort", { essential: true, sortOrder: 1 }),
        role("nf1", "Files 1", { essential: false, sortOrder: 2 }),
        role("nf2", "Files 2", { essential: false, sortOrder: 3 })
      ],
      people: [
        person("p1", "Ann One"),
        person("p2", "Bob Two")
      ],
      personRoles: [
        { personId: "p1", roleId: "re" }, { personId: "p1", roleId: "nf1" }, { personId: "p1", roleId: "nf2" },
        { personId: "p2", roleId: "re" }, { personId: "p2", roleId: "nf1" }, { personId: "p2", roleId: "nf2" }
      ]
    }));
    generate();
    const day0 = rosterDays()[0].assign;
    assert.ok(day0.re, "essential Escort must be filled");
    const filledNon = [day0.nf1, day0.nf2].filter(Boolean).length;
    assert.equal(filledNon, 1, "exactly one spare fills one non-essential");
  });

  it("H44 non-essential shortage never fails generate (leaves lower-priority empty)", () => {
    load(baseDoc({
      roles: [
        role("re", "Escort", { essential: true, sortOrder: 1 }),
        role("nf1", "Files 1", { essential: false, sortOrder: 2 }),
        role("nf2", "Files 2", { essential: false, sortOrder: 3 }),
        role("nf3", "Files 3", { essential: false, sortOrder: 4 })
      ],
      people: [person("p1", "Only One")],
      personRoles: [
        { personId: "p1", roleId: "re" },
        { personId: "p1", roleId: "nf1" },
        { personId: "p1", roleId: "nf2" },
        { personId: "p1", roleId: "nf3" }
      ]
    }));
    generate();
    const day0 = rosterDays()[0].assign;
    assert.equal(day0.re, "p1");
    assert.equal(day0.nf1, null);
    assert.equal(day0.nf2, null);
    assert.equal(day0.nf3, null);
  });

  it("H44 priority: with one spare, fill Files 1 not Files 3", () => {
    load(baseDoc({
      roles: [
        role("re", "Escort", { essential: true, sortOrder: 1 }),
        role("nf1", "Files 1", { essential: false, sortOrder: 2 }),
        role("nf3", "Files 3", { essential: false, sortOrder: 4 })
      ],
      people: [
        person("p1", "Ann"),
        person("p2", "Bob")
      ],
      personRoles: [
        { personId: "p1", roleId: "re" }, { personId: "p1", roleId: "nf1" }, { personId: "p1", roleId: "nf3" },
        { personId: "p2", roleId: "re" }, { personId: "p2", roleId: "nf1" }, { personId: "p2", roleId: "nf3" }
      ]
    }));
    generate();
    const day0 = rosterDays()[0].assign;
    assert.ok(day0.re);
    assert.ok(day0.nf1, "higher-priority non-essential filled");
    assert.equal(day0.nf3, null, "lower-priority left empty");
  });
});

describe("H45 vacated derivation", () => {
  it("non-Present holder counts as vacated; Present restores", () => {
    load(baseDoc({
      roles: [role("re", "Escort")],
      people: [person("p1", "Joe")],
      personRoles: [{ personId: "p1", roleId: "re" }],
      blocks: {
        current: {
          id: "b_current",
          startDate: "2026-09-21",
          shifts: ["Day", "Day", "Night", "Night"],
          stale: false,
          generatedAt: "2026-09-20T12:00:00.000Z",
          attendance: [],
          assignments: [{ date: "2026-09-21", roleId: "re", personId: "p1", source: "generated" }],
          spareNotes: []
        },
        history: []
      }
    }));
    assert.equal(rosterDays()[0].assign.re, "p1");
    setStatus("p1", 0, "Sick leave");
    const day = rosterDays()[0];
    assert.equal(day.assign.re, null);
    assert.equal(day.former.re, "p1");
    assert.equal(roleOfPersonOnDay(0, "p1"), "re");
    setStatus("p1", 0, "Present");
    assert.equal(rosterDays()[0].assign.re, "p1");
  });

  it("H13 attendance does not set stale", () => {
    load(baseDoc({
      roles: [role("re", "Escort")],
      people: [person("p1", "Joe")],
      personRoles: [{ personId: "p1", roleId: "re" }],
      blocks: {
        current: {
          id: "b_current",
          startDate: "2026-09-21",
          shifts: ["Day", "Day", "Night", "Night"],
          stale: false,
          generatedAt: "2026-09-20T12:00:00.000Z",
          attendance: [],
          assignments: [{ date: "2026-09-21", roleId: "re", personId: "p1", source: "generated" }],
          spareNotes: []
        },
        history: []
      }
    }));
    setStatus("p1", 0, "Sick leave");
    assert.equal(isStale(), false);
    markStale();
    assert.equal(isStale(), true);
  });
});

describe("H45 / assignTo vacated", () => {
  it("assignTo does not swap a non-Present former holder into the mover old role", () => {
    load(baseDoc({
      roles: [
        role("re", "Escort"),
        role("rs", "Scene")
      ],
      people: [person("pSick", "Joe"), person("p2", "Ann")],
      personRoles: [
        { personId: "pSick", roleId: "re" }, { personId: "pSick", roleId: "rs" },
        { personId: "p2", roleId: "re" }, { personId: "p2", roleId: "rs" }
      ],
      blocks: {
        current: {
          id: "b_current",
          startDate: "2026-09-21",
          shifts: ["Day", "Day", "Night", "Night"],
          stale: false,
          generatedAt: "2026-09-20T12:00:00.000Z",
          attendance: [{ date: "2026-09-21", personId: "pSick", statusId: "sick_leave" }],
          assignments: [
            { date: "2026-09-21", roleId: "re", personId: "pSick", source: "generated" },
            { date: "2026-09-21", roleId: "rs", personId: "p2", source: "generated" }
          ],
          spareNotes: []
        },
        history: []
      }
    }));
    assignTo(0, "re", "p2");
    const day = rosterDays()[0];
    assert.equal(day.assign.re, "p2");
    assert.equal(day.assign.rs, null, "Ann left Scene; sick Joe must not land on Scene");
    const stillSickOnEscort = block().assignments.find((a) => a.roleId === "re" && a.personId === "pSick");
    assert.equal(stillSickOnEscort, undefined);
  });
});

describe("H47 swapPeople", () => {
  it("holder↔holder swaps roles", () => {
    load(baseDoc({
      roles: [role("ra", "A"), role("rb", "B")],
      people: [person("p1", "One"), person("p2", "Two")],
      personRoles: [
        { personId: "p1", roleId: "ra" }, { personId: "p1", roleId: "rb" },
        { personId: "p2", roleId: "ra" }, { personId: "p2", roleId: "rb" }
      ],
      blocks: {
        current: {
          id: "b_current", startDate: "2026-09-21",
          shifts: ["Day", "Day", "Night", "Night"], stale: false,
          generatedAt: "2026-09-20T12:00:00.000Z", attendance: [],
          assignments: [
            { date: "2026-09-21", roleId: "ra", personId: "p1", source: "generated" },
            { date: "2026-09-21", roleId: "rb", personId: "p2", source: "generated" }
          ],
          spareNotes: []
        },
        history: []
      }
    }));
    const ok = swapPeople(0, "p1", "p2");
    assert.equal(ok, true);
    const day = rosterDays()[0].assign;
    assert.equal(day.ra, "p2");
    assert.equal(day.rb, "p1");
  });

  it("holder→unassigned hands over the role", () => {
    load(baseDoc({
      roles: [role("ra", "A")],
      people: [person("p1", "One"), person("p2", "Two")],
      personRoles: [
        { personId: "p1", roleId: "ra" },
        { personId: "p2", roleId: "ra" }
      ],
      blocks: {
        current: {
          id: "b_current", startDate: "2026-09-21",
          shifts: ["Day", "Day", "Night", "Night"], stale: false,
          generatedAt: "2026-09-20T12:00:00.000Z", attendance: [],
          assignments: [
            { date: "2026-09-21", roleId: "ra", personId: "p1", source: "generated" }
          ],
          spareNotes: []
        },
        history: []
      }
    }));
    assert.equal(swapPeople(0, "p1", "p2"), true);
    const day = rosterDays()[0].assign;
    assert.equal(day.ra, "p2");
    assert.equal(roleOfPersonOnDay(0, "p1"), null);
  });

  it("only mutates the given day (cross-day drops rejected in UI)", () => {
    load(baseDoc({
      roles: [role("ra", "A")],
      people: [person("p1", "One"), person("p2", "Two")],
      personRoles: [
        { personId: "p1", roleId: "ra" },
        { personId: "p2", roleId: "ra" }
      ],
      blocks: {
        current: {
          id: "b_current", startDate: "2026-09-21",
          shifts: ["Day", "Day", "Night", "Night"], stale: false,
          generatedAt: "2026-09-20T12:00:00.000Z", attendance: [],
          assignments: [
            { date: "2026-09-21", roleId: "ra", personId: "p1", source: "generated" },
            { date: "2026-09-22", roleId: "ra", personId: "p2", source: "generated" }
          ],
          spareNotes: []
        },
        history: []
      }
    }));
    assert.equal(swapPeople(0, "p1", "p2"), true);
    assert.equal(rosterDays()[0].assign.ra, "p2");
    assert.equal(rosterDays()[1].assign.ra, "p2", "day 1 unchanged");
  });
});

describe("H45 snapshot unfilled", () => {
  it("counts vacated essential as unfilled; ignores non-essential empty", () => {
    load(baseDoc({
      roles: [
        role("re", "Escort", { essential: true }),
        role("nf", "Files 1", { essential: false, sortOrder: 2 })
      ],
      people: [person("p1", "Joe")],
      personRoles: [
        { personId: "p1", roleId: "re" },
        { personId: "p1", roleId: "nf" }
      ],
      blocks: {
        current: {
          id: "b_current", startDate: "2026-09-21",
          shifts: ["Day", "Day", "Night", "Night"], stale: false,
          generatedAt: "2026-09-20T12:00:00.000Z",
          attendance: [{ date: "2026-09-21", personId: "p1", statusId: "sick_leave" }],
          assignments: [
            { date: "2026-09-21", roleId: "re", personId: "p1", source: "generated" }
          ],
          spareNotes: []
        },
        history: []
      }
    }));
    const snap = buildSnapshot();
    assert.ok(snap.unfilled[0].includes("Escort"));
    assert.ok(!snap.unfilled[0].includes("Files 1"));
    /* "was:" is screen-only: it must not leak into the printed/saved cell text. */
    assert.equal(snap.cells[0][0].text, "Sick leave");
    assert.equal(snap.cells[0][0].wasRole, "Escort");
  });
});

describe("H40 essential role count helper", () => {
  it("essentialRolesForDay counts essentials only", () => {
    load(baseDoc({
      roles: [
        role("re", "Escort", { essential: true }),
        role("nf", "Files", { essential: false, sortOrder: 2 })
      ]
    }));
    assert.equal(essentialRolesForDay(0).length, 1);
  });
});

describe("R8 review fixes", () => {
  it("non-essential fill order follows sortOrder even when a later role needs a skill", () => {
    load(baseDoc({
      roles: [
        role("re", "Escort", { essential: true, sortOrder: 1 }),
        role("nf1", "Files 1", { essential: false, sortOrder: 2 }),
        role("nf2", "Files 2", { essential: false, sortOrder: 3, skillRestricted: true })
      ],
      people: [person("p1", "Ann One"), person("p3", "Cal Three")],
      personRoles: [
        { personId: "p1", roleId: "re" },
        { personId: "p3", roleId: "nf1" }, { personId: "p3", roleId: "nf2" }
      ]
    }));
    generate();
    rosterDays().forEach((day) => {
      assert.equal(day.assign.nf1, "p3", "higher-priority Files 1 is filled first");
      assert.equal(day.assign.nf2, null);
    });
  });

  it("assignTo refuses a swap that would put the displaced holder in a role they cannot do", () => {
    load(baseDoc({
      roles: [role("re", "Escort", { sortOrder: 1 }), role("rs", "Scene", { sortOrder: 2 })],
      people: [person("p1", "Ann One"), person("p2", "Bob Two")],
      personRoles: [
        { personId: "p1", roleId: "re" },
        { personId: "p2", roleId: "rs" }, { personId: "p2", roleId: "re" }
      ],
      blocks: {
        current: {
          id: "b_current", startDate: "2026-09-21",
          shifts: ["Day", "Day", "Night", "Night"], stale: false,
          generatedAt: "2026-09-20T12:00:00.000Z", attendance: [],
          assignments: [
            { date: "2026-09-21", roleId: "re", personId: "p1", source: "generated" },
            { date: "2026-09-21", roleId: "rs", personId: "p2", source: "generated" }
          ],
          spareNotes: []
        },
        history: []
      }
    }));
    assert.equal(assignTo(0, "re", "p2"), false);
    const day = rosterDays()[0];
    assert.equal(day.assign.re, "p1");
    assert.equal(day.assign.rs, "p2");
  });

  it("clicking a parking chip (sel.kind role) does not open the old select modal", () => {
    load(baseDoc({
      roles: [role("re", "Escort")],
      people: [person("p1", "Ann One")],
      personRoles: [{ personId: "p1", roleId: "re" }]
    }));
    generate();
    S.ui.sel = { kind: "role", d: 0, r: "re" };
    assert.equal(vSelModal(), "");
    S.ui.sel = null;
  });
});
