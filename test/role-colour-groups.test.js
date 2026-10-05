/**
 * Role colours (H20), group once-per-block (H70), probationer groups (H75).
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubLocalStorage, baseDoc } from "./helpers.js";

stubLocalStorage();

const { S } = await import("../src/js/state.js");
const { migrateToV2, rosterDays, roleById, personById, roleColor } = await import("../src/js/model.js");
const { generate } = await import("../src/js/generator.js");
const { RULES } = await import("../src/js/rules.js");

const role = (id, groupId, o = {}) => ({ id, name: id, groupId, usedAtDay: true, usedAtNight: true, hard: false, skillRestricted: false, essential: true, sortOrder: 1, ...o });
const person = (id, o = {}) => ({ id, name: id, active: true, fixedRoleId: null, ...o });
function load(doc) {
  S.data = migrateToV2(baseDoc(doc));
  S.dirty = false;
}
const withQuals = (roles, people) => ({ roles, people, personRoles: people.flatMap((p) => roles.map((r) => ({ personId: p.id, roleId: r.id }))) });

beforeEach(() => localStorage.clear());

describe("H20 colours live on roles", () => {
  it("migrates an old group colour onto its roles and removes it from the group", () => {
    load({
      groups: [{ id: "g1", name: "Car", color: "#F8BBD0", sortOrder: 1 }, { id: "g2", name: "Beat", color: "#C8E6C9", sortOrder: 2 }],
      roles: [role("a", "g1"), role("b", "g2"), role("c", "g2", { color: "#112233" })], people: [], personRoles: []
    });
    assert.equal(roleById("a").color, "#F8BBD0");
    assert.equal(roleById("b").color, "#C8E6C9");
    assert.equal(roleById("c").color, "#112233");
    assert.ok(S.data.groups.every((g) => g.color === undefined));
    assert.equal(roleColor("a"), "#F8BBD0");
  });
});

describe("H70 once per block on a group", () => {
  it("a group ticked once-per-block gives nobody two days in that group", () => {
    for (let t = 0; t < 20; t++) {
      const roles = [role("f1", "g1"), role("f2", "g1"), role("x", "g2")];
      const people = ["p1", "p2", "p3", "p4"].map((id) => person(id));
      load({ groups: [{ id: "g1", name: "Files", oncePerBlock: true, sortOrder: 1 }, { id: "g2", name: "Other", sortOrder: 2 }], ...withQuals(roles, people) });
      generate();
      const days = {};
      rosterDays().forEach((day) => Object.keys(day.assign).forEach((rid) => {
        const pid = day.assign[rid];
        if (pid && roleById(rid).groupId === "g1") days[pid] = (days[pid] || 0) + 1;
      }));
      Object.values(days).forEach((n) => assert.ok(n <= 1, "someone had two days in a once-per-block group"));
    }
  });

  it("migrates: a group whose roles had Once per block gets the group tick", () => {
    load({ groups: [{ id: "g1", name: "A", sortOrder: 1 }, { id: "g2", name: "B", sortOrder: 2 }], roles: [role("a", "g1", { oncePerBlock: true }), role("b", "g2")], people: [], personRoles: [] });
    assert.equal(S.data.groups[0].oncePerBlock, true);
    assert.equal(S.data.groups[1].oncePerBlock, false);
  });

  it("role flag blocks the same role again; group flag blocks any role in the group", () => {
    const r = RULES.find((x) => x.key === "oncePerBlock");
    assert.equal(r.breaks({ role: { oncePerBlock: true }, usedRole: true }), true);
    assert.equal(r.breaks({ role: { oncePerBlock: true }, usedRole: false, usedGroup: true }), false);
    assert.equal(r.breaks({ role: {}, usedRole: true }), false);
    assert.equal(r.breaks({ role: {}, usedGroup: true, groupOnce: true }), true);
  });
});

describe("H75 probationer groups", () => {
  const clash = () => {
    const bad = [];
    rosterDays().forEach((day) => {
      const n = {};
      Object.keys(day.assign).forEach((rid) => {
        const pid = day.assign[rid]; const pg = roleById(rid).probGroupId;
        if (pid && pg && personById(pid).probationer) n[pg] = (n[pg] || 0) + 1;
      });
      Object.values(n).forEach((c) => { if (c > 1) bad.push(c); });
    });
    return bad.length;
  };

  it("keeps probationers apart only inside probationer groups", () => {
    for (let t = 0; t < 30; t++) {
      const roles = [role("c1", "g1", { probGroupId: "pg1" }), role("c2", "g1", { probGroupId: "pg1" }), role("b1", "g2"), role("b2", "g2")];
      const people = [person("p1", { probationer: true }), person("p2", { probationer: true }), person("n1"), person("n2")];
      load({ groups: [{ id: "g1", name: "Car", sortOrder: 1 }, { id: "g2", name: "Beat", sortOrder: 2 }], probationerGroups: [{ id: "pg1", name: "Cars", sortOrder: 1 }], ...withQuals(roles, people) });
      generate();
      assert.equal(clash(), 0);
    }
  });

  it("with no probationer groups the rule does nothing (probationers may share a group)", () => {
    const roles = [role("c1", "g1"), role("c2", "g1")];
    const people = [person("p1", { probationer: true }), person("p2", { probationer: true })];
    load({ groups: [{ id: "g1", name: "Car", sortOrder: 1 }], probationerGroups: [], ...withQuals(roles, people) });
    generate();
    rosterDays().forEach((day) => assert.ok(day.assign.c1 && day.assign.c2));
  });

  it("migrates old files: each group with roles becomes a probationer group when a Probationer exists", () => {
    load({
      groups: [{ id: "g1", name: "Car", sortOrder: 1 }, { id: "g2", name: "Empty", sortOrder: 2 }],
      roles: [role("a", "g1")], people: [person("p", { probationer: true })], personRoles: []
    });
    assert.equal(S.data.probationerGroups.length, 1);
    assert.equal(S.data.probationerGroups[0].name, "Car");
    assert.equal(roleById("a").probGroupId, S.data.probationerGroups[0].id);
  });

  it("migration without any Probationer creates none", () => {
    load({ groups: [{ id: "g1", name: "Car", sortOrder: 1 }], roles: [role("a", "g1")], people: [person("p")], personRoles: [] });
    assert.deepEqual(S.data.probationerGroups, []);
  });
});
