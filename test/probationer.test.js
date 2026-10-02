/**
 * H75 — two Probationers are not put in the same role group on the same day when another arrangement exists.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubLocalStorage, baseDoc } from "./helpers.js";

stubLocalStorage();

const { S } = await import("../src/js/state.js");
const { migrateToV2, rosterDays, roleById, personById } = await import("../src/js/model.js");
const { generate } = await import("../src/js/generator.js");

const role = (id, groupId, o = {}) => ({ id, name: id, groupId, usedAtDay: true, usedAtNight: true, hard: false, skillRestricted: false, essential: true, sortOrder: 1, ...o });
const GROUPS = [{ id: "g1", name: "Car", color: "#F8BBD0", sortOrder: 1 }, { id: "g2", name: "Beat", color: "#C8E6C9", sortOrder: 2 }];

function load(roles, people) {
  S.data = migrateToV2(baseDoc({
    groups: GROUPS, roles, people,
    personRoles: people.flatMap((p) => roles.map((r) => ({ personId: p.id, roleId: r.id })))
  }));
  S.dirty = false;
}
const person = (id, o = {}) => ({ id, name: id, active: true, fixedRoleId: null, ...o });

beforeEach(() => localStorage.clear());

describe("H75 Probationer", () => {
  it("keeps two Probationers out of the same group every day", () => {
    for (let t = 0; t < 40; t++) {
      load(
        [role("c1", "g1"), role("c2", "g1"), role("b1", "g2"), role("b2", "g2")],
        [person("p1", { probationer: true }), person("p2", { probationer: true }), person("n1"), person("n2")]
      );
      generate();
      rosterDays().forEach((day) => {
        const inGroup = {};
        Object.keys(day.assign).forEach((rid) => {
          const pid = day.assign[rid];
          if (pid && personById(pid).probationer) inGroup[roleById(rid).groupId] = (inGroup[roleById(rid).groupId] || 0) + 1;
        });
        Object.values(inGroup).forEach((n) => assert.ok(n <= 1, "two Probationers in one group"));
      });
    }
  });

  it("gives way when there is no other arrangement (roles still filled)", () => {
    load([role("c1", "g1"), role("c2", "g1")], [person("p1", { probationer: true }), person("p2", { probationer: true })]);
    generate();
    rosterDays().forEach((day) => { assert.ok(day.assign.c1 && day.assign.c2); });
  });
});
