---
name: safety
description: The rules for any game reverse-engineering, memory-editing or game-hacking work with Pointer Lab, pe-mcp, Signature Lab, sigscan or procpcap. Use before attaching to a process, scanning memory, patching, injecting or capturing traffic, when the user names a game or program to work on, when a Pointer Lab write tool is blocked, or when the user asks about GRC_ALLOW_WRITES, anti-cheat, online games or whether a target is allowed.
---

# Safety: what to work on, and what changes a process

Game reverse engineering is taught in *The Game Hacker's Handbook* against
targets the reader owns. These rules keep the work there. They apply to every
other skill and command in this plugin. Handbook: Ch. 43 *Ethics, Legality, and
Community*. Tutorial: every lesson of `PointerLabTutorial.exe` is a safe target.

## 1. Check the target before anything else

Allowed targets:

- The Pointer Lab tutorial, `PointerLabTutorial.exe` or `PointerLabTutorial32.exe`.
- Programs the user wrote, or builds they made themselves.
- Single-player games the user owns, played offline.
- Open-source games, and servers the user runs on their own machine.
- CTF binaries and the Handbook's lab targets.

Refuse, and say why, when the target is:

- An online, multiplayer or competitive game, or any game while it is connected
  to servers the user does not run.
- Anything protected by anti-cheat. Do not explain how to hide from, disable or
  get past an anti-cheat, even "just to look".
- Software the user does not own or is not authorized to analyze, or another
  person's machine, account or traffic.

When the target is not clear from the process name, ask what it is before
calling `attach`. When the answer is an online game, stop and suggest the
tutorial lesson that teaches the same technique. Reading the memory of an
online game will very likely trip anti-cheat and get the account banned, and
modifying software without permission may be illegal where the user lives.

## 2. Know what Pointer Lab's MCP server does without asking

Pointer Lab asks before it allocates, injects, patches or detaches, except
through its MCP server. Pressing **Start server** is the only confirmation.
While it runs, anything holding the token can read and write the target's
memory, patch its code, allocate, load a DLL and start threads, with no further
prompt. Nothing is undone when the client disconnects: patches stay applied,
allocations stay allocated, loaded DLLs stay loaded, frozen values stay frozen.

This plugin adds one guard on top: a PreToolUse hook.

## 3. The write guard and GRC_ALLOW_WRITES

The hook blocks these Pointer Lab tools unless `GRC_ALLOW_WRITES` is `1` in the
environment Claude Code was started from:

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

Never blocked: every read and scan, pointer scans, `access_watch_*`, hardware
breakpoints (`kind` `execute`, `write` or `readwrite`), `aa_check`, and undo:
`patch_restore_all`, `patch_remove`, `set_frozen` with `frozen: false`,
`patch_set_enabled` and `aa_set_enabled` with `enabled: false`,
`aa_disable_all`, `speed_reset`, `breakpoint_remove`.

When a call is blocked:

1. Do not retry it, and do not look for another route to the same change.
   That means no `curl` to Pointer Lab's port, no reading the token out of
   Claude Code's config, no Lua, and no C++ or PowerShell that calls
   `WriteProcessMemory` run through Bash.
2. Never set `GRC_ALLOW_WRITES` yourself. A variable set inside a Bash call
   does not reach the hook anyway. Opting in is the user's decision.
3. Tell the user what was blocked and quote the opt-in steps the hook printed:
   close Claude Code, then start it again with the variable set, for example
   `$env:GRC_ALLOW_WRITES = "1"; claude` in PowerShell.
4. Offer the manual route: the same change can be made by hand in Pointer
   Lab's window (Address List, Patches panel, Scripts panel).

## 4. After the user opts in

The hook stops blocking, and Claude Code's own permission prompt still asks
for each call. Before every change:

- Say exactly what will change: the address, the old and new bytes or value,
  and which instruction a patch replaces (`disassemble` it first).
- Say how to undo it. Patches: `patch_restore_all`. Freezes: `set_frozen`
  with `frozen: false`. Scripts: `aa_disable_all`. There is **no undo** for
  `alloc`, `load_library` or `create_thread`; they last until the target exits.
- Check an auto-assembler script with `aa_check` before `aa_set_enabled`. It
  resolves every symbol and computes the layout without writing anything.
- Pad patches to whole instructions (`patch_apply` does by default; leave
  `pad` true). A patch shorter than the code it replaces crashes the target.

## 5. Clean up at the end

When the work is done, offer to put the target back and let go of it:

```pointerlab
patches_list {}
patch_restore_all {}
aa_disable_all {}
access_watch_stop {}
debugger_detach {}
detach {}
```

`patch_restore_all` and `aa_disable_all` only matter if something was changed.
Then remind the user to press **Stop server** in Pointer Lab's MCP panel.
Detaching does not stop it, and neither does closing the target.
