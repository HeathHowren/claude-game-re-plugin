#!/usr/bin/env node
// Checks the plugin's files for mistakes that `claude plugin validate` does not
// look for, and some that it does, so CI catches them without a Claude Code
// install:
//
// - plugin.json, marketplace.json, .mcp.json and hooks/hooks.json parse and
//   agree with each other;
// - every skill, command and agent has the frontmatter it needs;
// - every tool call written in a ```pointerlab or ```pe-mcp block names a real
//   tool with real argument names and types (scripts/tool-schemas.json);
// - every skill and command a file refers to exists;
// - the eval suite under evals/ has the layout `claude plugin eval` reads.
//
// Usage: node scripts/check-plugin.js [plugin root]. Exits 1 on any problem.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// A small YAML reader, enough for frontmatter: scalars, quoted strings, inline
// [a, b] lists, block "- item" lists, and one level of nested maps.
// ---------------------------------------------------------------------------

function parseScalar(text) {
  const t = text.trim();
  if (t === '') return '';
  if (t.startsWith("'")) {
    if (!t.endsWith("'") || t.length < 2) throw new Error(`unterminated single-quoted string: ${t}`);
    return t.slice(1, -1).replace(/''/g, "'");
  }
  if (t.startsWith('"')) {
    if (!t.endsWith('"') || t.length < 2) throw new Error(`unterminated double-quoted string: ${t}`);
    return JSON.parse(t);
  }
  if (t.startsWith('[')) {
    if (!t.endsWith(']')) throw new Error(`unterminated list: ${t}`);
    const inner = t.slice(1, -1).trim();
    if (inner === '') return [];
    return splitFlow(inner).map(parseScalar);
  }
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null' || t === '~') return null;
  if (/^-?\d+$/.test(t)) return Number(t);
  if (/^-?\d+\.\d+$/.test(t)) return Number(t);
  return t;
}

function splitFlow(text) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let current = '';
  for (const ch of text) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      current += ch;
    } else if (ch === '[') {
      depth += 1;
      current += ch;
    } else if (ch === ']') {
      depth -= 1;
      current += ch;
    } else if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

function parseYaml(text) {
  const lines = text.split('\n').map((l) => l.replace(/\r$/, ''));
  const root = {};
  // Stack of [indent, container, lastKey].
  let i = 0;
  function parseBlock(indent) {
    const obj = {};
    let list = null;
    while (i < lines.length) {
      const line = lines[i];
      if (line.trim() === '' || line.trim().startsWith('#')) { i += 1; continue; }
      const lead = line.length - line.trimStart().length;
      if (lead < indent) break;
      if (lead > indent) throw new Error(`unexpected indentation at line ${i + 1}: ${line}`);
      const body = line.trim();
      if (body.startsWith('- ')) {
        if (list === null) list = [];
        list.push(parseScalar(body.slice(2)));
        i += 1;
        continue;
      }
      const m = body.match(/^([A-Za-z0-9_.-]+):(?:\s+(.*))?$/);
      if (!m) throw new Error(`cannot read line ${i + 1}: ${line}`);
      const key = m[1];
      const rest = m[2] === undefined ? '' : m[2];
      i += 1;
      if (rest === '|' || rest === '>') {
        const block = [];
        while (i < lines.length && (lines[i].trim() === '' || lines[i].length - lines[i].trimStart().length > indent)) {
          block.push(lines[i].trim());
          i += 1;
        }
        obj[key] = block.join(rest === '|' ? '\n' : ' ').trim();
      } else if (rest === '') {
        // Nested map or list on the following, more indented lines.
        let next = i;
        while (next < lines.length && lines[next].trim() === '') next += 1;
        if (next < lines.length && lines[next].length - lines[next].trimStart().length > indent) {
          const childIndent = lines[next].length - lines[next].trimStart().length;
          i = next;
          obj[key] = parseBlock(childIndent);
        } else {
          obj[key] = null;
        }
      } else {
        obj[key] = parseScalar(rest);
      }
    }
    if (list !== null) {
      if (Object.keys(obj).length > 0) throw new Error('a block mixes list items and keys');
      return list;
    }
    return obj;
  }
  const parsed = parseBlock(0);
  Object.assign(root, parsed);
  return root;
}

