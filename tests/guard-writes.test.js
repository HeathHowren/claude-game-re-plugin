// Tests for hooks/guard-writes.ps1, the PreToolUse hook that keeps Pointer
// Lab's write tools off until the user opts in.
//
// Each case feeds the hook the JSON Claude Code sends on stdin and checks the
// exit code (0 allows, 2 blocks) and what it prints. The hook runs under
// Windows PowerShell 5.1, and under PowerShell 7 as well when pwsh is on PATH.
//
// Run with: node --test "tests/*.test.js"

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const script = path.join(root, 'hooks', 'guard-writes.ps1');
const hooksJson = JSON.parse(fs.readFileSync(path.join(root, 'hooks', 'hooks.json'), 'utf8'));

// The tools the hook must stop. This list is the spec; the hook and the
// matcher in hooks.json are both checked against it.
const GATED = [
  'write', 'write_bytes', 'update_value', 'set_frozen',
  'patch_apply', 'patch_set_enabled',
  'alloc', 'free', 'create_thread', 'load_library',
  'aa_set_enabled', 'speed_load', 'speed_set_scale',
  'breakpoint_add', 'project_load',
];

// Pointer Lab tools that only read, or that undo, and must never be blocked.
const ALLOWED = [
  'processes', 'attach', 'detach', 'session_info', 'modules', 'regions',
  'read', 'read_bytes', 'read_pointer',
  'scan_first', 'scan_next', 'scan_status', 'scan_results', 'scan_set_options', 'find_pattern',
  'resolve', 'describe', 'resolve_chain',
  'pointer_scan_start', 'pointer_scan_filter', 'pointer_scan_status', 'pointer_scan_results',
  'add_address', 'add_chain_address', 'list_addresses', 'remove_address',
  'disassemble', 'assemble', 'aa_check', 'aa_scripts', 'aa_disable_all',
  'access_watch_start', 'access_watch_stop', 'access_watch_sites',
  'breakpoint_remove', 'breakpoints_list', 'debugger_attach',
  'patch_remove', 'patch_restore_all', 'patches_list',
  'speed_reset', 'speed_status', 'project_save', 'select_panel', 'screenshot',
];

