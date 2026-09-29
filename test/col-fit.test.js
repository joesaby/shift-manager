/**
 * H63 roster column fit: Name / Employee no. / Shoulder no. keep their content width,
 * the day columns share the remaining width equally (no stretch on the Name column).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const { columnPercents } = await import("../src/js/colfit.js");

const sum = (a) => a.reduce((x, y) => x + y, 0);

describe("H63 columnPercents", () => {
  it("keeps the name and number columns at their content width", () => {
    const { fixed } = columnPercents([120, 80, 60], 4, 1000);
    assert.deepEqual(fixed.map((w) => Math.round(w * 10) / 10), [12, 8, 6]);
  });

  it("gives every day column the same share of what is left", () => {
    const { fixed, days } = columnPercents([120, 80, 60], 4, 1000);
    assert.equal(days.length, 4);
    assert.ok(days.every((w) => Math.abs(w - days[0]) < 1e-9), "day columns are equal");
    assert.ok(Math.abs(sum(fixed) + sum(days) - 100) < 1e-9, "adds up to 100%");
  });

  it("does not let an over-wide name column crowd out the days", () => {
    const { fixed, days } = columnPercents([900, 80, 60], 4, 1000);
    assert.ok(fixed[0] <= 100 / 7 + 1e-9);
    assert.ok(days[0] > 0);
  });

  it("works without number columns (legacy snapshots)", () => {
    const { fixed, days } = columnPercents([150], 2, 1000);
    assert.equal(fixed.length, 1);
    assert.ok(Math.abs(sum(fixed) + sum(days) - 100) < 1e-9);
  });

  it("returns null when nothing was measured", () => {
    assert.equal(columnPercents([100], 0, 1000), null);
    assert.equal(columnPercents([100], 4, 0), null);
  });
});
