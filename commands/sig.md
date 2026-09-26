---
description: Make a byte signature for an instruction and prove it is unique, live with Pointer Lab and on disk with pe-mcp
argument-hint: <address or module+offset> [file path of the module on disk]
---

# Make and check a signature

Arguments: $ARGUMENTS

Use the `make-a-signature` skill for the procedure and the wildcard rules.

1. **Parse the arguments.** The first is the instruction, preferably as
   `module+offset` (for example `PointerLabTutorial.exe+0x1670`). The second,
   optional, is the module's file on disk. If no address is given, ask for one,
   or offer to find it with `find-what-writes`.

2. **Name it and read it.**

   ```pointerlab
   describe {"address": "PointerLabTutorial.exe+0x1670"}
   disassemble {"address": "PointerLabTutorial.exe+0x1670", "count": 8}
   modules {"filter": "pointerlabtutorial"}
   ```

3. **Build the pattern** from the instruction bytes, wildcarding rel32 branch
   targets, RIP-relative displacements and absolute addresses, and keeping
   opcodes, ModRM and struct offsets. Grow it by whole instructions.

4. **Check it live** across the whole module, with `size` from `modules`:

   ```pointerlab
   find_pattern {"start": "pointerlabtutorial.exe", "size": 212992, "pattern": "48 89 5C 24 08 57 48 83 EC 20 48 8B 05 ?? ?? ?? ?? 48 8B D9", "max_results": 64}
   ```

   If `count` is above 1, add the next instruction and check again. Stop at 64
   bytes; past that, a reference signature is the better tool (see
   `make-a-signature`).

5. **Check it on disk** when pe-mcp's tools are available and the file is
   known (from the second argument, or ask). Open the file if it is not open,
   then:

   ```pe-mcp
   find_pattern {"pattern": "48 89 5C 24 08 57 48 83 EC 20 48 8B 05 ?? ?? ?? ?? 48 8B D9"}
   ```

   The single match's `rva` must equal the offset `describe` gave. If pe-mcp is
   not available, give the user the equivalent
   `sigscan --file <path> <pattern>` command instead.

6. **Report** the signature in the x64dbg, IDA, code+mask and Pointer Lab
   `aobscanmodule(...)` forms, the fixed-byte count, which bytes are wildcards
   and why, the live and on-disk match counts, and the offset from the match to
   the target instruction if it is not zero.

Suggest `/game-re:report` to save it.
