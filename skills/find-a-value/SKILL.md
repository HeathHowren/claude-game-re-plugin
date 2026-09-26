---
name: find-a-value
description: Find where a program keeps a value in memory (health, ammo, gold, a score, a timer) with Pointer Lab's scanner over MCP. Covers a known number, an unknown value you can only watch go up or down, and float and double values. Use when the user wants to find, locate or scan for a value in a running game or program, or is on Pointer Lab tutorial steps 2, 3 or 4.
---

# Find a value

Memory scanning: keep only the addresses that held the old value and now hold
the new one, until one is left. Handbook: Ch. 7 *Your First Hack*, Ch. 10
*Data Types*, Ch. 12 *Finding Game Data*. Tutorial: step 2 (exact value),
step 3 (unknown initial value), step 4 (float and double).

Check the target against the `safety` skill first.

## Setup

This needs Pointer Lab's MCP tools (`mcp__pointerlab__*`). If they are not
available, the user registers them once per Pointer Lab start: **Tools > MCP
Server**, **Start server**, **Copy claude mcp add command**, then paste that
command into a terminal and restart Claude Code. The token in it changes every
time the server starts, so never write one down or reuse an old command. Keep
the server name `pointerlab` from the copied command; the write guard matches
on it.

Calls below are written `tool {arguments}`, the way Pointer Lab's own docs
write them. Integer arguments (`pid`, `id`, `offset`, `limit`) are JSON
numbers. Addresses can be a number or a string expression such as
`"PointerLabTutorial.exe+0x2DBC8"`; offsets inside an expression are hex. The pids, addresses and ids in the
examples are made up; use the ones your calls return.

## Procedure

1. Attach.

   ```pointerlab
   processes {}
   attach {"pid": 5120}
   ```

   Use the pid from `processes`. Check the reply: `read_only: true` means every
   later write will fail; the user needs to run Pointer Lab as the same user
   as the target, or elevated if the target is elevated.

2. Limit the scan to writable memory. Game state is never in read-only pages,
   and this cuts the first scan by a large factor. `scan_set_options` resets
   every option it is not given, so pass all of them each time.

   ```pointerlab
   scan_set_options {"writable_only": true, "max_results": 1000000, "float_epsilon": 0.0001}
   ```

3. First scan. Pick the row that matches what the user can see.

   | What the user sees | First scan |
   |---|---|
   | A whole number, e.g. `Health: 100` | `scan_first {"mode": "Exact value", "type": "i32", "value": "100"}` |
   | A bar, no number | `scan_first {"mode": "Unknown initial value", "type": "i32"}` |
   | A number with decimals, e.g. `96.700` | `scan_first {"mode": "Exact value", "type": "f32", "value": "96.7"}` |
   | A float that an f32 scan misses | the same with `"type": "f64"` |

   `value` is always a string. An unknown-initial scan replies
   `baseline_only: true`: it recorded every value and filtered nothing, which
   is expected.

4. Wait for it. Scans run in the background.

   ```pointerlab
   scan_status {}
   ```

   Poll until `running` is false. Read `results`. If `truncated` is true the
   result cap stopped the sweep early; raise `max_results` and scan again.

5. Change the value in the target, then narrow. You cannot press the game's
   buttons, so ask the user to do it (in the tutorial, **Hit me**) and to tell
   you the new number if one is shown.

   | What changed | Next scan |
   |---|---|
   | New number shown | `scan_next {"mode": "Exact value", "value": "93"}` |
   | It went down | `scan_next {"mode": "Decreased value"}` |
   | It went up | `scan_next {"mode": "Increased value"}` |
   | Nothing happened since the last scan | `scan_next {"mode": "Unchanged value"}` |
   | It went down by a known amount | `scan_next {"mode": "Decreased by", "value": "7"}` |

   `scan_next` keeps the first scan's type; you cannot switch from i32 to f32
   partway. Poll `scan_status` after each one. An `Unchanged value` scan
   between two presses is cheap and removes most of memory.

6. Repeat step 5 until `results` is 1 to 3, then read them.

   ```pointerlab
   scan_results {"limit": 20}
   ```

   Each row has `address` (a number: use this one), `value`, `previous`, and
   `static`. In a scan row `hex` is the value's bytes, not the address.
   `static: true` means the address is inside a module's image, which survives
   a restart; heap values show `false` and need a pointer chain.

7. Prove it. Ask the user to change the value once more, then read the
   candidate and compare with what they see.

   ```pointerlab
   read {"address": 2381400145672, "type": "i32"}
   ```

8. Track it, and show the user.

   ```pointerlab
   add_address {"address": 2381400145672, "type": "i32", "description": "health"}
   select_panel {"name": "Address List"}
   ```

## Success, and dead ends

**Success** is one address whose `read` matches the value on screen after two
more changes you did not scan for.

| What happened | What it means | Next step |
|---|---|---|
| 0 results after the first exact scan | Wrong type. A float holding 100.0 is `00 00 C8 42`, not `64 00 00 00` | Rescan with `f32`, then `f64`. Or start over with `Unknown initial value` |
| 0 results after an exact float scan | The display rounds, and bytes do not compare equal | Set `float_epsilon` to half the last shown digit (0.05 for one decimal) or use `Unknown initial value` |
| Results stop shrinking at 5 to 20 | Copies: a display copy, an undo buffer, the value in a struct and in a message | Alternate `Unchanged value` with a real change. Then `read` each; the one the game uses changes the game when edited |
| 0 results after a narrowing scan | The value changed twice between scans, or a scan used the wrong direction | Start over. Keep one change per scan |
| Value never matches the number shown | The display is scaled (x10, a percentage) or the value is encoded | Use `Unknown initial value` with `Increased value` and `Decreased value` only |
| `read_only: true` on attach | The handle cannot write | Reads and scans still work. For writes, run Pointer Lab as the target's user |

## Finishing a tutorial step

Steps 2 to 4 pass when the found value is set (1000 in step 2, 5000 in steps 3
and 4). Setting it is a write, which the `safety` hook blocks unless the user
opted in. Tell the user to double-click the value in the Address List and type
it, or, if they have opted in:

```pointerlab
update_value {"id": 1, "value": "1000"}
```

Next: `find-what-writes` to find the code that changes this value, or
`walk-a-pointer-chain` when the address moves between runs.
