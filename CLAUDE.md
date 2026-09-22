# CLAUDE.md — Shift Manager

Instructions for Claude Code (and similar) working in this repo.

**Follow [AGENTS.md](AGENTS.md)** for architecture, commands, hard constraints, and release behaviour. This file adds working habits.

## Working guidelines

Bias toward caution over speed; for trivial typos, use judgment.

### Think before coding

- State assumptions. If unclear, ask.
- If several interpretations exist, present them — don’t pick silently.
- Push back when a simpler approach exists.

### Simplicity first

- Minimum code that solves the request. No speculative features or abstractions.
- No new dependencies unless truly required (runtime must stay a single offline HTML).

### Surgical changes

- Touch only what the task needs. Match existing style.
- Don’t “clean up” unrelated files. Mention dead code; don’t delete it unasked.
- Escape all user-facing strings with `esc()`.

### Verify

- After behaviour changes: `npm run build` must succeed.
- If persistence/schema changes: check migration in `model.js` and mention JSON impact.
- If security/network/third-party posture changes: update `SECURITY.md` / `docs/THIRD_PARTY.md`.

## Quick map

- Screens: `src/js/screens/` + wire-up in `src/js/main.js`
- Rules / schema: `src/js/model.js`, `src/js/generator.js`
- Print/log: `src/js/snapshot.js`
- Build: `build.mjs` → `dist/shift-manager.html` + zips

## Feature workflow

For non-trivial behaviour changes, use project skills in order:

1. **architect** (`.cursor/skills/architect/SKILL.md`, also under `.agents/skills/` and `.claude/skills/`) — PRD H-ids, constraints, doc sync  
2. **tdd** (same paths) — failing test mapped to H-ids, then implement  
3. **verify** (same paths) — build + PRD/security acceptance  

## Do not

- Add telemetry, CDNs, or server backends
- Break offline `file://` use
- Commit secrets or real unit rota data
- Skip `[skip release]` casually on `main` unless the user wants no GitHub Release
