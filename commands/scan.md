---
description: Find a value in the attached process with Pointer Lab's scanner, narrowing round by round until one address is left
argument-hint: <value | unknown> [i32|f32|f64|i64|i16|u8]
---

# Scan for a value

Arguments: $ARGUMENTS

Use the `find-a-value` skill for the procedure and the `safety` skill for the
rules. This command runs that procedure interactively.

1. **Parse the arguments.** The first word is the value, or `unknown` for a
   value the user cannot see as a number. The second is the type. With no type:
   a number with a decimal point means `f32`, anything else `i32`. With no
   arguments at all, ask what the value is and what the user sees on screen.

2. **Check the session.** Call `session_info`. If nothing is attached, run the
   steps of `/game-re:attach` first.

3. **First scan.**

   ```pointerlab
   scan_set_options {"writable_only": true, "max_results": 1000000, "float_epsilon": 0.0001}
   scan_first {"mode": "Exact value", "type": "i32", "value": "100"}
   scan_status {}
   ```

   For `unknown` use `{"mode": "Unknown initial value", "type": "i32"}`. For a
   float shown with fewer decimals than it has, raise `float_epsilon` to half
   the last shown digit. Poll `scan_status` until `running` is false.

4. **Narrow, one round per user action.** Report the result count. Ask the user
   to change the value in the program once and tell you what they see now:
   the new number, or up, down, or unchanged. Map that to `scan_next` exactly as
   the table in `find-a-value` says, poll `scan_status`, and report the new
   count. Stop when 1 to 3 results remain, or after 8 rounds.

5. **Show the candidates.**

   ```pointerlab
   scan_results {"limit": 10}
   ```

   Give a table: address in hex, current value, previous value, and `static`.
   Remind the user that in scan rows `hex` is the value's bytes, not the
   address.

6. **Verify.** Ask for one more change and `read` each candidate. Keep the one
   that matches the screen, then:

   ```pointerlab
   add_address {"address": 2381400145672, "type": "i32", "description": "health"}
   select_panel {"name": "Address List"}
   ```

   Use the real address and a description the user gives.

7. **If it stalls**, use the dead-ends table in `find-a-value`. Do not write a
   new value to test a candidate unless the user asks and has opted in; that
   write is blocked by the hook otherwise.

End by suggesting `find-what-writes` or `walk-a-pointer-chain`, and
`/game-re:report` to save what was found.
