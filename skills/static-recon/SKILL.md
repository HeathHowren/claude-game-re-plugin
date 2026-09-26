---
name: static-recon
description: Read a Windows executable or DLL on disk before running it, with pe-mcp over MCP. Headers and mitigations, sections and entropy, imports, strings, cross-references from a string to the function that uses it, disassembly, TLS callbacks and hashes. Use when the user wants to analyze an .exe or .dll file, find a function by a string, see what a program imports, check whether it is packed, compare two builds, or find a global to use as a pointer-chain root.
---

# Static recon with pe-mcp

Read the file first. Strings lead to the code that uses them, and that code
names the globals the game keeps its state in, before the program has even
started. Handbook: Ch. 32 *The PE File Format*, and Ch. 14 *Pattern Scanning*
for checking signatures against a file. Tutorial: no step uses this directly,
but `PointerLabTutorial.exe` is the practice file, and the example below is a
real run against it.

Check the target against the `safety` skill first. pe-mcp only reads files,
but what the user does with the result still falls under those rules.

## Setup

This plugin registers [pe-mcp](https://github.com/HeathHowren/pe-mcp) as a
stdio server named `pe-mcp`, running `pe-mcp.exe` from PATH. Its tools appear
as `mcp__plugin_game-re_pe-mcp__<tool>`. If they are missing, `pe-mcp.exe` is
not on PATH: the user either adds its folder to PATH or registers it by full
path with `claude mcp add pe-mcp -- C:\Tools\pe-mcp\pe-mcp.exe`.

Conventions: `file` is an id such as `"f1"` and may be left out when one file
is open. Addresses are RVAs. As an argument a string is read as hex
(`"0x1B518"`). Lists come back as `total`, `items` and `next`; pass `next` back
as `cursor` for the next page.

## Procedure

1. Open the file and read its shape.

   ```pe-mcp
   open_file {"path": "C:\\Games\\MyGame\\game.exe"}
   headers {}
   sections {}
   ```

   From `headers`: `machine` (x64 or x86, which decides the Pointer Lab tutorial
   build and the trainer's bitness), `timestamp_utc`, `dll_characteristics`
   (`DYNAMIC_BASE` means ASLR, so absolute addresses will not survive a
   restart), and the PDB path if one is set. From `sections`: an executable
   section with `entropy` near 8 is packed or encrypted, and static analysis
   of it will be noise until it is unpacked.

2. See what it asks Windows for.

   ```pe-mcp
   imports {"limit": 50}
   imports {"filter": "Debug"}
   imports {"dll": "ws2_32.dll"}
   ```

   The first page lists every DLL with a count. Useful signs: `ws2_32.dll`
   (`send`, `recv`, `WSASend`) means sockets, and `netcode-first-look` applies;
   `d3d11.dll`, `d3d9.dll`, `opengl32.dll` name the renderer;
   `IsDebuggerPresent`, `CheckRemoteDebuggerPresent` are anti-debug checks,
   which [debug-bench](https://github.com/HeathHowren/debug-bench) explains one
   by one. Each import has an `iat` RVA, which `xrefs_to` accepts.

3. Find a string the game shows, then the code that uses it.

   ```pe-mcp
   strings {"filter": "Health: %.3f"}
   xrefs_to {"rva": "0x1B518"}
   disassemble {"rva": "0x1B4B", "function": true}
   ```

   Real results from `PointerLabTutorial.exe`:

   ```
   strings   {"total":1,"items":[{"rva":"0x1B518","enc":"utf16","text":"Health: %.3f     Ammo: %.4f"}],"next":null}
   xrefs_to  {"target":"0x1B518","note":"L\"Health: %.3f     Ammo: %.4f\"","total":1,"items":[{"rva":"0x1B4B","kind":"rip","text":"lea r8, [0x14001B518]","function":"0x1B40"}],"next":null}
   ```

   and `disassemble` returns the function from `0x1B40` to `0x1B79`, which
   includes:

   ```
   {"rva":"0x1B44","bytes":"488B057DC00200","text":"mov rax, [0x14002DBC8]","ref":"0x2DBC8"}
   {"rva":"0x1B52","bytes":"F30F1000","text":"movss xmm0, dword ptr [rax]"}
   {"rva":"0x1B56","bytes":"488B0573C00200","text":"mov rax, [0x14002DBD0]","ref":"0x2DBD0"}
   {"rva":"0x1B60","bytes":"F20F1008","text":"movsd xmm1, qword ptr [rax]"}
   ```

   Read it as: the global at RVA `0x2DBC8` holds a pointer to a float (health),
   and the one at `0x2DBD0` a pointer to a double (ammo). Those globals are
   pointer-chain roots: `PointerLabTutorial.exe+0x2DBC8 -> 0x0`.

4. Hand the root to the live side. `module_offset` is a JSON integer, so
   `0x2DBC8` is `187336`.

   ```pointerlab
   resolve_chain {"module": "PointerLabTutorial.exe", "module_offset": 187336, "offsets": [0]}
   read {"address": 2381400145672, "type": "f32"}
   ```

   The address in the `read` is an example; use the one `resolve_chain`
   returned.

5. Find everything else that touches the global, to see who writes it.

   ```pe-mcp
   xrefs_to {"rva": "0x2DBC8", "limit": 20}
   ```

   A `mov [0x14002DBC8], rax` row is where the pointer is set, usually where
   the object is created.

6. Check the rest of the file's surface when it matters.

   ```pe-mcp
   tls_callbacks {}
   exports {"limit": 50}
   resources {}
   hash {}
   ```

   TLS callbacks run before `main` and are a common place for anti-debug.
   `hash` gives the imphash and per-section SHA-256; comparing two builds'
   `.text` hashes says whether the code changed at all.

## Two builds at once

Open both files and pass `file` explicitly:

```pe-mcp
open_file {"path": "C:\\Games\\MyGame\\v1\\game.exe"}
open_file {"path": "C:\\Games\\MyGame\\v2\\game.exe"}
find_pattern {"file": "f2", "pattern": "48 89 5C 24 08 57 48 83 EC 20 48 8B 05 ?? ?? ?? ?? 48 8B D9"}
```

A signature made on v1 (`make-a-signature`) that still has one match in v2 has
survived the update.

## Success, and dead ends

**Success** is a string or import traced to a function, and that function's
globals turned into a module-relative root you can check live.

| What happened | What it means | Next step |
|---|---|---|
| The string is not found | It is built at run time, stored compressed, or in another module | Try a shorter `filter`, `encoding` `ascii` or `utf16`, `include_code: true`, or open the DLL that draws the UI |
| The string has no xrefs | Reached through a table or a register, which a linear sweep cannot see | Use `xrefs_to` with `include_data: true` to find the table, then xref the table |
| `disassemble` says there are no function bounds | x86, or a leaf function with no `.pdata` entry | Disassemble from the xref with `count` instead of `function` |
| Code section entropy near 8, few imports | Packed | Static work stops here. Let it unpack by running, then work live with Pointer Lab |
| A live `find_pattern` finds code that is not in the file | Patched or hooked at run time | [hookscan](https://github.com/HeathHowren/hookscan) compares memory with the file: `hookscan --pid 5120` |
