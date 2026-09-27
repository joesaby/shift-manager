#!/usr/bin/env node
/**
 * Shared architect gate for Cursor + Claude Code hooks.
 *
 * Modes (argv[2]):
 *   prompt    — feature/bug prompt → require Mode A; inject skill path
 *   session   — Cursor sessionStart: baseline workflow reminder
 *   post-read — mark Mode A/B satisfied when architect SKILL.md is read
 *   pre-write — block Write/Edit while Mode A is required but skill unread
 *   stop      — Mode B follow-up when behaviour files dirty without architect
 *
 * Session state lives under os.tmpdir()/shift-manager-architect/<session>.json
 * so leftover dirty trees in other chats are less likely to false-positive forever,
 * and Read of the skill is enforced before edits.
 */
import { execSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const mode = (process.argv[2] || process.env.HOOK_MODE || 'prompt').toLowerCase();
const ROOT =
  process.env.CLAUDE_PROJECT_DIR ||
  process.env.CURSOR_PROJECT_DIR ||
  join(dirname(fileURLToPath(import.meta.url)), '../..');

const ARCHITECT_REL = [
  '.agents/skills/architect/SKILL.md',
  '.cursor/skills/architect/SKILL.md',
  '.claude/skills/architect/SKILL.md',
];

const FEATURE_BUG_RE =
  /\b(features?|bugs?|bug\s*fix|bugfix|fix(?:es)?\s+(?:the\s+|a\s+|this\s+)?(?:bugs?|issue)|issues?|implement|improv(?:e|ing)|updat(?:e|ing)|mak(?:e|ing)|wire|add(?:ing)?|build(?:ing)?|creat(?:e|ing)|chang(?:e|ing)|refactor(?:ing)?|schema|migrat\w*|allocat\w*|generat(?:e|or|ion)|roster|parking|print\s+layout|persist\w*|workspace|security\s+(?:posture|change)|prd\s+h\d+|h\d{1,3}\b)\b/i;

const TRIVIAL_RE =
  /\b(typo|spelling|wording|copy\s+tweak|rename\s+label|one[- ]line\s+css|comment[- ]only|docs?\s+only|readme\s+only|trivial\s*:\s*true|architect\s+not\s+needed)\b/i;

const ARCHITECT_DONE_RE =
  /\b(design brief|##\s*design brief|mode\s*[ab]\b|architecture-fit|architect\s+skill|skills\/architect|\/architect|architecture-fit review)\b/i;

const ARCHITECT_PATH_RE = /skills\/architect\/SKILL\.md/;

const BEHAVIOUR_PATH_RE =
  /^(src\/js\/|src\/styles\/app\.css|docs\/Shift_Manager_PRD\.md|docs\/PRD_Deprecated\.md|SECURITY\.md|docs\/THIRD_PARTY\.md|README\.md|AGENTS\.md|CLAUDE\.md|build\.mjs)/;

const STATE_DIR = join(tmpdir(), 'shift-manager-architect');

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function parseInput(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    return {};
  }
}

function sessionKey(input) {
  return (
    input.session_id ||
    input.sessionId ||
    input.conversation_id ||
    input.conversationId ||
    process.env.CLAUDE_SESSION_ID ||
    process.env.CURSOR_CONVERSATION_ID ||
    'default'
  );
}

function statePath(key) {
  return join(STATE_DIR, `${String(key).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120)}.json`);
}

function loadState(key) {
  const p = statePath(key);
  if (!existsSync(p)) {
    return {
      needModeA: false,
      modeADone: false,
      modeBNudgeCount: 0,
      lastFeaturePrompt: '',
    };
  }
  try {
    return { ...JSON.parse(readFileSync(p, 'utf8')) };
  } catch {
    return {
      needModeA: false,
      modeADone: false,
      modeBNudgeCount: 0,
      lastFeaturePrompt: '',
    };
  }
}

function saveState(key, state) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(statePath(key), JSON.stringify(state, null, 2));
}

function looksLikeFeatureOrBug(text) {
  if (!text || TRIVIAL_RE.test(text)) return false;
  return FEATURE_BUG_RE.test(text);
}

function architectPathsLine() {
  return ARCHITECT_REL.map((p) => `\`${p}\``).join(' | ');
}

function modeAContext() {
  return [
    'Shift Manager workflow gate (Mode A): this looks like a feature or bug fix.',
    'Your FIRST tool call must be Read on the architect skill file before any Write/Edit.',
    `Use one of: ${architectPathsLine()}.`,
    'Produce a Mode A design brief (PRD H-ids, modules, approach, docs).',
    'Skip only for typos, copy tweaks, or one-line CSS with no product surface (say "trivial: true").',
    'Then: tdd → implement → verify. Mode B runs before you finish if behaviour files change.',
  ].join(' ');
}

function modeBContext() {
  return [
    'Shift Manager workflow gate (Mode B): behaviour-relevant files are dirty and no architect pass was detected.',
    `Read ${architectPathsLine()} and complete Mode B (architecture-fit checklist against the diff) now.`,
    'Then finish. If truly trivial, reply with "trivial: true" and stop.',
  ].join(' ');
}

function sessionContext() {
  return [
    'Shift Manager: for features/bug fixes, follow architect → tdd → implement → verify.',
    `Architect skill: ${architectPathsLine()}.`,
    'Hooks block edits until Mode A skill is read, and nudge Mode B on stop when behaviour files are dirty.',
  ].join(' ');
}

function emitJson(obj) {
  process.stdout.write(JSON.stringify(obj));
}

function toolPath(input) {
  const ti = input.tool_input || input.toolInput || input.input || input.arguments || {};
  return String(
    ti.path ||
      ti.file_path ||
      ti.filePath ||
      ti.target_file ||
      ti.targetFile ||
      '',
  );
}

