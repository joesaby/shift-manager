/**
 * H67 — long-term sick: a dated period on the person makes every day in it default to Sick leave.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubLocalStorage, baseDoc } from "./helpers.js";

stubLocalStorage();

const { S } = await import("../src/js/state.js");
const { migrateToV2, getStatus, setStatus, dayLabels, statusCountsForDay, setLongTermSick, clearLongTermSick, personById } = await import("../src/js/model.js");

const person = (id) => ({ id, name: id.toUpperCase(), active: true, fixedRoleId: null });
const iso = (d) => dayLabels()[d].iso;
const week = () => [0, 1, 2, 3].map((d) => getStatus("a", d));

function load() {
  S.data = migrateToV2(baseDoc({ people: [person("a"), person("b")] }));
  S.dirty = false;
}

beforeEach(() => { localStorage.clear(); load(); });

describe("H67 long-term sick", () => {
  it("makes every day from the start date Sick leave when there is no end date", () => {
    assert.equal(setLongTermSick("a", iso(0), ""), true);
    assert.deepEqual(week(), ["Sick leave", "Sick leave", "Sick leave", "Sick leave"]);
    assert.equal(getStatus("b", 0), "Present", "other people unaffected");
  });

  it("honours both the start and the end date (inclusive)", () => {
    setLongTermSick("a", iso(1), iso(2));
    assert.deepEqual(week(), ["Present", "Sick leave", "Sick leave", "Present"]);
  });

  it("lets a day set by hand on Attendance win over the period, that day only", () => {
    setLongTermSick("a", iso(0), "");
    setStatus("a", 1, "Present");
    assert.deepEqual(week(), ["Sick leave", "Present", "Sick leave", "Sick leave"]);
    setStatus("a", 2, "Annual leave");
    assert.equal(getStatus("a", 2), "Annual leave");
  });

  it("counts the sick days in the per-day status tally", () => {
    setLongTermSick("a", iso(0), "");
    assert.equal(statusCountsForDay(0).find((x) => x.label === "Sick leave").n, 1);
    assert.equal(statusCountsForDay(0).find((x) => x.label === "Present").n, 1);
  });

  it("clearing the period puts everyone back to Present", () => {
    setLongTermSick("a", iso(0), "");
    clearLongTermSick("a");
    assert.deepEqual(week(), ["Present", "Present", "Present", "Present"]);
    assert.equal(personById("a").longTermSick, undefined);
  });

  it("rejects an end date before the start date and a missing start date", () => {
    assert.equal(setLongTermSick("a", iso(2), iso(1)), false);
    assert.equal(setLongTermSick("a", "", ""), false);
    assert.equal(personById("a").longTermSick, undefined);
  });

  it("still removes an ordinary Present row when no period covers the day", () => {
    setStatus("b", 0, "Sick leave");
    setStatus("b", 0, "Present");
    assert.equal(S.data.blocks.current.attendance.length, 0);
  });
});
