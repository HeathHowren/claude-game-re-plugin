---
name: find-what-writes
description: Find the instruction that writes (or reads) a memory address, with Pointer Lab's access watch over MCP, and read the registers it captured to find the structure the value lives in. Use when the user asks what writes to an address, what changes a value, which code decreases health, or wants to NOP or hook the code behind a value, or is on Pointer Lab tutorial steps 5, 8 or 9.
---

# Find what writes to an address

A hardware data breakpoint on the value's address traps every instruction that
writes it. Pointer Lab groups the hits by instruction and explains the
registers. Handbook: Ch. 12 *Finding Game Data*, Ch. 15 *Debugging with
x64dbg*, Ch. 16 *Code Caves and NOP*. Tutorial: step 5 (find it and NOP it),
step 8 (find it before injecting), step 9 (shared code).

Check the target against the `safety` skill first. You need an address from
`find-a-value`, and Pointer Lab's MCP tools (see `find-a-value` for setup).

## Procedure

The addresses and ids below are examples. Use the ones your calls return.

1. Start the watch on the value's address. `length` is the value's size: 4 for
   i32 and f32, 8 for f64 and i64. The address must be aligned to that size.
   The watch attaches Pointer Lab's debugger by itself.

   ```pointerlab
   access_watch_start {"address": 2381400145672, "length": 4, "writes_only": true}
   ```

   Use `"writes_only": false` to also catch reads, for example to find the
   code that draws the value.

2. Make the value change. Ask the user to trigger it (tutorial: **Hit me**) and
   to say how many times they did.

3. Read the sites.

   ```pointerlab
   access_watch_sites {}
   ```

   Each site has `address` (the instruction), `text`, `hit_count`,
   `instruction_resolved`, and `registers`, a list of
   `{register, value, means}`.

4. Read the site that matches. The right one has a `hit_count` equal to the
   number of changes the user made. Then look at `means`:

   - `"watched address is RBX+0x10"` says the object's base is in RBX and the
     value is at offset 0x10 inside it. That offset is the last offset of the
     pointer chain (`walk-a-pointer-chain`), and it is the same for every
     object of this type.
   - A `means` naming the value itself, such as RAX holding the new value,
     tells you where the new value came from.

5. See the code around it, and name it.

   ```pointerlab
   disassemble {"address": 140699127795536, "count": 10}
   describe {"address": 140699127795536}
   ```

   `describe` returns a name such as `PointerLabTutorial.exe+0x1A2B`. Write
   that down, not the absolute address: ASLR moves the module next run.

6. Stop the watch. It holds one of the CPU's four debug registers.

   ```pointerlab
   access_watch_stop {}
   ```

## Success, and dead ends

**Success** is one site whose `hit_count` tracks the user's actions, with
`instruction_resolved: true` and a `means` line that names a base register
and an offset.

| What happened | What it means | Next step |
|---|---|---|
| `access_watch_start` fails: not aligned | The address is not a multiple of `length` | Use the value's real size. A 4-byte value on an odd address is a packed struct; watch with `length` 1 |
| No sites after several changes | The address is a copy the game only displays, or the change goes through another address | Go back to `find-a-value` and find the address the game reads. Try `writes_only: false` to see who reads this one |
| `instruction_resolved: false` | A data watchpoint traps after the write; the walk back to the instruction failed | Use `trap_address_hex`; the writer is the instruction just before it. `disassemble` a few bytes earlier |
| Many sites, or one site with a huge `hit_count` | Shared code: a `memcpy` or a function that writes many objects | This is step 9. See below |
| Hits climb with no user action | A timer or a background thread writes it | Normal for a regenerating value. Compare `means` across hits |

## Shared code (tutorial step 9)

One instruction writes both the player's and the enemy's health. NOPing it
makes both invulnerable. To tell them apart, compare the two objects.

1. From the site's `registers`, take the base register value for the player.
   Find the enemy's value the same way and watch it too, or read the second
   hit's registers.
2. Lay both objects side by side:

   ```pointerlab
   struct_add {"name": "Fighter"}
   struct_guess {"id": 1, "addresses": [2381400145664, 2381400146176], "size": 64}
   struct_read {"id": 1, "addresses": [2381400145664, 2381400146176]}
   ```

   Rows with `identical: false` are the fields that tell the objects apart.
   In the tutorial the id field is at offset 4: 1 for the player, 2 for the
   enemy.
3. The fix is an injection that compares that field and skips the write for
   one object. That is `aa_check` then `aa_set_enabled`, and `aa_set_enabled`
   needs the user's opt-in (`safety`). Write the script, run `aa_check`, and
   show the user its notes before anything is enabled.

## Removing the instruction (tutorial step 5)

A NOP is `patch_apply` with `90`; Pointer Lab pads it with more NOPs to cover
the whole instruction. It is blocked until the user opts in. Before calling
it, show the instruction from `disassemble` and say that `patch_restore_all`
puts it back.

```pointerlab
patch_apply {"address": "PointerLabTutorial.exe+0x1A2B", "hex": "90", "description": "NOP the health write"}
patches_list {}
```

The user can also select the site in the Access Watch panel and press **NOP**.

Next: `make-a-signature` for the instruction you found, so it can be found
again after an update.
