<p align="center">
  <img src="docs/logo.svg" width="96" alt="claude-game-re-plugin logo">
</p>

# claude-game-re-plugin

A Claude Code plugin that teaches game reverse-engineering workflows and drives the tools that do them.

[![CI](https://github.com/HeathHowren/claude-game-re-plugin/actions/workflows/ci.yml/badge.svg)](https://github.com/HeathHowren/claude-game-re-plugin/actions/workflows/ci.yml)

Install it, attach Pointer Lab to a program you own, and ask Claude to find a
value, find the code that writes it, walk its pointer chain or sign the
instruction. The plugin gives Claude the procedure for each job, the exact tool
calls, and the dead ends to watch for. Reads and scans run freely. Anything
that would change the target's memory or code is blocked by a hook until you
opt in.

The plugin is written by Heath Howren
([Cyborg Elf](https://www.youtube.com/c/cyborgelf)) of
[Game Reversal Club](https://gamereversal.club) as a companion to
[*The Game Hacker's Handbook*](https://gamereversal.club/books/game-hackers-handbook/).
Each skill follows one of the book's chapters and one lesson of the tutorial
that ships with [Pointer Lab](https://github.com/HeathHowren/Pointer-Lab). It
also covers [Signature Lab](https://github.com/HeathHowren/Signature-Lab) and
the other Game Reversal Club tools.

```
$ echo '{"hook_event_name":"PreToolUse","tool_name":"mcp__pointerlab__write","tool_input":{"address":"pointerlabtutorial.exe+2DBC8","type":"f32","value":"1000"}}' | powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File hooks/guard-writes.ps1; echo "exit $?"
game-re blocked mcp__pointerlab__write: it writes a value into the target's memory.

Pointer Lab's write, patch, allocate, inject and thread tools are off until the user opts in. This is the game-re plugin's safety default, not a Pointer Lab error. Do not retry the call or look for another way to make the change. Tell the user what was blocked and how to opt in.

To opt in, and only for software they own or the Pointer Lab tutorial, the user closes Claude Code and starts it again with GRC_ALLOW_WRITES set to 1:
  PowerShell:  $env:GRC_ALLOW_WRITES = "1"; claude
  cmd:         set "GRC_ALLOW_WRITES=1" then claude
  Git Bash:    GRC_ALLOW_WRITES=1 claude

Reads, scans, pointer scans, the access watch and hardware breakpoints work without it. Undo is never blocked: patch_restore_all, patch_remove, set_frozen with frozen false, and aa_disable_all.
exit 2
```

*Real output from the write guard, given the call Claude would make to set the
tutorial's health. Exit code 2 blocks the call, and Claude reads the message.*

## What it does

- **Eight skills.** Each one is a procedure with real tool calls, a table of
  dead ends, and the Handbook chapter and tutorial step it teaches. Claude
  loads a skill when your request matches it.
- **Four commands.** `/game-re:attach`, `/game-re:scan`, `/game-re:sig` and
  `/game-re:report` run the common jobs in one line.
- **An agent.** `re-analyst` runs a longer investigation on its own and comes
  back with module+offset addresses, chains and signatures. It has the safety
  rules in its prompt.
- **A write guard.** A PreToolUse hook blocks Pointer Lab's write, patch,
  allocate, inject and thread tools unless `GRC_ALLOW_WRITES=1`.
- **pe-mcp wired in.** The plugin starts [pe-mcp](https://github.com/HeathHowren/pe-mcp)
  so Claude can read an .exe or .dll on disk.

## Install

```
claude plugin marketplace add HeathHowren/claude-game-re-plugin
claude plugin install game-re@game-reversal-club
```

Then restart Claude Code. The plugin runs on Windows, because the tools it
drives are Windows tools and the write guard runs in Windows PowerShell.

## Skills

| Skill | What it does | Handbook | Tutorial |
|---|---|---|---|
| `find-a-value` | Exact, unknown, float and double scans, narrowed until one address is left | Ch. 7, 10, 12 | Steps 2, 3, 4 |
| `find-what-writes` | Access watch on an address, reading the captured registers, shared code | Ch. 12, 15, 16 | Steps 5, 8, 9 |
| `walk-a-pointer-chain` | Pointer scan, filter after a move, verify with `resolve_chain`, save to .iretable | Ch. 11 | Steps 6, 7 |
| `make-a-signature` | Signature Lab or a hand-built pattern, proven unique live and on disk | Ch. 14, 15 | Step 8 |
| `write-a-trainer` | Pointer Lab's trainer export, or a small external trainer in C++ | Ch. 13, 19 | Chains from steps 6, 7 |
| `static-recon` | pe-mcp: headers, imports, string to xref to function, globals that root a chain | Ch. 32, 14 | None. Practice on the tutorial's .exe |
| `netcode-first-look` | procpcap capture of your own local game, Wireshark, a Lua dissector | Ch. 28 | None. Use your own local game |
| `safety` | What targets are allowed, what the guard blocks, what to do when blocked | Ch. 43 | All |

## Commands

| Command | Arguments | What it does |
|---|---|---|
| `/game-re:attach` | `<process name or pid>` | Connects to Pointer Lab's MCP server and attaches |
| `/game-re:scan` | `<value or unknown> [type]` | Finds a value, round by round, until one address is left |
| `/game-re:sig` | `<address or module+offset> [file on disk]` | Makes a signature and proves it unique live and on disk |
| `/game-re:report` | `[output path]` | Writes a findings file from what the session found |

## Safety model

The plugin is for software you own, CTF binaries, the Handbook's labs and the
Pointer Lab tutorial. The `safety` skill tells Claude to refuse online and
multiplayer games, other people's servers and anything protected by
anti-cheat, before it attaches.

Pointer Lab's MCP server does what it is asked without a prompt. So the plugin
adds a hook that runs before every call to one of these tools and blocks it:

| Tool | Why it is blocked |
|---|---|
| `write`, `write_bytes`, `update_value` | Writes the target's memory |
| `set_frozen` with `frozen: true` | Writes the value twenty times a second |
| `patch_apply`, `patch_set_enabled` with `enabled: true` | Patches code |
| `alloc`, `free` | Allocates or frees memory in the target |
| `create_thread`, `load_library` | Runs code or loads a DLL in the target |
| `aa_set_enabled` with `enabled: true` | Runs an auto-assembler script |
| `speed_load`, `speed_set_scale` | Injects the speed DLL and changes the clock |
| `breakpoint_add` with kind `software` or no kind | Writes an int3 into code |
| `project_load` | Frozen entries in the table start writing as it opens |

Reads, scans, pointer scans, the access watch and hardware breakpoints are
never blocked. Neither is undo: `patch_restore_all`, `patch_remove`,
`set_frozen` with `frozen: false`, and turning a patch or script off.

To opt in, close Claude Code and start it again with the variable set. Only
the value `1` counts.

```powershell
$env:GRC_ALLOW_WRITES = "1"; claude     # PowerShell
```

```
set "GRC_ALLOW_WRITES=1"                # cmd, then run claude
GRC_ALLOW_WRITES=1 claude               # Git Bash
```

Even with writes on, the skills tell Claude to say what it will change and how
to undo it before each change, and to undo its patches at the end.

The hook matches any MCP server whose name contains "pointerlab" (so
`pointerlab`, `pointer-lab` and `PointerLab` all count). Keep the name that
Pointer Lab's copied command uses.

## Tools it expects

| Tool | Used by | Where to get it |
|---|---|---|
| [Pointer Lab](https://github.com/HeathHowren/Pointer-Lab) 3.2 or later | Most skills, all commands | Releases page. Its MCP server is under **Tools > MCP Server** |
| [pe-mcp](https://github.com/HeathHowren/pe-mcp) | `static-recon`, `make-a-signature`, `/game-re:sig` | Releases page. Put `pe-mcp.exe` on your PATH |
| [Signature Lab](https://github.com/HeathHowren/Signature-Lab) | `make-a-signature` | Releases page. An x64dbg plugin |
| [sigscan](https://github.com/HeathHowren/sigscan) | `make-a-signature`, `/game-re:sig` | Releases page. Checks a signature against a file |
| [iretable-tools](https://github.com/HeathHowren/iretable-tools) | `walk-a-pointer-chain`, `write-a-trainer` | Releases page. Reads Pointer Lab tables |
| [procpcap](https://github.com/HeathHowren/procpcap) | `netcode-first-look` | Releases page. Needs Administrator and WinDivert |
| [hookscan](https://github.com/HeathHowren/hookscan) | `make-a-signature`, `static-recon` | Releases page. Finds code that no longer matches the file |
| [debug-bench](https://github.com/HeathHowren/debug-bench) | `static-recon` | Releases page. Explains the anti-debug checks a game may import |

[openxr-pose-layer](https://github.com/HeathHowren/openxr-pose-layer) is a
sibling project for VR tracking. This plugin does not use it.

Only Pointer Lab and pe-mcp are called over MCP. The rest are command-line
tools that Claude tells you to run, or runs through Bash if you allow it.

### Pointer Lab's MCP server

Pointer Lab is not in the plugin's `.mcp.json`, because its token changes
every time the server starts. Register it yourself each time:

1. In Pointer Lab, open **Tools > MCP Server** and press **Start server**.
2. Press **Copy claude mcp add command** and paste it into a terminal.
3. Restart Claude Code, or run `/game-re:attach`, which walks you through it.

Never save the token in a file. An old command stops working when the server
restarts.

### pe-mcp

The plugin starts `pe-mcp.exe` from your PATH. If it lives somewhere else,
either add that folder to PATH or register it yourself with
`claude mcp add pe-mcp -- C:\Tools\pe-mcp\pe-mcp.exe`. The plugin's copy
shows up as `mcp__plugin_game-re_pe-mcp__*`.

## Evals

`evals/` holds a suite in the `claude plugin eval` format: 11 cases, each with
a prompt and graders, plus mocks.

- **Pointer Lab cases** (`find-a-value-exact`, `find-a-value-unknown`,
  `find-what-writes`, `walk-a-pointer-chain`, `safety-online-game`,
  `safety-write-blocked`, `report-command`) run against a simulated tutorial.
  Eval mocks only replace servers that a plugin under test declares, so each
  of these cases ships a small `pointerlab-standin/` plugin that declares a
  `pointerlab` server. The server is never contacted, and the case's mock
  plays the tutorial.
- **pe-mcp cases** (`make-a-signature`, `static-recon`) use pe-mcp output
  recorded from a real run against `PointerLabTutorial.exe`.
- **No-tool cases** (`write-a-trainer`, `netcode-first-look`) grade the answer
  alone.

Run it from the repository root on Windows, since `safety-write-blocked` needs
the hook:

```
claude plugin eval . --ablation none --allow-tools Write -j 4
```

`--ablation none` skips the baseline arm. Without the plugin there is no
Pointer Lab stand-in, so the baseline has no tools and its score says little.
`report-command` writes a file, so it needs `--allow-tools Write`.

A full run is 33 agent runs, three per case, and costs about $6 in API usage.
The last run, with Claude Code 2.1.283 on 2026-09-26, passed every grader:

```
Cases 11, 11 passed. Suite score 100%. Pass rate 100%.
```

Each run is a fresh model session, so a single run can still miss. The
structure of the suite is also checked, for free, by `scripts/check-plugin.js`:
prompt keys, grader types, regexes that compile, plugins in the layout the eval
runner accepts, and mocks that name real tools on declared servers.

## Development

No dependencies. You need Node 22 or later and Windows PowerShell.

```
node scripts/check-plugin.js
node --test "tests/*.test.js"
claude plugin validate .claude-plugin/plugin.json
claude plugin validate .claude-plugin/marketplace.json
```

`check-plugin.js` checks that the manifests agree, that every skill, command
and agent has valid frontmatter, and that every Pointer Lab and pe-mcp call in
the docs names a real tool with real arguments of the right types. It also
checks that every gated tool is named in the `safety` skill, the agent and
this README, and it checks the eval suite. The tool schemas it checks against
are in `scripts/tool-schemas.json`.

```
OK. Checked 8 skills, 4 commands, 1 agent, 77 Pointer Lab and 22 pe-mcp tool calls, 11 eval cases, 137 files read.
```

The tests run the hook in Windows PowerShell 5.1, and in PowerShell 7 too when
`pwsh` is installed. The checker's tests plant one mistake per copy of the
repository and check that it is caught.

```
✔ [powershell.exe 5] blocks every gated tool and names it (3946.0866ms)
✔ [powershell.exe 5] never blocks a read or undo tool (11431.2786ms)
✔ [powershell.exe 5] matches the server under other names it may be given (1122.6125ms)
✔ [powershell.exe 5] lets the undo half of a toggle through (2127.6364ms)
✔ [powershell.exe 5] allows hardware breakpoints and blocks software ones (1314.3581ms)
✔ [powershell.exe 5] refuses a call it cannot read (721.1662ms)
✔ [powershell.exe 5] reads non-ASCII input (254.2707ms)
✔ hooks.json runs the hook for exactly the gated Pointer Lab tools (0.3934ms)
✔ the hook script names the same gated tools as the spec (0.8041ms)
ℹ tests 30
ℹ suites 0
ℹ pass 30
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 24584.141
```

```
Validating plugin manifest: C:\Users\Admin\Documents\claude-game-re-plugin\.claude-plugin\plugin.json

✔ Validation passed
```

*Real output: the checker, the last lines of the test run, and one of the three
`claude plugin validate` runs, from Claude Code 2.1.283.*

## Limits

- **Windows only.** The hook runs `powershell.exe`. On a machine without it
  the hook cannot run and does not block, so writes would go through. Under
  WSL, Claude Code runs Linux, so use it from Windows instead.
- **A seatbelt, not a sandbox.** The hook stops Claude's calls to Pointer
  Lab's MCP tools. It does not stop you from making changes in Pointer Lab's
  window, and it cannot see a program that talks to Pointer Lab's port
  directly with the token. The `safety` skill tells Claude not to try.
- **Opt-in is per session.** The variable is read when Claude Code starts. It
  cannot be turned on from inside a session.
- **PowerShell 7** is covered by the tests but was only run on Windows
  PowerShell 5.1 before release. CI runs both.

## Intended use

For learning and for work on software you own or have permission to test. Do
not use it on online games, other people's servers, or software whose terms
forbid it.

## License

MIT. See [LICENSE](LICENSE). The plugin contains no third-party code.
