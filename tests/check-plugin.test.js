// Tests for scripts/check-plugin.js: it passes on this repository, and it
// fails, naming the problem, on copies with one mistake planted in each.
//
// Run with: node --test "tests/*.test.js"

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const checker = path.join(root, 'scripts', 'check-plugin.js');

function run(dir) {
  const r = spawnSync(process.execPath, [checker, dir], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr };
}

// A throwaway copy of the files the checker reads.
function copyRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'game-re-check-'));
  for (const entry of ['.claude-plugin', '.mcp.json', 'agents', 'commands', 'evals', 'hooks', 'scripts', 'skills', 'README.md']) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.cpSync(from, path.join(dir, entry), { recursive: true });
  }
  fs.rmSync(path.join(dir, 'evals', 'results'), { recursive: true, force: true });
  return dir;
}

function edit(dir, file, from, to, { all = false } = {}) {
  const p = path.join(dir, file);
  const text = fs.readFileSync(p, 'utf8');
  assert.ok(text.includes(from), `${file} does not contain the text to replace: ${from}`);
  fs.writeFileSync(p, all ? text.replaceAll(from, to) : text.replace(from, to));
}

function expectFailure(mutate, message) {
  const dir = copyRepo();
  try {
    mutate(dir);
    const r = run(dir);
    assert.equal(r.code, 1, `expected a failure, got:\n${r.out}`);
    assert.match(r.out, message);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('the repository passes', () => {
  const r = run(root);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /^OK\. Checked 8 skills, 4 commands, 1 agent, \d+ Pointer Lab and \d+ pe-mcp tool calls, \d+ eval cases/);
});

test('a misspelled Pointer Lab argument is caught', () => {
  expectFailure(
    (d) => edit(d, 'skills/find-a-value/SKILL.md', 'scan_first {"mode": "Exact value", "type": "i32", "value": "100"}', 'scan_first {"mode": "Exact value", "typ": "i32", "value": "100"}'),
    /scan_first takes no argument "typ"/,
  );
});

test('a hex string where Pointer Lab wants an integer is caught', () => {
  expectFailure(
    (d) => edit(d, 'skills/walk-a-pointer-chain/SKILL.md', '"module_offset": 187336, "offsets": [16, 0, 24]}', '"module_offset": "0x2DBC8", "offsets": [16, 0, 24]}'),
    /resolve_chain\.module_offset should be "integer"/,
  );
});

test('a tool that does not exist is caught', () => {
  expectFailure(
    (d) => edit(d, 'skills/static-recon/SKILL.md', 'tls_callbacks {}', 'tls_list {}'),
    /pe-mcp has no tool "tls_list"/,
  );
});

test('a scan mode Pointer Lab does not have is caught', () => {
  expectFailure(
    (d) => edit(d, 'skills/find-a-value/SKILL.md', '`scan_next {"mode": "Decreased value"}`', '`scan_next {"mode": "Decreasing value"}`'),
    /mode "Decreasing value" is not one of/,
  );
});

test('a missing required argument is caught', () => {
  expectFailure(
    (d) => edit(d, 'skills/find-what-writes/SKILL.md', 'access_watch_start {"address": 2381400145672, "length": 4, "writes_only": true}', 'access_watch_start {"length": 4, "writes_only": true}'),
    /access_watch_start is missing required argument "address"/,
  );
});

test('a skill whose name does not match its directory is caught', () => {
  expectFailure(
    (d) => edit(d, 'skills/safety/SKILL.md', 'name: safety', 'name: safety-rules'),
    /name "safety-rules" does not match its directory "safety"/,
  );
});

test('a reference to a skill that does not exist is caught', () => {
  expectFailure(
    (d) => edit(d, 'commands/sig.md', 'Use the `make-a-signature` skill', 'Use the `make-signature` skill'),
    /refers to a skill "make-signature" that does not exist/,
  );
});

test('a version mismatch between plugin.json and marketplace.json is caught', () => {
  expectFailure(
    (d) => edit(d, '.claude-plugin/marketplace.json', '"version": "1.0.0"', '"version": "1.0.1"'),
    /version 1\.0\.1 does not match plugin\.json 1\.0\.0/,
  );
});

test('a hook command pointing at a missing script is caught', () => {
  expectFailure(
    (d) => fs.rmSync(path.join(d, 'hooks', 'guard-writes.ps1')),
    /runs hooks\/guard-writes\.ps1, which does not exist/,
  );
});

test('a gated tool missing from the safety skill is caught', () => {
  expectFailure(
    (d) => edit(d, 'skills/safety/SKILL.md', '`create_thread`', 'create_thread', { all: true }),
    /safety\/SKILL\.md: does not name the gated tool `create_thread`/,
  );
});

test('an unknown prompt.md key in an eval case is caught', () => {
  expectFailure(
    (d) => edit(d, 'evals/netcode-first-look/prompt.md', 'max_turns: 10', 'max_turns: 10\nretries: 2'),
    /unknown prompt\.md key "retries"/,
  );
});

test('an eval grader regex that does not compile is caught', () => {
  expectFailure(
    (d) => edit(d, 'evals/netcode-first-look/graders/administrator.md', "pattern: 'Administrator|elevated'", "pattern: 'Administrator|(elevated'"),
    /pattern does not compile/,
  );
});

test('an eval plugin outside the case directory is caught', () => {
  expectFailure(
    (d) => edit(d, 'evals/find-a-value-exact/prompt.md', 'plugins: ["../..", "pointerlab-standin"]', 'plugins: ["../..", "../find-a-value-unknown/pointerlab-standin"]'),
    /must be \.\.\/\.\. or a plugin in its own subdirectory of the case/,
  );
});

test('a mock for a server no plugin under test declares is caught', () => {
  expectFailure(
    (d) => edit(d, 'evals/find-a-value-exact/prompt.md', 'plugins: ["../..", "pointerlab-standin"]', 'plugins: ["../.."]'),
    /mocks server "pointerlab", which no plugin under test declares/,
  );
});
