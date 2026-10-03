/**
 * H66 — per-day headcount by attendance status (Attendance summary + Roster tally row).
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubLocalStorage, baseDoc } from "./helpers.js";

stubLocalStorage();

const { S } = await import("../src/js/state.js");
const { migrateToV2, setStatus, statusCountsForDay } = await import("../src/js/model.js");

const person = (id, active = true) => ({ id, name: id.toUpperCase(), active, fixedRoleId: null });
const counts = (d) => Object.fromEntries(statusCountsForDay(d).map((x) => [x.label, x.n]));

function load(people) {
  S.data = migrateToV2(baseDoc({ people }));
  S.dirty = false;
}

beforeEach(() => localStorage.clear());

describe("H66 statusCountsForDay", () => {
  it("counts everyone as Present when no attendance is set", () => {
    load([person("a"), person("b"), person("c")]);
    assert.deepEqual(counts(0), { "Present": 3, "Annual leave": 0, "Sick leave": 0, "Paternity leave": 0, "Duty away": 0, "Rest day": 0 });
  });

  it("splits non-present people by status for that day only", () => {
    load([person("a"), person("b"), person("c"), person("d")]);
    setStatus("a", 1, "Sick leave");
    setStatus("b", 1, "Annual leave");
    setStatus("c", 1, "Annual leave");
    assert.deepEqual(counts(1), { "Present": 1, "Annual leave": 2, "Sick leave": 1, "Paternity leave": 0, "Duty away": 0, "Rest day": 0 });
    assert.equal(counts(0)["Present"], 4, "other days are unaffected");
  });

  it("ignores inactive people and keeps the Attendance status order", () => {
    load([person("a"), person("x", false)]);
    setStatus("x", 0, "Duty away");
    assert.equal(counts(0)["Duty away"], 0);
    assert.deepEqual(statusCountsForDay(0).map((x) => x.label), ["Present", "Annual leave", "Sick leave", "Paternity leave", "Duty away", "Rest day"]);
  });
});
