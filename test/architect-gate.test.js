import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  isPrCreateCommand,
  looksLikeFeatureOrBug,
  ARCHITECT_PATH_RE,
  TDD_VERIFY_PATH_RE,
  PR_INTENT_RE,
  TRIVIAL_RE,
} from '../scripts/hooks/architect-gate.mjs';

test('isPrCreateCommand detects gh pr create', () => {
  assert.equal(isPrCreateCommand('gh pr create --title "x" --body "y"'), true);
  assert.equal(
    isPrCreateCommand('gh pr create --title "t" --body "$(cat <<\'EOF\'\nHi\nEOF\n)"'),
    true,
  );
  assert.equal(isPrCreateCommand('git push -u origin HEAD'), false);
  assert.equal(isPrCreateCommand('npm test'), false);
  assert.equal(isPrCreateCommand('gh pr view 4'), false);
});

test('looksLikeFeatureOrBug vs trivial', () => {
  assert.equal(looksLikeFeatureOrBug('add parking lot drag'), true);
  assert.equal(looksLikeFeatureOrBug('trivial: true fix typo'), false);
  assert.equal(looksLikeFeatureOrBug('tdd-verify not needed docs only'), false);
  assert.equal(TRIVIAL_RE.test('tdd-verify not needed'), true);
});

test('skill path regexes', () => {
  assert.ok(ARCHITECT_PATH_RE.test('.agents/skills/architect/SKILL.md'));
  assert.ok(TDD_VERIFY_PATH_RE.test('.cursor/skills/tdd-verify/SKILL.md'));
  assert.equal(TDD_VERIFY_PATH_RE.test('.agents/skills/architect/SKILL.md'), false);
});

test('PR intent regex', () => {
  assert.ok(PR_INTENT_RE.test('please create a PR'));
  assert.ok(PR_INTENT_RE.test('open pull request'));
  assert.ok(PR_INTENT_RE.test('run gh pr create'));
  assert.equal(PR_INTENT_RE.test('just commit locally'), false);
});

test('pre-pr Shell blocks gh pr create until tdd-verify for feature sessions', () => {
  const key = 'gate-test-' + process.pid;
  const stateDir = join(tmpdir(), 'shift-manager-architect');
  mkdirSync(stateDir, { recursive: true });
  const stateFile = join(stateDir, key + '.json');
  writeFileSync(
    stateFile,
    JSON.stringify({
      needModeA: false,
      modeADone: true,
      tddVerifyDone: false,
      lastFeaturePrompt: 'add roster feature',
      modeBNudgeCount: 0,
    }),
  );
  const env = { ...process.env };
  delete env.CLAUDE_SESSION_ID;
  delete env.CURSOR_CONVERSATION_ID;
  const deny = spawnSync('node', ['scripts/hooks/architect-gate.mjs', 'pre-pr'], {
    input: JSON.stringify({
      session_id: key,
      tool_name: 'Shell',
      tool_input: { command: 'gh pr create --title x --body y' },
    }),
    encoding: 'utf8',
    env,
  });
  assert.equal(deny.status, 0);
  const denied = JSON.parse(deny.stdout);
  assert.equal(denied.permission, 'deny');
  assert.match(denied.reason || '', /tdd-verify/);

  writeFileSync(
    stateFile,
    JSON.stringify({
      needModeA: false,
      modeADone: true,
      tddVerifyDone: true,
      lastFeaturePrompt: 'add roster feature',
      modeBNudgeCount: 0,
    }),
  );
  const allow = spawnSync('node', ['scripts/hooks/architect-gate.mjs', 'pre-pr'], {
    input: JSON.stringify({
      session_id: key,
      tool_name: 'Shell',
      tool_input: { command: 'gh pr create --title x --body y' },
    }),
    encoding: 'utf8',
    env,
  });
  assert.equal(allow.status, 0);
  assert.equal(JSON.parse(allow.stdout).permission, 'allow');
  try { unlinkSync(stateFile); } catch { /* ignore */ }
});
