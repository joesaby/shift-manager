/**
 * H70 / H71 — generator spread rules: once-per-block roles, no same-group role on consecutive days.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubLocalStorage, baseDoc } from "./helpers.js";

stubLocalStorage();

const { S } = await import("../src/js/state.js");
const { migrateToV2, rosterDays, roleOfPerson } = await import("../src/js/model.js");
const { generate } = await import("../src/js/generator.js");

function load(doc) { S.data = migrateToV2(doc); S.dirty = false; }

function role(id, name, groupId, opts = {}) {
  return {
    id, name, groupId, usedAtDay: true, usedAtNight: true,
    hard: false, skillRestricted: false, essential: true, sortOrder: 1, ...opts
  };
}

beforeEach(() => localStorage.clear());

describe("H70 once-per-block role", () => {
  it("nobody holds a once-per-block group more than one day in a block", () => {
    const people = ["a", "b", "c", "d", "e", "f"].map((id) => ({ id, name: id, active: true, fixedRoleId: null }));
    const roles = [
      role("esc", "Escort", "g1", { sortOrder: 1 }),
      role("f1", "Files 1", "g_files", { essential: false, sortOrder: 2, oncePerBlock: true }),
      role("f2", "Files 2", "g_files", { essential: false, sortOrder: 3, oncePerBlock: true }),
      role("b1", "Beat 1", "g_beat", { essential: false, sortOrder: 4 }),
      role("b2", "Beat 2", "g_beat", { essential: false, sortOrder: 5 }),
      role("b3", "Beat 3", "g_beat", { essential: false, sortOrder: 6 })
    ];
    for (let run = 0; run < 30; run++) {
      load(baseDoc({
        groups: [
          { id: "g1", name: "Car", color: "#F8BBD0", sortOrder: 1 },
          { id: "g_files", name: "Files", color: "#FFE0B2", sortOrder: 2 },
          { id: "g_beat", name: "Beat", color: "#C8E6C9", sortOrder: 3 }
        ],
        roles, people,
        personRoles: people.flatMap((p) => roles.map((r) => ({ personId: p.id, roleId: r.id })))
      }));
      generate();
      const days = rosterDays();
      people.forEach((p) => {
        const n = days.filter((day) => ["f1", "f2"].includes(roleOfPerson(day, p.id))).length;
        assert.ok(n <= 1, p.id + " did Files " + n + " days");
      });
    }
  });
});

describe("H71 no same-group role on consecutive days", () => {
  it("a person never gets two roles of one group back to back", () => {
    const people = ["a", "b", "c", "d", "e", "f"].map((id) => ({ id, name: id, active: true, fixedRoleId: null }));
    const roles = [
      role("c1", "Car 1", "g1", { sortOrder: 1 }),
      role("c2", "Car 2", "g1", { sortOrder: 2 }),
      role("b1", "Beat 1", "g2", { sortOrder: 3 }),
      role("b2", "Beat 2", "g2", { sortOrder: 4 }),
      role("i1", "Inside 1", "g3", { sortOrder: 5 }),
      role("i2", "Inside 2", "g3", { sortOrder: 6 })
    ];
    for (let run = 0; run < 30; run++) {
      load(baseDoc({
        groups: [
          { id: "g1", name: "Car", color: "#F8BBD0", sortOrder: 1 },
          { id: "g2", name: "Beat", color: "#C8E6C9", sortOrder: 2 },
          { id: "g3", name: "Inside", color: "#FFE0B2", sortOrder: 3 }
        ],
        roles, people,
        personRoles: people.flatMap((p) => roles.map((r) => ({ personId: p.id, roleId: r.id })))
      }));
      generate();
      const days = rosterDays();
      const grp = (d, pid) => { const r = roleOfPerson(days[d], pid); return r ? roles.find((x) => x.id === r).groupId : null; };
      people.forEach((p) => {
        for (let d = 1; d < 4; d++) {
          const g = grp(d, p.id);
          assert.ok(!g || g !== grp(d - 1, p.id), p.id + " repeated group " + g + " on day " + d);
        }
      });
    }
  });
});
