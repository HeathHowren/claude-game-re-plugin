---
name: walk-a-pointer-chain
description: Find a pointer chain (module+offset -> offset -> offset) that reaches a value after the program restarts or the object moves, with Pointer Lab's pointer scanner over MCP, then verify it, track it and save it to an .iretable file. Use when an address stops working after a restart, when the user asks for a pointer chain, multi-level pointer, base address or static pointer, or is on Pointer Lab tutorial steps 6 or 7.
---

# Walk a pointer chain

A heap value moves every run. Something that does not move, an address inside
a module's image, points at it through one or more objects. The pointer
scanner lists every chain that reaches the value; a second address for the
same value removes the coincidences. Handbook: Ch. 11 *Pointer Chains*.
Tutorial: step 6 (one level), step 7 (four levels).

Check the target against the `safety` skill first. You need the value's
current address from `find-a-value`, and Pointer Lab's MCP tools (see
`find-a-value` for setup).

## How a chain resolves

`module + module_offset` is read as a pointer. Each offset is added to that
pointer and the result is read again, except the last offset, which is added
and not read: the result is where the value lives. Pointer Lab, iretable-tools
and the exported trainer all resolve this way. `iretable show` prints a chain
base first: `PointerLabTutorial.exe+0x2dbc8 -> 0x10 -> 0x0 -> 0x18`.

In tool calls `module_offset` and `offsets` are JSON integers, not hex
strings. `pointer_scan_results` gives `module_offset` as a number and
`module_offset_hex` for people; pass the number straight back.

## Procedure

The addresses, offsets and ids below are examples. Use the ones your calls
return.

1. Scan for chains to the current address. `max_depth` is the number of
   dereferences. Use 3 for a single object (step 6) and 5 when objects hang
   off objects (step 7 needs at least 5). `max_offset` is the largest offset
   tried at each level; raise it when objects are big.

   ```pointerlab
   pointer_scan_start {"target": 2381400145672, "max_depth": 5, "max_offset": 4096}
   pointer_scan_status {}
   ```

   Poll `pointer_scan_status` until `running` is false, and note `results`.

2. Move the value. Ask the user to make the object move: **Move it** in the
   tutorial, or quit and restart the program (then `attach` again). Then find
   the value's new address with `find-a-value`.

3. Keep only the chains that still reach it.

   ```pointerlab
   pointer_scan_filter {"target": 2381400149000}
   pointer_scan_status {}
   ```

   Filtering reads each chain once; it does not sweep memory again. Repeat
   steps 2 and 3 until a handful are left. Two moves are usually enough.

4. Read the survivors.

   ```pointerlab
   pointer_scan_results {"limit": 20}
   ```

   Each chain has `module`, `module_offset`, `module_offset_hex` and
   `offsets`. Prefer, in order:

   - a chain rooted in the program's own module, not a system DLL;
   - the shortest chain;
   - a last offset that matches the offset `find-what-writes` reported
     ("watched address is RBX+0x10" means the last offset is 0x10);
   - small offsets, which look like struct fields rather than coincidences.

5. Verify it resolves to where the value is now, and reads the right value.

   ```pointerlab
   resolve_chain {"module": "PointerLabTutorial.exe", "module_offset": 187336, "offsets": [16, 0, 24]}
   read {"address": 2381400149000, "type": "i32"}
   ```

   The address `resolve_chain` returns must equal the value's current address.

6. Track it, so the address list follows the value across moves and restarts,
   and save the project.

   ```pointerlab
   add_chain_address {"module": "PointerLabTutorial.exe", "module_offset": 187336, "offsets": [16, 0, 24], "type": "i32", "description": "health (chain)"}
   project_save {"path": "C:\\Users\\me\\re\\tutorial.iretable"}
   select_panel {"name": "Address List"}
   ```

7. Check the saved file without a live target, using
   [iretable-tools](https://github.com/HeathHowren/iretable-tools):

   ```
   iretable show tutorial.iretable
   iretable lint tutorial.iretable
   ```

   `lint` exits 1 when it finds a problem, such as a malformed chain.

## Success, and dead ends

**Success** is a chain that `resolve_chain` resolves to the value's address
after at least two moves or one restart, rooted in the program's own module.

| What happened | What it means | Next step |
|---|---|---|
| 0 chains | `max_depth` or `max_offset` too small | Raise `max_depth` by one, then `max_offset` to 8192. Big objects need big offsets |
| 10,000 chains and `results` stops there | The result cap | Filter anyway; one move usually cuts it to dozens. Or pass `max_results` |
| Every chain dies on the first filter | The new address is a different copy of the value, or the value moved before the scan finished | Re-find the value, check it with `read`, then filter again |
| Survivors root in `ntdll.dll` or a heap-looking module | Allocator bookkeeping, not game data | Discard them. They die on restart |
| The chain works until a level or a new game | That root is per-level or per-session | Scan again from a later state and keep the chain that survives both |

## Finishing a tutorial step

Steps 6 and 7 pass when the value is frozen at 5000 through the chain.
Freezing writes, so it is blocked until the user opts in (`safety`). Tell the
user to set the chain entry to 5000 and tick its freeze box in the Address
List, or, if they have opted in:

```pointerlab
list_addresses {}
update_value {"id": 2, "value": "5000"}
set_frozen {"id": 2, "frozen": true}
```

`project_load` is blocked too, because a table's frozen entries start writing
as soon as it opens. Resolve a saved chain with `resolve_chain` instead, or ask
the user to open the file from Pointer Lab's File menu.

Next: `write-a-trainer` turns chains into a small program, and `/game-re:report`
writes them to a findings file.
