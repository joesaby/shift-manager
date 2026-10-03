/**
 * H13 / H44 — when there are not enough people for every essential role, the roles lower in the
 * Roles list are left empty first (so e.g. the drivers listed first are always filled).
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubLocalStorage, baseDoc } from "./helpers.js";

stubLocalStorage();

const { S } = await import("../src/js/state.js");
const { migrateToV2, rosterDays } = await import("../src/js/model.js");
const { generate } = await import("../src/js/generator.js");

const role = (id, groupId, sortOrder, o = {}) => ({ id, name: id, groupId, usedAtDay: true, usedAtNight: true, hard: false, skillRestricted: false, essential: true, sortOrder, ...o });

beforeEach(() => localStorage.clear());

describe("essential roles compete for too few people", () => {
  it("fills the roles listed first and leaves the later once-per-block role empty", () => {
    for (let t = 0; t < 30; t++) {
      const roles = [
        role("van", "g1", 1), role("car", "g1", 2),
        role("x1", "g2", 3, { oncePerBlock: true }), role("x2", "g2", 4, { oncePerBlock: true })
      ];
      const quals = { d1: ["van", "car", "x1", "x2"], d2: ["van", "car", "x1", "x2"], o1: ["x1", "x2"] };
      S.data = migrateToV2(baseDoc({
        groups: [{ id: "g1", name: "Car", color: "#F8BBD0", sortOrder: 1 }, { id: "g2", name: "Skills", color: "#C8E6C9", sortOrder: 2 }],
        roles,
        people: Object.keys(quals).map((id) => ({ id, name: id, active: true, fixedRoleId: null })),
        personRoles: Object.keys(quals).flatMap((id) => quals[id].map((r) => ({ personId: id, roleId: r })))
      }));
      S.dirty = false;
      generate();
      rosterDays().forEach((day, d) => {
        assert.ok(day.assign.van, "van filled on day " + d);
        assert.ok(day.assign.car, "car filled on day " + d);
      });
    }
  });
});
