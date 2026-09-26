---
name: write-a-trainer
description: Turn verified pointer chains into a small external trainer, either with Pointer Lab's trainer export (a CMake project, source not an exe) or by writing the C++ by hand in the External-Coding-Examples style (find the process, find the module base, walk the chain with ReadProcessMemory, guard every level). Use when the user asks to write a trainer, an external cheat program for their own game or the tutorial, a hotkey program that sets values, or to read and understand Pointer Lab's exported trainer.
---

# Write a trainer

A trainer is a separate program that finds the target by name, walks the same
pointer chains Pointer Lab found, and writes chosen values on a hotkey.
Handbook: Ch. 13 *Writing Trainers*, Ch. 19 *Internal vs External*, and the
Fundamentals lessons on offsets and threads. Tutorial: the chains from steps 6
and 7 are the right input.

Check the target against the `safety` skill first. A trainer is only written
for the tutorial or a program the user owns and plays offline. Hard-code that
program's process name; never write one that looks for an online game.

## What you need first

Chains, not addresses. A fixed address dies with ASLR on the next run. Use
`walk-a-pointer-chain` for each value, then confirm each chain:

```pointerlab
list_addresses {}
resolve_chain {"module": "PointerLabTutorial.exe", "module_offset": 187336, "offsets": [16, 0, 24]}
```

The ids, offsets and module offsets here are examples; use the ones
`list_addresses` returns. Each entry's `chain` has `module`, `module_offset`
and `offsets`.

## Route A: Pointer Lab's trainer export

Pointer Lab writes the address list out as a CMake project: `main.cpp`,
`CMakeLists.txt` and a `README.md`. It generates source on purpose, so the
user reads it before running it. The export is in the window, not on MCP, so
the user does these steps:

1. For each entry, set a hotkey (F1 to F12) in the entry's Hotkey field, or
   leave it empty for always on.
2. Freeze each entry at the value the trainer should write. The exported value
   is the frozen one; an entry with no frozen value is left out. Freezing is a
   write, so from here it needs the user's opt-in (`safety`); by hand in the
   Address List it does not.
3. **Tools > Speed and Export**, type a trainer name and an output directory,
   press **Export**. It refuses to overwrite files already there.
4. Build it from that directory. The generated README gives the exact
   commands; for a 64-bit target they are:

   ```
   cmake -S . -B build -A x64
   cmake --build build --config Release
   ```

   A 32-bit target (`PointerLabTutorial32.exe`) gets `-A Win32`. The trainer
   must match the target's bitness, because it reads pointers at its own
   width.

Then read `main.cpp` with the user. Point out, in this order:

- `findProcess`: a Toolhelp32 snapshot, matched by exe name.
- `moduleBase`: the module's base for this run, which is why chains start at
  `module + offset`.
- `resolve`: reads a pointer at the base, adds the next offset, reads again,
  and adds the last offset without reading.
- The `OpenProcess` call asks for `PROCESS_VM_READ | PROCESS_VM_WRITE |
  PROCESS_VM_OPERATION | PROCESS_QUERY_LIMITED_INFORMATION` and no more.
- The main loop toggles each cheat on its hotkey and writes the frozen value.

## Route B: write it by hand

The Fundamentals lessons build the same thing in four files in
[External-Coding-Examples](https://github.com/HeathHowren/External-Coding-Examples):
`Adding Offsets.cpp` (find a process and module by name, follow a base plus
offsets), `Null Pointer Checks.cpp` (the same walk, guarded), and
`Threading Example.cpp` (one feature per `std::thread`). Follow that
structure. The walk, guarded at every level:

```cpp
// Returns 0 if any pointer on the way is null or unreadable.
uintptr_t resolveChain(HANDLE process, uintptr_t moduleBase, uintptr_t moduleOffset,
                       const std::vector<ptrdiff_t>& offsets) {
    uintptr_t address = moduleBase + moduleOffset;
    for (size_t i = 0; i < offsets.size(); ++i) {
        uintptr_t next = 0;
        SIZE_T read = 0;
        if (!ReadProcessMemory(process, reinterpret_cast<LPCVOID>(address), &next, sizeof(next), &read) ||
            read != sizeof(next) || next == 0) {
            return 0;
        }
        address = next + offsets[i];
    }
    return address;
}
```

Rules for hand-written trainers:

- Take the chain exactly as `pointer_scan_results` or `iretable show --json`
  gives it. Do not reverse the offsets; Cheat Engine tables store them
  reversed, `.iretable` does not.
- Build for the target's bitness. `sizeof(next)` must equal the target's
  pointer size.
- Re-resolve the chain before every write. Objects move.
- Check every `ReadProcessMemory` and `WriteProcessMemory` result, and stop
  writing when the process exits.
- Compile with MSVC `/W4`. Show the user the code before they build it; do not
  run the trainer yourself.

## Success, and dead ends

**Success** is a trainer that finds the target after a restart of the target,
resolves every chain, and changes the values on its hotkeys.

| What happened | What it means | Next step |
|---|---|---|
| "Could not open the process" | Different user or elevation | Run the trainer as the target's user, elevated only if the target is |
| Resolves to 0 | A null pointer on the way, often before the game loads a level | Wait and retry; that is what the guard is for |
| Writes land but nothing changes | The chain reaches a copy, or the value is re-written every frame | Check the chain with `resolve_chain`; find the writer with `find-what-writes` |
| Works on x64, garbage on the 32-bit tutorial | Wrong bitness | Rebuild with `-A Win32` |
| Export leaves entries out | They have no frozen value | Freeze them first, then export |
