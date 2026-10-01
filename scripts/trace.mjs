#!/usr/bin/env node
/**
 * Derived requirement graph: for an H-id, show its PRD story, Spec entry, the ids it mentions and
 * the ids that mention it, the src/ and test/ files that cite it, and its Deprecated history.
 * Nothing is stored — everything is read from the docs and code each run. Usage: npm run docs:trace H47
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ID = /\bH\d+\b/g;
const ids = (s) => [...new Set(s.match(ID) || [])];

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|mjs|css|html)$/.test(n)) out.push(p);
  }
  return out;
}

export function buildIndex(root) {
  const read = (f) => readFileSync(join(root, f), "utf8");
  const stories = {};
  for (const l of read("docs/Shift_Manager_PRD.md").split("\n")) {
    const c = l.split("|").map((x) => x.trim());
    if (!/^H\d+$/.test(c[1] || "")) continue;
    const retired = /\*Retired/.test(l);
    stories[c[1]] = { priority: retired ? "" : c[2], story: c[3], spec: retired ? "" : c[4], retired, text: l };
  }
  const specOf = {}; const specText = {};
  let cur = "";
  for (const l of read("docs/Shift_Manager_Spec.md").split("\n")) {
    const h = l.match(/^### (S\d+) /);
    if (h) { cur = h[1]; continue; }
    const m = l.match(/^\*\*(H\d+)\*\* — /);
    if (m && cur) { specOf[m[1]] = cur; specText[m[1]] = l; }
  }
  const dep = {};
  for (const l of read("docs/PRD_Deprecated.md").split("\n")) {
    const m = l.match(/^\| \*\*(H\d+)\b/);
    if (m) { const c = l.split("|").map((x) => x.trim()); dep[m[1]] = { text: l, replacedBy: ids(c[3] || "").filter((i) => i !== m[1]) }; }
  }
  const files = [...walk(join(root, "src")), ...walk(join(root, "test"))].filter((f) => !/test\/(trace|prd-spec)\.test\.js$/.test(f));
  const code = {}; const tests = {};
  for (const f of files) {
    const rel = relative(root, f);
    for (const i of ids(readFileSync(f, "utf8"))) ((rel.startsWith("test") ? tests : code)[i] ||= []).push(rel);
  }
  const known = new Set([...Object.keys(stories), ...Object.keys(dep)]);
  const dangling = [...new Set([...Object.keys(code), ...Object.keys(tests)])].filter((i) => !known.has(i)).sort();
  return { stories, specOf, specText, dep, code, tests, dangling };
}

export function trace(idx, id) {
  const s = idx.stories[id]; const d = idx.dep[id];
  if (!s && !d) return null;
  const own = (s ? s.text + " " + (idx.specText[id] || "") : "") + (d ? d.text : "");
  const mentions = ids(own).filter((i) => i !== id);
  const mentionedBy = Object.keys({ ...idx.stories, ...idx.dep })
    .filter((o) => o !== id && ids((idx.stories[o]?.text || "") + " " + (idx.specText[o] || "") + " " + (idx.dep[o]?.text || "")).includes(id));
  return {
    id, retired: !!(s?.retired || (d && !(s && !s.retired))),
    priority: s?.priority || "", story: s?.story || "", spec: s?.spec || idx.specOf[id] || "",
    mentions, mentionedBy, code: idx.code[id] || [], tests: idx.tests[id] || [],
    replacedBy: d?.replacedBy || [],
  };
}

export function formatTrace(t) {
  const list = (a) => (a.length ? a.join(", ") : "—");
  return [
    `${t.id}${t.retired ? " (retired)" : ""}${t.priority ? " · " + t.priority : ""}`,
    t.story && `  ${t.story}`,
    t.spec && `Spec: ${t.spec}  (docs/Shift_Manager_Spec.md)`,
    `Mentions: ${list(t.mentions)}`,
    `Mentioned by: ${list(t.mentionedBy)}`,
    t.replacedBy.length && `Replaced by: ${list(t.replacedBy)}`,
    `Code: ${list(t.code)}`,
    `Tests: ${list(t.tests)}`,
  ].filter(Boolean).join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const idx = buildIndex(join(dirname(fileURLToPath(import.meta.url)), ".."));
  const args = process.argv.slice(2).map((a) => a.toUpperCase());
  if (!args.length) { console.error("Usage: npm run docs:trace H47 [H48 …]"); process.exit(2); }
  for (const a of args) {
    const t = trace(idx, a);
    console.log(t ? formatTrace(t) : `${a}: not in the PRD or PRD_Deprecated`);
    console.log();
  }
  if (idx.dangling.length) console.log("Cited in src/ or test/ but not in the PRD / Deprecated: " + idx.dangling.join(", "));
}
