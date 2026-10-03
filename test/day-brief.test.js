/**
 * H61 day briefing print — Present+assigned only, sorted by role sortOrder.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubLocalStorage, baseDoc } from "./helpers.js";

stubLocalStorage();
globalThis.window = globalThis.window || {};

const { S } = await import("../src/js/state.js");
const { migrateToV2, setStatus, writeRoster, getStatus, isPresent, personById, statusCountsForDay, dutyAwayNote, setDutyAwayNote } = await import("../src/js/model.js");
const { buildDayBrief, dayBriefHTML, buildSnapshot } = await import("../src/js/snapshot.js");

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

describe("H61 briefing sheet away list", () => {
  it("lists leave / sick / rest / duty away people after the assigned rows", () => {
    load(baseDoc({
      roles: [role("r1", "Beat 1", 1)],
      people: [person("p1", "Ann One"), person("p2", "Al Leave"), person("p3", "Bo Sick"), person("p4", "Cy Rest"), person("p5", "Di Away")],
      personRoles: [{ personId: "p1", roleId: "r1" }]
    }));
    writeRoster([{ assign: { r1: "p1" } }, { assign: {} }, { assign: {} }, { assign: {} }]);
    setStatus("p4", 0, "Rest day");
    setStatus("p5", 0, "Duty away");
    setStatus("p3", 0, "Sick leave");
    setStatus("p2", 0, "Annual leave");
    const brief = buildDayBrief(0);
    assert.equal(brief.rows.length, 1);
    assert.deepEqual(brief.away.map((a) => [a.personName, a.status]), [
      ["Al Leave", "Annual leave"], ["Bo Sick", "Sick leave"], ["Cy Rest", "Rest day"], ["Di Away", "Duty away"]
    ]);
    const html = dayBriefHTML(brief);
    assert.ok(html.indexOf("Ann One") < html.indexOf("Al Leave"));
    assert.ok(html.indexOf("Al Leave") < html.indexOf("Di Away"));
    assert.match(html, /Sick leave/);
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
    assert.match(html, /Briefing sheet: /);
    assert.doesNotMatch(html, /Duty brief/);
    assert.match(html, /Beat 1/);
    assert.match(html, /Ann One/);
    assert.match(html, /111/);
    assert.match(html, /22/);
    assert.match(html, /Employee no\./);
    assert.match(html, /Shoulder no\./);
  });
});

describe("H72 briefing sheet order", () => {
  it("follows the Roles and groups list (essential first, then list order), not the group order", () => {
    load(baseDoc({
      groups: [
        { id: "g_car", name: "Car", color: "#F8BBD0", sortOrder: 1 },
        { id: "g_beat", name: "Beat", color: "#C8E6C9", sortOrder: 2 }
      ],
      roles: [
        { ...role("r_obs", "Car Observer", 3, "g_car") },
        { ...role("r_opt", "Optional Desk", 1, "g_beat"), essential: false },
        { ...role("r_beat1", "Beat 1", 2, "g_beat") },
        { ...role("r_car", "Car Driver", 1, "g_car") }
      ],
      people: [person("p1", "Aoife"), person("p2", "Kieran"), person("p3", "Fionn"), person("p4", "Grania")],
      personRoles: [
        { personId: "p1", roleId: "r_beat1" }, { personId: "p2", roleId: "r_opt" },
        { personId: "p3", roleId: "r_car" }, { personId: "p4", roleId: "r_obs" }
      ]
    }));
    writeRoster([
      { assign: { r_beat1: "p1", r_opt: "p2", r_car: "p3", r_obs: "p4" } },
      { assign: {} }, { assign: {} }, { assign: {} }
    ]);
    // Roles screen order: Car Driver (1), Beat 1 (2), Car Observer (3), then non-essential Optional Desk.
    assert.deepEqual(buildDayBrief(0).rows.map((r) => r.roleName), ["Car Driver", "Beat 1", "Car Observer", "Optional Desk"]);
  });
});

describe("Paternity leave and Duty away description", () => {
  const setup = () => {
    load(baseDoc({
      roles: [role("r1", "Beat 1", 1)],
      people: [person("p1", "Ann One"), person("p2", "Pat Dad"), person("p3", "Di Away")],
      personRoles: [{ personId: "p1", roleId: "r1" }]
    }));
    writeRoster([{ assign: { r1: "p1" } }, { assign: {} }, { assign: {} }, { assign: {} }]);
  };

  it("Paternity leave is a status: not Present, counted, listed on the briefing sheet", () => {
    setup();
    setStatus("p2", 0, "Paternity leave");
    assert.equal(getStatus("p2", 0), "Paternity leave");
    assert.equal(isPresent(personById("p2"), 0), false);
    assert.equal(statusCountsForDay(0).find((x) => x.label === "Paternity leave").n, 1);
    assert.deepEqual(buildDayBrief(0).away.map((a) => [a.personName, a.status]), [["Pat Dad", "Paternity leave"]]);
  });

  it("Duty away keeps its typed description but still counts as Duty away", () => {
    setup();
    setStatus("p3", 0, "Duty away");
    setDutyAwayNote("p3", 0, "  Court – Dublin  ");
    assert.equal(dutyAwayNote("p3", 0), "Court – Dublin");
    assert.equal(getStatus("p3", 0), "Duty away");
    assert.equal(statusCountsForDay(0).find((x) => x.label === "Duty away").n, 1);
    const cell = buildSnapshot().cells[2][0];
    assert.equal(cell.text, "Court – Dublin");
    const brief = buildDayBrief(0);
    assert.equal(brief.away[0].status, "Duty away");
    assert.match(dayBriefHTML(brief), /Court – Dublin/);
  });

  it("changing the status away from Duty away drops the description", () => {
    setup();
    setStatus("p3", 0, "Duty away");
    setDutyAwayNote("p3", 0, "Course");
    setStatus("p3", 0, "Rest day");
    assert.equal(dutyAwayNote("p3", 0), "");
    setStatus("p3", 0, "Duty away");
    assert.equal(dutyAwayNote("p3", 0), "");
    assert.equal(buildSnapshot().cells[2][0].text, "Duty away");
  });
});
