---
description: Write a findings markdown file with the target, addresses, pointer chains, code sites, signatures and patches from this session
argument-hint: [output path, default findings-<process>-<date>.md]
---

# Write a findings report

Output path: $ARGUMENTS (if empty, use `findings-<process name without .exe>-<YYYY-MM-DD>.md`
in the current directory).

Collect what is known, write one markdown file, and tell the user its path.
Record only what a tool call in this session returned or the user stated.
Never invent an address, offset or match count, and never write the Pointer
Lab token or anything from `claude mcp` configuration into the file.

## 1. Collect

If Pointer Lab's tools are connected and a process is attached:

```pointerlab
session_info {}
modules {"filter": "pointerlabtutorial"}
list_addresses {}
patches_list {}
```

Use the attached process's own module name as the filter. For each entry in
`list_addresses` that has a `chain`, confirm it still resolves:

```pointerlab
resolve_chain {"module": "PointerLabTutorial.exe", "module_offset": 187336, "offsets": [0]}
```

If pe-mcp has the target's file open, add its identity:

```pe-mcp
headers {}
hash {}
```

From the conversation, collect: instructions found with `access_watch_sites`
(module+offset, text, the `means` line), signatures and their match counts,
and anything the user confirmed by hand.

If nothing is attached, write the report from the conversation alone and say
so in the Target section.

## 2. Write

Use this layout. Leave out a section with nothing in it, except Target.

````markdown
# Findings: <process name>

<date>, Pointer Lab session on <process name> (pid <pid>, <bitness>).

## Target

| | |
|---|---|
| Process | <name>, pid <pid>, <x64 or x86> |
| Main module | <name>, base <base_hex> this run, size <size> |
| File | <path>, built <timestamp_utc>, SHA-256 <sha256> |

Addresses below are `module+offset` unless marked as this run only.

## Values

| Description | Type | Location | Value when recorded |
|---|---|---|---|
| health | i32 | `PointerLabTutorial.exe+0x2dbc8 -> 0x10 -> 0x0 -> 0x18` | 100 |
| score | i32 | `0x22A6C3F1E08` (heap, this run only) | 12 |

## Pointer chains

For each chain: the chain in base-first form, the JSON to resolve it, and how
it was verified (for example: survived 2 moves and 1 restart).

```json
{"module": "PointerLabTutorial.exe", "module_offset": 187336, "offsets": [16, 0, 24]}
```

## Code

| Where | Instruction | What it does | How found |
|---|---|---|---|
| `PointerLabTutorial.exe+0x1A2B` | `sub [rbx+10], eax` | writes health; base in RBX, value at +0x10 | access watch, 3 hits for 3 presses |

## Signatures

For each: the target, the x64dbg form, the `aobscanmodule(...)` form, the
offset from the match to the target, and the match counts live and on disk.

## Patches and scripts in effect

From `patches_list`: address, original and patched bytes, enabled, drifted.
Say how to undo them: `patch_restore_all`.

## How to reproduce

The steps that found each item, as the tool calls or the Pointer Lab panel
actions, in order.
````

The rows shown in the layout are examples of the format, not findings. Fill
every table from the collected data only.

## 3. Finish

Write the file with the Write tool, then give the user the path and a
one-line count: values, chains, code sites, signatures, patches.