function splitFrontmatter(text) {
  const normalized = text.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) return null;
  const end = normalized.indexOf('\n---', 4);
  if (end < 0) return null;
  const after = normalized.indexOf('\n', end + 4);
  return {
    yaml: normalized.slice(4, end + 1),
    body: after < 0 ? '' : normalized.slice(after + 1),
  };
}

// ---------------------------------------------------------------------------

const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const problems = [];
let checked = 0;

function rel(p) {
  return path.relative(root, p).split(path.sep).join('/');
}

function problem(file, message) {
  problems.push(`${rel(file)}: ${message}`);
}

function readJson(file) {
  checked += 1;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    problem(file, `not valid JSON: ${err.message}`);
    return null;
  }
}

function readFrontmatter(file) {
  checked += 1;
  const text = fs.readFileSync(file, 'utf8');
  const split = splitFrontmatter(text);
  if (!split) {
    problem(file, 'no YAML frontmatter between --- lines at the top');
    return null;
  }
  try {
    return { meta: parseYaml(split.yaml), body: split.body };
  } catch (err) {
    problem(file, `frontmatter does not parse: ${err.message}`);
    return null;
  }
}

function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
}

function listFiles(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(ext)).map((d) => d.name).sort();
}

function compiles(pattern, flags) {
  try {
    new RegExp(pattern, flags || '');
    return true;
  } catch {
    return false;
  }
}

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const SEMVER = /^\d+\.\d+\.\d+$/;

// ---------------------------------------------------------------------------
// Manifests
// ---------------------------------------------------------------------------

const manifestPath = path.join(root, '.claude-plugin', 'plugin.json');
const manifest = readJson(manifestPath);
let pluginName = null;
if (manifest) {
  pluginName = manifest.name;
  if (!KEBAB.test(manifest.name || '')) problem(manifestPath, `name "${manifest.name}" is not kebab-case`);
  if (!SEMVER.test(manifest.version || '')) problem(manifestPath, `version "${manifest.version}" is not MAJOR.MINOR.PATCH`);
  if (!manifest.description) problem(manifestPath, 'no description');
  if (!manifest.author || !manifest.author.name) problem(manifestPath, 'no author.name');
  if (manifest.license !== 'MIT') problem(manifestPath, 'license is not MIT');
}

const marketPath = path.join(root, '.claude-plugin', 'marketplace.json');
const market = readJson(marketPath);
if (market && manifest) {
  if (!KEBAB.test(market.name || '')) problem(marketPath, `name "${market.name}" is not kebab-case`);
  if (!market.owner || !market.owner.name) problem(marketPath, 'no owner.name');
  const entry = (market.plugins || []).find((p) => p.name === manifest.name);
  if (!entry) {
    problem(marketPath, `lists no plugin named "${manifest.name}"`);
  } else {
    if (entry.version !== manifest.version) problem(marketPath, `version ${entry.version} does not match plugin.json ${manifest.version}`);
    if (entry.source !== './') problem(marketPath, `source should be "./" for a plugin at the repo root, is ${JSON.stringify(entry.source)}`);
    if (entry.description !== manifest.description) problem(marketPath, 'description differs from plugin.json');
  }
}

const mcpPath = path.join(root, '.mcp.json');
const mcp = readJson(mcpPath);
const declaredServers = new Set();
if (mcp) {
  const servers = mcp.mcpServers || {};
  for (const [name, server] of Object.entries(servers)) {
    declaredServers.add(name);
    if (!server.command && !server.url) problem(mcpPath, `server ${name} has neither command nor url`);
  }
  if (!servers['pe-mcp']) problem(mcpPath, 'no pe-mcp server');
}

