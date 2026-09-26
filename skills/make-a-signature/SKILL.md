---
name: make-a-signature
description: Make a byte signature (array-of-bytes pattern, AOB) for an instruction so it can be found again after the program is updated or loaded at a new address, then prove it is unique with Pointer Lab's find_pattern, pe-mcp's find_pattern or sigscan. Covers Signature Lab's sigmake in x64dbg and building one by hand from disassembly. Use when the user asks for a signature, AOB, pattern, aobscanmodule line, or wants an address to survive a game update, or is on Pointer Lab tutorial step 8.
---

# Make a signature

An address is good until the next build. A signature is the instruction's own
bytes with everything that moves between builds turned into wildcards, so a
scanner finds the same code again. Handbook: Ch. 14 *Pattern Scanning*, Ch. 15
*Debugging with x64dbg*. Tutorial: step 8, whose injection template finds its
instruction with `aobscanmodule(...)` rather than an address.

Check the target against the `safety` skill first. Start from an instruction
address, usually from `find-what-writes`, written as `module+offset`.

## Route A: Signature Lab in x64dbg

[Signature Lab](https://github.com/HeathHowren/Signature-Lab) is the
Handbook's tool for this. It decodes every instruction and wildcards by
operand, and checks uniqueness across the whole module.

1. Only one debugger can attach to a process. If Pointer Lab's access watch or
   debugger is on, release it first:

   ```pointerlab
   access_watch_stop {}
   debugger_detach {}
   ```

2. Ask the user to attach x64dbg and run, in its command bar:

   ```
   sigmake pointerlabtutorial.exe+1670
   ```

   x64dbg reads the offset as hex. Use `sigxref <address>` instead for a
   reference signature, when the code is not unique or the address is data.
   Ask the user to paste the log.

3. Read the log. The first line ends in `unique` or a match count. `wildcards`
   names every masked byte and why. A `caution` line means the pattern runs
   past a `ret`, `int3` or `jmp` into code a rebuild may change. A reference
   signature has a `resolve` line: the C++ that turns a match back into the
   address.

Signature Lab prints five forms. Inside x64dbg use the x64dbg form (`??`); a
single `?` there is half a byte, so an IDA pattern finds nothing.

## Route B: from Pointer Lab's disassembly

1. Read the instructions from the target address on.

   ```pointerlab
   disassemble {"address": "PointerLabTutorial.exe+0x1670", "count": 8}
   ```

2. Write the bytes out and wildcard, per instruction:

   | Operand | Example | Wildcard it? |
   |---|---|---|
   | rel32 call or jmp target | `E8 xx xx xx xx` | Yes |
   | RIP-relative displacement | `48 8B 05 xx xx xx xx` | Yes |
   | Absolute address (32-bit code) | `A1 xx xx xx xx` | Yes |
   | Opcode, ModRM, SIB | `48 8B`, `89 86` | No |
   | Struct or stack offset | `89 86 xx xx xx xx`, `[rsp+08]` | No, unless the struct changes between versions |
   | rel8 short jump | `74 xx` | No; it only changes when the function does |

   Start with the target instruction and add whole instructions until the
   pattern is unique and has at least five fixed bytes.

## Prove it is unique

A signature that matches twice finds the wrong code half the time. Check it
live and on disk.

Live, across the module:

```pointerlab
modules {"filter": "pointerlabtutorial"}
find_pattern {"start": "pointerlabtutorial.exe", "size": 212992, "pattern": "48 89 5C 24 08 57 48 83 EC 20 48 8B 05 ?? ?? ?? ?? 48 8B D9", "max_results": 64}
```

`size` is the module's `size` from `modules`. `count` must be 1.

On disk, with [pe-mcp](https://github.com/HeathHowren/pe-mcp), whose
`find_pattern` reads every form Signature Lab writes:

```pe-mcp
find_pattern {"pattern": "48 89 5C 24 08 57 48 83 EC 20 48 8B 05 ?? ?? ?? ?? 48 8B D9"}
```

A real run against the tutorial's executable:

```
{"pattern":"48 89 5C 24 08 57 48 83 EC 20 48 8B 05 ?? ?? ?? ?? 48 8B D9","total":1,"items":[{"rva":"0x1670","offset":"0xA70","section":".text"}],"next":null}
```

The same pattern cut to its last ten bytes, `48 8B 05 ?? ?? ?? ?? 48 8B D9`,
returns `"total":6`. The prologue in front is what makes it unique.

Or from a terminal, with [sigscan](https://github.com/HeathHowren/sigscan):

```
sigscan --file PointerLabTutorial.exe 48 89 5C 24 08 57 48 83 EC 20 48 8B 05 ?? ?? ?? ?? 48 8B D9
sigscan --pid 5120 --module PointerLabTutorial.exe "48 89 5C 24 08 57 48 83 EC 20 48 8B 05 ? ? ? ? 48 8B D9"
```

Match sigscan's bitness to the target's for `--pid`: the 32-bit build reads
32-bit processes.

## Hand it over in every form

| Form | Example |
|---|---|
| x64dbg | `48 89 5C 24 08 57 48 83 EC 20 48 8B 05 ?? ?? ?? ?? 48 8B D9` |
| IDA | `48 89 5C 24 08 57 48 83 EC 20 48 8B 05 ? ? ? ? 48 8B D9` |
| code+mask | `"\x48\x89\x5C\x24\x08\x57\x48\x83\xEC\x20\x48\x8B\x05\x00\x00\x00\x00\x48\x8B\xD9"` `"xxxxxxxxxxxxx????xxx"` |
| Pointer Lab | `aobscanmodule(INJECT, pointerlabtutorial.exe, 48 89 5C 24 08 57 48 83 EC 20 48 8B 05 ?? ?? ?? ?? 48 8B D9)` |

Give the match offset too when the signature does not start at the target
instruction: "the write is at match + 0x7".

## Success, and dead ends

**Success** is exactly one match live, exactly one match in the file on disk,
at the RVA `describe` reported, with every moving operand wildcarded.

| What happened | What it means | Next step |
|---|---|---|
| More than one match | The code is repeated: a small function the compiler duplicated, or an inlined copy | Add instructions, or make a reference signature on a caller (`sigxref`, or sign the `call` to this function and resolve its rel32) |
| 1 match live, 0 on disk | A byte you kept is relocated or patched at run time | Wildcard absolute addresses. Check for hooks with [hookscan](https://github.com/HeathHowren/hookscan): `hookscan --pid 5120 --module PointerLabTutorial.exe` |
| 0 matches live, 1 on disk | The code was changed in memory (a patch you applied, or self-modifying code) | `patches_list`; restore with `patch_restore_all` and scan again |
| Unique, but under five fixed bytes | It works today and may match new code tomorrow | Extend it, or use a reference signature |
| `find_pattern` says it is not a byte pattern | Pointer Lab takes hex with `?`/`??` wildcards only | Pass the x64dbg or IDA form. pe-mcp and sigscan also read code+mask, C++ arrays and `aobscanmodule(...)` |

Next: put the `aobscanmodule(...)` line in an auto-assembler script (step 8),
or `/game-re:report` to record it.
