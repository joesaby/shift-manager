/**
 * R8 — collapsible sidebar: auto-collapsed on Attendance/Roster, remembered per viewer,
 * safe when localStorage is unavailable.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubLocalStorage } from "./helpers.js";

stubLocalStorage();
/* shell() -> fileControls() feature-detects the File System Access API on window. */
globalThis.window = globalThis.window || {};

const { S } = await import("../src/js/state.js");
const { shell, navCollapsed, setNavCollapsed } = await import("../src/js/ui-kit.js");

const pinned = (html) => html.includes("lg:drawer-open");

beforeEach(() => {
  localStorage.clear();
  delete S.ui.navCollapsed;
  S.ui.screen = "start";
});

describe("sidebar collapse", () => {
  it("is pinned open on ordinary screens and auto-collapsed on Attendance and Roster", () => {
    S.ui.screen = "ppl";
    assert.equal(pinned(shell("x")), true);
    S.ui.screen = "att";
    assert.equal(pinned(shell("x")), false);
    S.ui.screen = "ros";
    assert.equal(pinned(shell("x")), false);
    S.ui.screen = "stats";
    assert.equal(pinned(shell("x")), false);
  });

  it("an explicit choice overrides the per-screen default and is remembered", () => {
    S.ui.screen = "ros";
    setNavCollapsed(false);
    assert.equal(pinned(shell("x")), true);
    delete S.ui.navCollapsed; /* simulate a reload */
    assert.equal(navCollapsed(), false);
    S.ui.screen = "ppl";
    setNavCollapsed(true);
    assert.equal(pinned(shell("x")), false);
  });

  it("still renders when localStorage throws", () => {
    const saved = globalThis.localStorage;
    globalThis.localStorage = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
    try {
      S.ui.screen = "ros";
      assert.equal(navCollapsed(), true);
      setNavCollapsed(false);
      assert.equal(pinned(shell("x")), true);
    } finally { globalThis.localStorage = saved; }
  });

  it("the hamburger is shown at every width when collapsed", () => {
    S.ui.screen = "ros";
    assert.ok(!/flex-none lg:hidden/.test(shell("x")));
    S.ui.screen = "ppl";
    assert.ok(/flex-none lg:hidden/.test(shell("x")));
  });

  it("Roster, Attendance, Historic, and Duty stats use the wide main; other screens keep the capped width", () => {
    S.ui.screen = "ros";
    assert.ok(shell("x").includes("main-wide"));
    S.ui.screen = "hist";
    assert.ok(shell("x").includes("main-wide"));
    S.ui.screen = "ppl";
    assert.ok(!shell("x").includes("main-wide"));
  });
});