function toolName(input) {
  return String(input.tool_name || input.toolName || input.tool || '');
}

function isWriteLike(input) {
  const name = toolName(input);
  if (/^(Write|Edit|MultiEdit|StrReplace|NotebookEdit|TabWrite)$/i.test(name)) return true;
  // Cursor generic preToolUse may use tool type
  if (/^(write|edit|streplace)$/i.test(String(input.tool_type || input.toolType || ''))) return true;
  return false;
}

function isReadLike(input) {
  const name = toolName(input);
  return /^(Read|TabRead)$/i.test(name);
}

function transcriptHasArchitect(input) {
  const path = input.transcript_path || input.transcriptPath;
  if (!path) return false;
  try {
    const text = readFileSync(path, 'utf8');
    return ARCHITECT_DONE_RE.test(text) || ARCHITECT_PATH_RE.test(text);
  } catch {
    return false;
  }
}

function behaviourFilesDirty() {
  try {
    const out = execSync('git status --porcelain', {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out
      .split('\n')
      .map((line) => {
        const raw = line.slice(3).trim();
        // handle renames: "old -> new"
        if (raw.includes(' -> ')) return raw.split(' -> ').pop().trim();
        return raw;
      })
      .some((file) => file && BEHAVIOUR_PATH_RE.test(file));
  } catch {
    return false;
  }
}

function emitPromptGate(input) {
  const key = sessionKey(input);
  const state = loadState(key);
  const prompt = String(input.prompt || input.text || '');

  if (!looksLikeFeatureOrBug(prompt)) {
    emitJson({ continue: true });
    return;
  }

  state.needModeA = true;
  state.modeADone = false;
  state.lastFeaturePrompt = prompt.slice(0, 500);
  saveState(key, state);

  const ctx = modeAContext();
  emitJson({
    continue: true,
    additional_context: ctx,
    agent_message: ctx,
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: ctx,
    },
  });
}

function emitSessionStart(input) {
  const key = sessionKey(input);
  // Fresh session: clear Mode A latch so old chats don't block this one.
  saveState(key, {
    needModeA: false,
    modeADone: false,
    modeBNudgeCount: 0,
    lastFeaturePrompt: '',
  });
  const ctx = sessionContext();
  emitJson({
    additional_context: ctx,
    env: {},
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: ctx,
    },
  });
}

function emitPostRead(input) {
  if (!isReadLike(input) && toolName(input)) {
    // Some hosts call this only for Read; if unknown, still inspect path.
  }
  const path = toolPath(input);
  if (!ARCHITECT_PATH_RE.test(path.replace(/\\/g, '/'))) {
    emitJson({});
    return;
  }
  const key = sessionKey(input);
  const state = loadState(key);
  state.modeADone = true;
  state.needModeA = false;
  // Reading the skill also counts toward Mode B satisfaction for this session.
  state.modeBSatisfied = true;
  saveState(key, state);
  emitJson({
    additional_context:
      'Architect skill loaded. Complete Mode A design brief (or Mode B checklist if finishing), then continue.',
  });
}

function emitPreWrite(input) {
  if (!isWriteLike(input) && toolName(input) && !/Write|Edit|StrReplace|MultiEdit/i.test(toolName(input))) {
    emitJson({ permission: 'allow' });
    return;
  }
  // If tool name empty, assume write-like when invoked from Write matcher.
  const key = sessionKey(input);
  const state = loadState(key);

  if (state.needModeA && !state.modeADone && !transcriptHasArchitect(input)) {
    const msg =
      'Blocked: read the architect skill (Mode A) before editing. ' +
      `Read one of: ${architectPathsLine()}.`;
    emitJson({
      permission: 'deny',
      user_message: msg,
      agent_message: msg,
      decision: 'block',
      reason: msg,
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: msg,
      },
    });
    return;
  }

  emitJson({
    permission: 'allow',
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
    },
  });
}

function emitStopGate(input) {
  if (input.stop_hook_active === true) {
    emitJson({});
    return;
  }

  const key = sessionKey(input);
  const state = loadState(key);
  const loopCount = Number(input.loop_count ?? input.loopCount ?? 0);
  const dirty = behaviourFilesDirty();
  const evidence =
    state.modeBSatisfied ||
    state.modeADone ||
    transcriptHasArchitect(input);

  // Cap nudges hard so we never infinite-loop.
  if (loopCount >= 2 || state.modeBNudgeCount >= 2) {
    emitJson({});
    return;
  }

  if (!dirty || evidence) {
    emitJson({});
    return;
  }

  // Only Mode-B gate when this session asked for feature work, OR files are dirty
  // and Mode A was required earlier. Avoid random Q&A with ancient dirty trees:
  // require needModeA history or an explicit feature prompt this session.
  if (!state.needModeA && !state.lastFeaturePrompt && !state.modeADone) {
    // Still dirty from prior work — one soft nudge max if loop_count===0 and no session feature.
    // Skip: leftover dirty files alone should not block unrelated questions.
    emitJson({});
    return;
  }

  state.modeBNudgeCount = (state.modeBNudgeCount || 0) + 1;
  saveState(key, state);

  const reason = modeBContext();
  emitJson({
    followup_message: reason,
    decision: 'block',
    reason,
  });
}

const input = parseInput(readStdin());

switch (mode) {
  case 'session':
  case 'sessionstart':
    emitSessionStart(input);
    break;
  case 'post-read':
  case 'postread':
    emitPostRead(input);
    break;
  case 'pre-write':
  case 'prewrite':
    emitPreWrite(input);
    break;
  case 'stop':
    emitStopGate(input);
    break;
  case 'prompt':
  default:
    emitPromptGate(input);
    break;
}

process.exit(0);
