/**
 * H63 roster column fit: Name / Employee no. / Shoulder no. keep their content width in px
 * (the longest name never wraps), the day columns share the remaining width equally.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const { fixedColumnPx } = await import("../src/js/colfit.js");

describe("H63 fixedColumnPx", () => {
  it("keeps the name and number columns at least as wide as their content", () => {
    const px = fixedColumnPx([120, 80.4, 60.6]);
    assert.deepEqual(px, [122, 83, 63]);
  });

  it("widths are fixed pixels, so a narrower printed page cannot squeeze the longest name onto two lines", () => {
    const [name] = fixedColumnPx([187.3]);
    assert.ok(name >= 188, "rounded up with slack");
    assert.ok(Number.isInteger(name));
  });

  it("returns nothing for nothing (no fixed columns)", () => {
    assert.deepEqual(fixedColumnPx([]), []);
  });
});

const { revealDelta } = await import("../src/js/util.js");

describe("H64 revealDelta (keep the highlighted row visible under frozen header / footer)", () => {
  it("does nothing when the row is already inside the visible band", () => {
    assert.equal(revealDelta(200, 230, 100, 500), 0);
  });
  it("scrolls up when the row is hidden under the frozen header", () => {
    assert.equal(revealDelta(90, 120, 100, 500), -10);
  });
  it("scrolls down when the row is below the visible band (or under the footer)", () => {
    assert.equal(revealDelta(480, 530, 100, 500), 30);
  });
});

const { edgeScrollSpeed } = await import("../src/js/util.js");

describe("H36 edgeScrollSpeed (auto-scroll while dragging a cell)", () => {
  // visible band 100..500, 40px hot zone at each end, max 20px per tick
  it("is 0 in the middle of the table", () => {
    assert.equal(edgeScrollSpeed(300, 100, 500, 40, 20), 0);
  });
  it("scrolls up, faster the closer to (or beyond) the top edge", () => {
    const near = edgeScrollSpeed(130, 100, 500, 40, 20);
    const at = edgeScrollSpeed(100, 100, 500, 40, 20);
    assert.ok(near < 0 && at < near, "faster at the edge");
    assert.equal(edgeScrollSpeed(20, 100, 500, 40, 20), -20, "capped at max, e.g. over the frozen header");
  });
  it("scrolls down near the bottom edge, capped at max", () => {
    assert.ok(edgeScrollSpeed(480, 100, 500, 40, 20) > 0);
    assert.equal(edgeScrollSpeed(600, 100, 500, 40, 20), 20);
  });
});