const hooksPath = path.join(root, 'hooks', 'hooks.json');
const hooks = readJson(hooksPath);
if (hooks) {
  const known = new Set(['PreToolUse', 'PostToolUse', 'UserPromptSubmit', 'Stop', 'SubagentStop', 'SessionStart', 'SessionEnd', 'PreCompact', 'Notification']);
  for (const [event, groups] of Object.entries(hooks.hooks || {})) {
    if (!known.has(event)) problem(hooksPath, `unknown hook event ${event}`);
    for (const group of groups) {
      if (group.matcher !== undefined && !compiles(group.matcher)) problem(hooksPath, `matcher does not compile: ${group.matcher}`);
      for (const h of group.hooks || []) {
        if (h.type !== 'command') continue;
        const m = (h.command || '').match(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^"\s]+)/);
        if (!m) {
          problem(hooksPath, `command does not run a file under \${CLAUDE_PLUGIN_ROOT}: ${h.command}`);
        } else if (!fs.existsSync(path.join(root, m[1]))) {
          problem(hooksPath, `command runs ${m[1]}, which does not exist`);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Skills, commands, agents
// ---------------------------------------------------------------------------

const schemas = readJson(path.join(root, 'scripts', 'tool-schemas.json')) || {};
const skillNames = new Set(listDirs(path.join(root, 'skills')));
const commandNames = new Set(listFiles(path.join(root, 'commands'), '.md').map((f) => f.replace(/\.md$/, '')));
const toolCallsChecked = { pointerlab: 0, 'pe-mcp': 0 };

function typeMatches(spec, value) {
  const types = Array.isArray(spec.type) ? spec.type : [spec.type];
  return types.some((t) => {
    switch (t) {
      case 'integer': return Number.isInteger(value);
      case 'number': return typeof value === 'number';
      case 'string': return typeof value === 'string';
      case 'boolean': return typeof value === 'boolean';
      case 'array': return Array.isArray(value);
      case 'object': return value !== null && typeof value === 'object' && !Array.isArray(value);
      default: return true;
    }
  });
}

// The problems with one call against one server's schema, as strings.
function callProblems(server, tool, args) {
  const spec = (schemas[server] || {})[tool];
  if (!spec) return [`${server} has no tool "${tool}"`];
  const found = [];
  for (const [key, value] of Object.entries(args)) {
    const prop = spec.properties[key];
    if (!prop) {
      found.push(`${tool} takes no argument "${key}" (it takes: ${Object.keys(spec.properties).join(', ') || 'none'})`);
      continue;
    }
    if (!typeMatches(prop, value)) found.push(`${tool}.${key} should be ${JSON.stringify(prop.type)}, is ${JSON.stringify(value)}`);
    if (prop.enum && typeof value === 'string' && !prop.enum.some((e) => e.toLowerCase().replace(/[\s_-]/g, '') === value.toLowerCase().replace(/[\s_-]/g, ''))) {
      found.push(`${tool}.${key} "${value}" is not one of: ${prop.enum.join(', ')}`);
    }
  }
  for (const key of spec.required) {
    if (!(key in args)) found.push(`${tool} is missing required argument "${key}"`);
  }
  return found;
}

function parseArgs(file, tool, argsText) {
  try {
    return JSON.parse(argsText);
  } catch (err) {
    problem(file, `${tool}: arguments are not JSON (${err.message}): ${argsText}`);
    return null;
  }
}

function checkToolBlocks(file, body) {
  // Fenced blocks say which server they are for.
  const fence = /^[ \t]*```(pointerlab|pe-mcp)[ \t]*\n([\s\S]*?)^[ \t]*```/gm;
  let m;
  while ((m = fence.exec(body)) !== null) {
    const server = m[1];
    for (const rawLine of m[2].split('\n')) {
      const line = rawLine.trim();
      if (line === '' || line.startsWith('#') || line.startsWith('--')) continue;
      const call = line.match(/^([a-z_]+)\s+(\{.*\})\s*$/);
      if (!call) {
        problem(file, `${server} block line is not "tool {json}": ${line}`);
        continue;
      }
      const args = parseArgs(file, call[1], call[2]);
      if (args === null) continue;
      toolCallsChecked[server] += 1;
      for (const p of callProblems(server, call[1], args)) problem(file, p);
    }
  }
  // Inline calls, such as a table cell `scan_next {"mode": "Decreased value"}`,
  // do not say which server; one that is valid for either passes.
  const withoutFences = body.replace(/^[ \t]*```[\s\S]*?^[ \t]*```/gm, '');
  for (const inline of withoutFences.matchAll(/`([a-z_]+) (\{[^`]*\})`/g)) {
    const [, tool, argsText] = inline;
    if (tool === 'tool') continue; // prose describing the notation itself
    const servers = Object.keys(schemas).filter((s) => !s.startsWith('$') && schemas[s][tool]);
    if (servers.length === 0) {
      problem(file, `no server has a tool "${tool}"`);
      continue;
    }
    const args = parseArgs(file, tool, argsText);
    if (args === null) continue;
    const results = servers.map((s) => callProblems(s, tool, args));
    toolCallsChecked[servers[0]] += 1;
    if (results.every((r) => r.length > 0)) for (const p of results[0]) problem(file, p);
  }
}

function checkReferences(file, body) {
  for (const m of body.matchAll(/`([a-z][a-z0-9-]+)` skill/g)) {
    if (!skillNames.has(m[1])) problem(file, `refers to a skill "${m[1]}" that does not exist`);
  }
  for (const m of body.matchAll(/\/([a-z][a-z0-9-]*):([a-z][a-z0-9-]*)/g)) {
    if (m[1] !== pluginName) continue;
    if (!commandNames.has(m[2]) && !skillNames.has(m[2])) problem(file, `refers to /${m[1]}:${m[2]}, which is not a command or skill`);
  }
}

const SKILL_KEYS = new Set(['name', 'description', 'allowed-tools', 'argument-hint', 'model', 'version', 'license', 'disable-model-invocation']);
for (const dir of skillNames) {
  const file = path.join(root, 'skills', dir, 'SKILL.md');
  if (!fs.existsSync(file)) {
    problem(path.join(root, 'skills', dir), 'has no SKILL.md');
    continue;
  }
  const fm = readFrontmatter(file);
  if (!fm) continue;
  const { meta, body } = fm;
  for (const key of Object.keys(meta)) if (!SKILL_KEYS.has(key)) problem(file, `unknown frontmatter key "${key}"`);
  if (meta.name !== dir) problem(file, `name "${meta.name}" does not match its directory "${dir}"`);
  if (!KEBAB.test(String(meta.name)) || String(meta.name).length > 64) problem(file, 'name must be kebab-case and at most 64 characters');
  if (typeof meta.description !== 'string' || meta.description.length < 40) problem(file, 'description is missing or too short to trigger on');
  else if (meta.description.length > 1024) problem(file, `description is ${meta.description.length} characters; the limit is 1024`);
  if (body.trim().length < 200) problem(file, 'body is nearly empty');
  checkToolBlocks(file, body);
  checkReferences(file, body);
}

const COMMAND_KEYS = new Set(['description', 'argument-hint', 'allowed-tools', 'model', 'disable-model-invocation']);
for (const name of commandNames) {
  const file = path.join(root, 'commands', `${name}.md`);
  const fm = readFrontmatter(file);
  if (!fm) continue;
  for (const key of Object.keys(fm.meta)) if (!COMMAND_KEYS.has(key)) problem(file, `unknown frontmatter key "${key}"`);
  if (typeof fm.meta.description !== 'string' || fm.meta.description.length < 20) problem(file, 'description is missing or too short');
  if (!fm.body.includes('$ARGUMENTS')) problem(file, 'never uses $ARGUMENTS');
  checkToolBlocks(file, fm.body);
  checkReferences(file, fm.body);
}

const AGENT_KEYS = new Set(['name', 'description', 'model', 'effort', 'maxTurns', 'tools', 'disallowedTools', 'skills', 'memory', 'background', 'color']);
for (const fileName of listFiles(path.join(root, 'agents'), '.md')) {
  const file = path.join(root, 'agents', fileName);
  const fm = readFrontmatter(file);
  if (!fm) continue;
  for (const key of Object.keys(fm.meta)) if (!AGENT_KEYS.has(key)) problem(file, `unknown or plugin-ignored frontmatter key "${key}"`);
  if (fm.meta.name !== fileName.replace(/\.md$/, '')) problem(file, `name "${fm.meta.name}" does not match the file name`);
  if (typeof fm.meta.description !== 'string' || fm.meta.description.length < 40) problem(file, 'description is missing or too short');
  for (const skill of fm.meta.skills || []) {
    if (!skillNames.has(skill)) problem(file, `preloads skill "${skill}", which does not exist`);
  }
  checkToolBlocks(file, fm.body);
  checkReferences(file, fm.body);
}

// The write guard's list must appear wherever the rules are stated.
const guardPath = path.join(root, 'hooks', 'guard-writes.ps1');
if (fs.existsSync(guardPath)) {
  const source = fs.readFileSync(guardPath, 'utf8');
  const start = source.indexOf('$gated = [ordered]@{');
  const block = source.slice(start, source.indexOf('}', start));
  const gated = [...block.matchAll(/^\s+'([a-z_]+)'\s+=/gm)].map((x) => x[1]);
  if (gated.length === 0) problem(guardPath, 'could not find the $gated table');
  for (const tool of gated) {
    if (!schemas.pointerlab || !schemas.pointerlab[tool]) problem(guardPath, `gates "${tool}", which is not a Pointer Lab tool`);
    for (const doc of ['skills/safety/SKILL.md', 'agents/re-analyst.md', 'README.md']) {
      const docPath = path.join(root, doc);
      if (fs.existsSync(docPath) && !fs.readFileSync(docPath, 'utf8').includes(`\`${tool}\``)) {
        problem(docPath, `does not name the gated tool \`${tool}\``);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// The eval suite (the layout `claude plugin eval` reads)
// ---------------------------------------------------------------------------

const PROMPT_KEYS = new Set(['schema_version', 'name', 'description', 'tags', 'plugins', 'runs', 'expected_outcome', 'model', 'max_turns', 'timeout_seconds', 'allowed_tools', 'append_system_prompt', 'env']);
const READ_ONLY_TOOLS = new Set(['Read', 'Glob', 'Grep', 'NotebookRead', 'Skill', 'AskUserQuestion', 'Agent', 'TodoWrite', 'TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate', 'TaskStop']);
const GRANTABLE = new Set(['Bash', 'Write', 'Edit', 'WebFetch', 'WebSearch']);
const GRADER_OPTIONS = {
  regex: ['pattern', 'flags', 'match', 'target'],
  tool_used: ['tool', 'input_match', 'min', 'max'],
  tool_order: ['before', 'after'],
  file_exists: ['path', 'exists'],
  llm: ['criteria', 'focus'],
  baseline: ['baseline_file', 'criteria'],
};
const GRADER_TARGETS = new Set(['last_message', 'trace', 'files', 'mock_calls']);
const MOCK_KEYS = new Set(['type', 'expect', 'error', 'abort_when', 'tools']);
const evalsDir = path.join(root, 'evals');
const evalCases = [];

function checkMocks(mocksDir, servers) {
  for (const server of listDirs(mocksDir)) {
    if (server.startsWith('.')) continue;
    if (!servers.has(server)) problem(path.join(mocksDir, server), `mocks server "${server}", which no plugin under test declares`);
    const table = schemas[server];
    for (const fileName of listFiles(path.join(mocksDir, server), '.md')) {
      const file = path.join(mocksDir, server, fileName);
      const fm = readFrontmatter(file);
      if (!fm) continue;
      for (const key of Object.keys(fm.meta)) if (!MOCK_KEYS.has(key)) problem(file, `unknown mock frontmatter key "${key}"`);
      if (fm.body.trim() === '') problem(file, 'empty body: a mock returns its body');
      if (fileName === '_server.md') {
        if (fm.meta.type !== 'agent') problem(file, '_server.md must be type: agent');
        if (!Array.isArray(fm.meta.tools) || fm.meta.tools.length === 0) problem(file, '_server.md needs a tools: list');
        for (const tool of fm.meta.tools || []) if (table && !table[tool]) problem(file, `lists "${tool}", which ${server} does not have`);
      } else {
        const tool = fileName.replace(/\.md$/, '');
        if (table && !table[tool]) problem(file, `mocks "${tool}", which ${server} does not have`);
        for (const key of Object.keys(fm.meta.expect || {})) {
          const top = key.split('.')[0];
          if (table && table[tool] && !table[tool].properties[top]) problem(file, `expect names "${key}", which ${tool} does not take`);
        }
      }
    }
  }
}

function pluginServers(pluginDir) {
  const servers = new Set();
  const file = path.join(pluginDir, '.mcp.json');
  if (fs.existsSync(file)) {
    const data = readJson(file);
    for (const name of Object.keys((data && data.mcpServers) || {})) servers.add(name);
  }
  return servers;
}

function checkCase(caseDir) {
  const promptPath = path.join(caseDir, 'prompt.md');
  const fm = readFrontmatter(promptPath);
  if (!fm) return;
  const { meta, body } = fm;
  evalCases.push(path.basename(caseDir));
  for (const key of Object.keys(meta)) if (!PROMPT_KEYS.has(key)) problem(promptPath, `unknown prompt.md key "${key}" (claude plugin eval rejects unknown keys)`);
  if (body.trim() === '') problem(promptPath, 'empty prompt');
  if (meta.runs !== undefined && !(Number.isInteger(meta.runs) && meta.runs >= 1 && meta.runs <= 50)) problem(promptPath, 'runs must be 1 to 50');
  if (meta.max_turns !== undefined && !(Number.isInteger(meta.max_turns) && meta.max_turns >= 1 && meta.max_turns <= 200)) problem(promptPath, 'max_turns must be 1 to 200');
  if (meta.timeout_seconds !== undefined && !(Number.isInteger(meta.timeout_seconds) && meta.timeout_seconds <= 3600)) problem(promptPath, 'timeout_seconds must be at most 3600');
  for (const tool of meta.allowed_tools || []) {
    if (!READ_ONLY_TOOLS.has(tool) && !GRANTABLE.has(tool)) problem(promptPath, `allowed_tools names "${tool}", which is not a built-in tool`);
  }
  for (const key of Object.keys(meta.env || {})) if (!/^EVAL_[A-Z0-9_]*$/.test(key)) problem(promptPath, `env key ${key} must match EVAL_[A-Z0-9_]*`);
  const servers = new Set();
  const plugins = meta.plugins || ['../..'];
  for (const p of plugins) {
    const dir = path.resolve(caseDir, p);
    if (!fs.existsSync(path.join(dir, '.claude-plugin', 'plugin.json'))) {
      problem(promptPath, `plugins entry ${p} is not a plugin directory`);
      continue;
    }
    // claude plugin eval accepts the plugin under test, or a plugin shipped in
    // its own subdirectory of the case (not the case itself, graders or mocks).
    if (dir !== root && (path.dirname(dir) !== path.resolve(caseDir) || ['graders', 'mocks'].includes(path.basename(dir)))) {
      problem(promptPath, `plugins entry ${p} must be ../.. or a plugin in its own subdirectory of the case`);
    }
    const pj = readJson(path.join(dir, '.claude-plugin', 'plugin.json'));
    if (dir !== root && pj && !KEBAB.test(pj.name || '')) problem(dir, 'case plugin name is not kebab-case');
    for (const s of pluginServers(dir)) servers.add(s);
  }
  const gradersDir = path.join(caseDir, 'graders');
  const graders = listFiles(gradersDir, '.md');
  if (graders.length === 0) problem(caseDir, 'has no graders');
  for (const g of graders) {
    const file = path.join(gradersDir, g);
    const gm = readFrontmatter(file);
    if (!gm) continue;
    const type = gm.meta.type;
    if (!GRADER_OPTIONS[type]) {
      problem(file, `unknown grader type "${type}"`);
      continue;
    }
    const allowed = new Set(['type', 'weight', 'arm', ...GRADER_OPTIONS[type]]);
    for (const key of Object.keys(gm.meta)) if (!allowed.has(key)) problem(file, `a ${type} grader takes no "${key}"`);
    if (gm.meta.arm !== undefined && !['with-only', 'both'].includes(gm.meta.arm)) problem(file, 'arm must be with-only or both');
    if (type === 'regex') {
      if (!gm.meta.pattern) problem(file, 'regex grader has no pattern');
      else if (!compiles(gm.meta.pattern, gm.meta.flags)) problem(file, `pattern does not compile: ${gm.meta.pattern}`);
      const target = gm.meta.target;
      if (target !== undefined && !(typeof target === 'string' ? GRADER_TARGETS.has(target) : target && target.source === 'file' && target.path)) problem(file, `bad target ${JSON.stringify(target)}`);
      if (gm.meta.match !== undefined && !/^(contains|not_contains|count:\d+)$/.test(String(gm.meta.match))) problem(file, `bad match ${gm.meta.match}`);
    }
    if (type === 'tool_used') {
      if (!gm.meta.tool) problem(file, 'tool_used grader has no tool');
      if (gm.meta.input_match !== undefined && !compiles(gm.meta.input_match)) problem(file, `input_match does not compile: ${gm.meta.input_match}`);
    }
    if (type === 'tool_order') {
      for (const side of ['before', 'after']) {
        const v = gm.meta[side];
        if (!v) problem(file, `tool_order grader has no ${side}`);
        else if (typeof v === 'object' && v.input_match && !compiles(v.input_match)) problem(file, `${side}.input_match does not compile`);
      }
    }
    if (type === 'file_exists' && !gm.meta.path) problem(file, 'file_exists grader has no path');
    if (type === 'llm' && gm.body.trim() === '' && !gm.meta.criteria) problem(file, 'llm grader has no criteria');
    if (type === 'llm' && gm.meta.focus !== undefined && typeof gm.meta.focus === 'string' && !GRADER_TARGETS.has(gm.meta.focus)) problem(file, `bad focus ${gm.meta.focus}`);
  }
  checkMocks(path.join(caseDir, 'mocks'), servers);
  return servers;
}

if (fs.existsSync(evalsDir)) {
  const allServers = new Set(declaredServers);
  for (const dir of listDirs(evalsDir)) {
    if (['mocks', 'results'].includes(dir)) continue;
    const caseDir = path.join(evalsDir, dir);
    if (!fs.existsSync(path.join(caseDir, 'prompt.md'))) {
      problem(caseDir, 'is not a case: no prompt.md');
      continue;
    }
    const servers = checkCase(caseDir);
    for (const s of servers || []) allServers.add(s);
  }
  checkMocks(path.join(evalsDir, 'mocks'), allServers);
}

// ---------------------------------------------------------------------------

const summary = [
  `${skillNames.size} skills`,
  `${commandNames.size} commands`,
  `${listFiles(path.join(root, 'agents'), '.md').length} agent`,
  `${toolCallsChecked.pointerlab} Pointer Lab and ${toolCallsChecked['pe-mcp']} pe-mcp tool calls`,
  `${evalCases.length} eval cases`,
  `${checked} files read`,
].join(', ');

if (problems.length > 0) {
  for (const p of problems) console.error(`error: ${p}`);
  console.error(`\n${problems.length} problem(s). Checked ${summary}.`);
  process.exit(1);
}
console.log(`OK. Checked ${summary}.`);
