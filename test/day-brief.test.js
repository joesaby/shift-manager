/**
 * H61 day briefing print — Present+assigned only, sorted by role sortOrder.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubLocalStorage, baseDoc } from "./helpers.js";

stubLocalStorage();
globalThis.window = globalThis.window || {};

const { S } = await import("../src/js/state.js");
const { migrateToV2, setStatus, writeRoster } = await import("../src/js/model.js");
const { buildDayBrief, dayBriefHTML } = await import("../src/js/snapshot.js");

function load(doc) {
  S.data = migrateToV2(doc);
  S.dirty = false;
}

function role(id, name, sortOrder, groupId = "g1") {
  return {
    id, name, groupId,
    usedAtDay: true, usedAtNight: true,
    hard: false, skillRestricted: false, essential: true, sortOrder
  };
}

function person(id, name, nums = {}) {
  return {
    id, name, active: true, fixedRoleId: null,
    employeeNo: nums.employeeNo || "",
    shoulderNo: nums.shoulderNo || ""
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("H59 buildDayBrief", () => {
  it("lists Present+assigned only, sorted by role sortOrder", () => {
    load(baseDoc({
      groups: [
        { id: "g_car", name: "Car", color: "#F8BBD0", sortOrder: 1 },
        { id: "g_beat", name: "Beat", color: "#C8E6C9", sortOrder: 2 }
      ],
      roles: [
        role("r_beat3", "Beat 3", 5, "g_beat"),
        role("r_beat1", "Beat 1", 3, "g_beat"),
        role("r_car", "Car 1 Driver", 1, "g_car"),
        role("r_obs", "Car 1 Observer", 2, "g_car")
      ],
      people: [
        person("p_aoife", "Aoife Murphy", { employeeNo: "00112233", shoulderNo: "1234" }),
        person("p_kieran", "Kieran Byrne", { employeeNo: "99887766", shoulderNo: "5678" }),
        person("p_fionn", "Fionn Daly"),
        person("p_grania", "Grania Walsh"),
        person("p_sick", "Sick Sam"),
        person("p_spare", "Spare Sue")
      ],
      personRoles: [
        { personId: "p_aoife", roleId: "r_beat1" },
        { personId: "p_kieran", roleId: "r_beat3" },
        { personId: "p_fionn", roleId: "r_car" },
        { personId: "p_grania", roleId: "r_obs" },
        { personId: "p_sick", roleId: "r_beat1" },
        { personId: "p_spare", roleId: "r_beat1" }
      ]
    }));

    /* Person order deliberately not role order; Beat 3 before Beat 1 in people list. */
    writeRoster([
      {
        assign: {
          r_beat3: "p_kieran",
          r_beat1: "p_aoife",
          r_car: "p_fionn",
          r_obs: "p_grania"
        }
      },
      { assign: {} },
      { assign: {} },
      { assign: {} }
    ]);
    setStatus("p_sick", 0, "Sick leave");
    /* p_spare stays Present with no assignment */

    const brief = buildDayBrief(0);
    assert.equal(brief.rows.length, 4);
    assert.deepEqual(brief.rows.map((r) => r.roleName), [
      "Car 1 Driver", "Car 1 Observer", "Beat 1", "Beat 3"
    ]);
    assert.deepEqual(brief.rows.map((r) => r.personName), [
      "Fionn Daly", "Grania Walsh", "Aoife Murphy", "Kieran Byrne"
    ]);
    assert.equal(brief.rows[2].employeeNo, "00112233");
    assert.equal(brief.rows[2].shoulderNo, "1234");
    assert.equal(brief.rows[0].color, "#F8BBD0");
    assert.equal(brief.rows[2].color, "#C8E6C9");
    assert.ok(!brief.rows.some((r) => r.personName === "Sick Sam"));
    assert.ok(!brief.rows.some((r) => r.personName === "Spare Sue"));
  });

  it("returns empty rows when nobody Present+assigned", () => {
    load(baseDoc({
      roles: [role("r1", "Escort", 1)],
      people: [person("p1", "Alone")],
      personRoles: [{ personId: "p1", roleId: "r1" }]
    }));
    writeRoster([{ assign: {} }, { assign: {} }, { assign: {} }, { assign: {} }]);
    setStatus("p1", 0, "Annual leave");
    const brief = buildDayBrief(0);
    assert.equal(brief.rows.length, 0);
  });
});

describe("H59 dayBriefHTML", () => {
  it("renders Role / Name / numbers and duty brief title", () => {
    load(baseDoc({
      roles: [role("r1", "Beat 1", 1)],
      people: [person("p1", "Ann One", { employeeNo: "111", shoulderNo: "22" })],
      personRoles: [{ personId: "p1", roleId: "r1" }]
    }));
    writeRoster([
      { assign: { r1: "p1" } },
      { assign: {} },
      { assign: {} },
      { assign: {} }
    ]);
    const html = dayBriefHTML(buildDayBrief(0));
    assert.match(html, /id="printArea"/);
    assert.match(html, /Duty brief:/);
    assert.match(html, /Beat 1/);
    assert.match(html, /Ann One/);
    assert.match(html, /111/);
    assert.match(html, /22/);
    assert.match(html, /Employee no\./);
    assert.match(html, /Shoulder no\./);
  });
});
