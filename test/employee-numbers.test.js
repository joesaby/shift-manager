/**
 * H53 — employeeNo / shoulderNo on people; snapshot carry; legacy render; unsaved flip.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubLocalStorage, baseDoc } from "./helpers.js";

stubLocalStorage();

const { S } = await import("../src/js/state.js");
const { migrateToV2, block } = await import("../src/js/model.js");
const { generate } = await import("../src/js/generator.js");
const { buildSnapshot, saveRoster, isRosterUnsaved, rotaHTML } = await import("../src/js/snapshot.js");

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

function person(id, name, extra = {}) {
  return { id, name, active: true, fixedRoleId: null, ...extra };
}

function miniDoc(peopleExtra = {}) {
  return baseDoc({
    roles: [role("re", "Escort")],
    people: [
      person("p1", "Joe Bloggs", peopleExtra.p1),
      person("p2", "Ann Example", peopleExtra.p2)
    ],
    personRoles: [
      { personId: "p1", roleId: "re" },
      { personId: "p2", roleId: "re" }
    ]
  });
}

beforeEach(() => {
  localStorage.clear();
});

describe("H53 normalize defaults", () => {
  it("files without employeeNo/shoulderNo open with empty strings", () => {
    const raw = baseDoc({
      roles: [role("re", "Escort")],
      people: [{ id: "p1", name: "Joe", active: true, fixedRoleId: null }],
      personRoles: [{ personId: "p1", roleId: "re" }]
    });
    assert.equal(raw.people[0].employeeNo, undefined);
    assert.equal(raw.people[0].shoulderNo, undefined);
    load(raw);
    assert.equal(S.data.people[0].employeeNo, "");
    assert.equal(S.data.people[0].shoulderNo, "");
  });

  it("preserves leading zeros as strings", () => {
    load(miniDoc({ p1: { employeeNo: "00012345", shoulderNo: "0001" } }));
    assert.equal(S.data.people[0].employeeNo, "00012345");
    assert.equal(S.data.people[0].shoulderNo, "0001");
  });
});

describe("H53 buildSnapshot carries numbers", () => {
  it("includes employeeNo and shoulderNo per person", () => {
    load(miniDoc({
      p1: { employeeNo: "00012345", shoulderNo: "0001" },
      p2: { employeeNo: "", shoulderNo: "0099" }
    }));
    generate();
    const snap = buildSnapshot();
    const byId = Object.fromEntries(snap.people.map((p) => [p.id, p]));
    assert.equal(byId.p1.employeeNo, "00012345");
    assert.equal(byId.p1.shoulderNo, "0001");
    assert.equal(byId.p2.employeeNo, "");
    assert.equal(byId.p2.shoulderNo, "0099");
  });
});

describe("H53 legacy snap render", () => {
  it("omits number columns when snap people lack employeeNo/shoulderNo", () => {
    load(miniDoc());
    generate();
    const snap = buildSnapshot();
    /* Simulate an old saved snap that never had the fields. */
    snap.people = snap.people.map(({ id, name }) => ({ id, name }));
    const html = rotaHTML(snap);
    assert.equal(html.includes("Employee"), false);
    assert.equal(html.includes("Shoulder"), false);
    assert.equal(html.includes("numcol"), false);
  });

  it("renders number columns when snap carries the fields", () => {
    load(miniDoc({ p1: { employeeNo: "00012345", shoulderNo: "0001" } }));
    generate();
    const html = rotaHTML(buildSnapshot());
    assert.ok(html.includes("Employee"));
    assert.ok(html.includes("Shoulder"));
    assert.ok(html.includes("00012345"));
    assert.ok(html.includes("0001"));
  });
});

describe("H51 / H53 unsaved includes numbers", () => {
  it("flips unsaved when employeeNo is edited after save", () => {
    load(miniDoc({ p1: { employeeNo: "00012345", shoulderNo: "0001" } }));
    generate();
    saveRoster();
    assert.equal(isRosterUnsaved(), false);
    S.data.people.find((p) => p.id === "p1").employeeNo = "00099999";
    assert.equal(isRosterUnsaved(), true);
    saveRoster();
    assert.equal(isRosterUnsaved(), false);
    S.data.people.find((p) => p.id === "p1").shoulderNo = "7777";
    assert.equal(isRosterUnsaved(), true);
  });
});