function findShells() {
  const shells = [];
  for (const exe of ['powershell.exe', 'pwsh']) {
    const probe = spawnSync(exe, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major'], { encoding: 'utf8' });
    if (probe.status === 0) shells.push({ exe, version: probe.stdout.trim() });
  }
  return shells;
}

const shells = findShells();

function runHook(shell, payload, env = {}) {
  const childEnv = { ...process.env, ...env };
  if (!('GRC_ALLOW_WRITES' in env)) delete childEnv.GRC_ALLOW_WRITES;
  const stdin = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const result = spawnSync(
    shell.exe,
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script],
    { input: stdin, encoding: 'utf8', env: childEnv },
  );
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

function call(toolName, toolInput = {}) {
  return {
    session_id: 'test',
    transcript_path: 'C:\\tmp\\t.jsonl',
    cwd: 'C:\\tmp',
    hook_event_name: 'PreToolUse',
    tool_name: toolName,
    tool_input: toolInput,
  };
}

test('a PowerShell to run the hook is available', () => {
  assert.ok(shells.length > 0, 'neither powershell.exe nor pwsh could be started');
});

for (const shell of shells) {
  const tag = `[${shell.exe} ${shell.version}]`;

  test(`${tag} allows a Pointer Lab read tool`, () => {
    const r = runHook(shell, call('mcp__pointerlab__scan_first', { mode: 'Exact value', type: 'i32', value: '100' }));
    assert.equal(r.code, 0);
    assert.equal(r.stdout, '');
    assert.equal(r.stderr, '');
  });

  test(`${tag} blocks a Pointer Lab write tool without GRC_ALLOW_WRITES`, () => {
    const r = runHook(shell, call('mcp__pointerlab__write_bytes', { address: 'PointerLabTutorial.exe+0x1670', hex: '90 90' }));
    assert.equal(r.code, 2);
    assert.match(r.stderr, /game-re blocked mcp__pointerlab__write_bytes: it writes bytes into the target's memory\./);
    assert.match(r.stderr, /\$env:GRC_ALLOW_WRITES = "1"; claude/);
    assert.match(r.stderr, /Do not retry the call/);
    assert.equal(r.stdout, '');
  });

  test(`${tag} allows the same write tool with GRC_ALLOW_WRITES=1`, () => {
    const r = runHook(shell, call('mcp__pointerlab__write_bytes', { address: 'PointerLabTutorial.exe+0x1670', hex: '90 90' }),
      { GRC_ALLOW_WRITES: '1' });
    assert.equal(r.code, 0);
    assert.equal(r.stderr, '');
  });

  test(`${tag} only the value 1 opts in`, () => {
    for (const value of ['0', 'true', 'yes', '']) {
      const r = runHook(shell, call('mcp__pointerlab__write', { address: '0x1000', value: '5000' }), { GRC_ALLOW_WRITES: value });
      assert.equal(r.code, 2, `GRC_ALLOW_WRITES=${JSON.stringify(value)} should not opt in`);
    }
    // cmd's `set VAR=1 && claude` leaves a trailing space; that still counts.
    const r = runHook(shell, call('mcp__pointerlab__write', { address: '0x1000', value: '5000' }), { GRC_ALLOW_WRITES: '1 ' });
    assert.equal(r.code, 0);
  });

  test(`${tag} ignores tools that are not Pointer Lab's`, () => {
    for (const name of ['Bash', 'Write', 'mcp__plugin_game-re_pe-mcp__read_bytes', 'mcp__memory__write', 'mcp__github__create_thread']) {
      const r = runHook(shell, call(name, { command: 'echo hi' }));
      assert.equal(r.code, 0, `${name} should pass through`);
      assert.equal(r.stderr, '');
    }
  });

  test(`${tag} blocks every gated tool and names it`, () => {
    for (const tool of GATED) {
      const r = runHook(shell, call(`mcp__pointerlab__${tool}`, { address: '0x1000' }));
      assert.equal(r.code, 2, `${tool} should be blocked`);
      assert.match(r.stderr, new RegExp(`blocked mcp__pointerlab__${tool}: it `));
    }
  });

  test(`${tag} never blocks a read or undo tool`, () => {
    for (const tool of ALLOWED) {
      const r = runHook(shell, call(`mcp__pointerlab__${tool}`, {}));
      assert.equal(r.code, 0, `${tool} should be allowed`);
    }
  });

  test(`${tag} matches the server under other names it may be given`, () => {
    for (const name of ['mcp__PointerLab__alloc', 'mcp__pointer-lab__alloc', 'mcp__pointer_lab__alloc',
      'mcp__plugin_pointerlab-standin_pointerlab__alloc']) {
      const r = runHook(shell, call(name, { size: 4096 }));
      assert.equal(r.code, 2, `${name} should be blocked`);
    }
  });

  test(`${tag} lets the undo half of a toggle through`, () => {
    const cases = [
      ['set_frozen', { id: 3, frozen: false }, 0],
      ['set_frozen', { id: 3, frozen: true }, 2],
      ['set_frozen', { id: 3, frozen: 'false' }, 2],
      ['patch_set_enabled', { id: 1, enabled: false }, 0],
      ['patch_set_enabled', { id: 1, enabled: true }, 2],
      ['patch_set_enabled', { id: 1 }, 2],
      ['aa_set_enabled', { id: 1, enabled: false }, 0],
      ['aa_set_enabled', { id: 1, enabled: true }, 2],
    ];
    for (const [tool, input, expected] of cases) {
      const r = runHook(shell, call(`mcp__pointerlab__${tool}`, input));
      assert.equal(r.code, expected, `${tool} ${JSON.stringify(input)}`);
    }
  });

  test(`${tag} allows hardware breakpoints and blocks software ones`, () => {
    const cases = [
      [{ address: '0x1000', kind: 'execute' }, 0],
      [{ address: '0x1000', kind: 'write', length: 4 }, 0],
      [{ address: '0x1000', kind: 'READWRITE', length: 4 }, 0],
      [{ address: '0x1000', kind: 'software' }, 2],
      [{ address: '0x1000' }, 2],
    ];
    for (const [input, expected] of cases) {
      const r = runHook(shell, call('mcp__pointerlab__breakpoint_add', input));
      assert.equal(r.code, expected, JSON.stringify(input));
    }
  });

  test(`${tag} refuses a call it cannot read`, () => {
    for (const bad of ['', 'not json', '{"tool_input":{}}']) {
      const r = runHook(shell, bad);
      assert.equal(r.code, 2, `input ${JSON.stringify(bad)}`);
      assert.match(r.stderr, /could not read/);
    }
  });

  test(`${tag} reads non-ASCII input`, () => {
    const r = runHook(shell, call('mcp__pointerlab__update_value', { id: 1, value: '5000', description: 'Gesundheit – Spieler' }));
    assert.equal(r.code, 2);
    assert.match(r.stderr, /update_value/);
  });
}

test('hooks.json runs the hook for exactly the gated Pointer Lab tools', () => {
  const entries = hooksJson.hooks.PreToolUse;
  assert.equal(entries.length, 1);
  const matcher = new RegExp(entries[0].matcher);
  for (const tool of GATED) {
    assert.ok(matcher.test(`mcp__pointerlab__${tool}`), `matcher misses ${tool}`);
    assert.ok(matcher.test(`mcp__plugin_pointerlab-standin_pointerlab__${tool}`), `matcher misses plugin-scoped ${tool}`);
    assert.ok(matcher.test(`mcp__PointerLab__${tool}`), `matcher misses PointerLab ${tool}`);
  }
  for (const tool of ALLOWED) {
    assert.ok(!matcher.test(`mcp__pointerlab__${tool}`), `matcher should not run the hook for ${tool}`);
  }
  for (const name of ['Bash', 'mcp__plugin_game-re_pe-mcp__read_bytes', 'mcp__memory__write']) {
    assert.ok(!matcher.test(name), `matcher should not run the hook for ${name}`);
  }
  const command = entries[0].hooks[0].command;
  assert.match(command, /\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/guard-writes\.ps1/);
});

test('the hook script names the same gated tools as the spec', () => {
  const source = fs.readFileSync(script, 'utf8');
  const block = source.slice(source.indexOf('$gated = [ordered]@{'), source.indexOf('}', source.indexOf('$gated = [ordered]@{')));
  const names = [...block.matchAll(/^\s+'([a-z_]+)'\s+=/gm)].map((m) => m[1]);
  assert.deepEqual([...names].sort(), [...GATED].sort());
});
