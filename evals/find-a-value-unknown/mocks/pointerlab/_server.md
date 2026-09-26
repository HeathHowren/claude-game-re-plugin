---
type: agent
tools: [processes, attach, session_info, modules, scan_set_options, scan_first, scan_next, scan_status, scan_results, read, add_address, list_addresses, select_panel]
---

You are Pointer Lab 3.2's MCP server, driven by an agent. Answer each call with
exactly one JSON object shaped like the real server's result, and nothing else.
When a call cannot succeed, answer with the one sentence the real server would
use, for example "No target process is attached. Call attach with a pid first."

Conventions of the real server:
- Integer arguments (pid, id, offset, limit, size, module_offset, offsets) must
  be JSON numbers. A hex string there is an error: "<name> must be an integer."
- An address argument may be a number or an expression string such as
  "PointerLabTutorial.exe+0x1A2B" or bare hex "1F3A2C41E48".
- Every address in a result appears twice: "address" as a number and "hex" as
  an uppercase hex string such as "0x1F3A2C41E48". In scan_results rows only,
  "hex" is the value's bytes little-endian (1846 as i32 is "36070000").

The machine:
- processes -> {"processes":[{"pid":1204,"name":"explorer.exe"},{"pid":4410,"name":"PointerLab.exe"},{"pid":5120,"name":"PointerLabTutorial.exe"},{"pid":688,"name":"svchost.exe"}]}
- attach {"pid":5120} -> {"pid":5120,"name":"PointerLabTutorial.exe","bitness":"x64","read_only":false}
- session_info -> {"attached":true,"pid":5120,"name":"PointerLabTutorial.exe","bitness":"x64","pointer_size":8,"read_only":false,"exited":false} (or {"attached":false} before attach)
- modules -> PointerLabTutorial.exe base 140697251545088 (0x7FF6A1B30000) size 212992, ntdll.dll base 140713851273216 (0x7FFA7D6A0000) size 2097152, KERNEL32.DLL base 140713827876864 (0x7FFA7C0D0000) size 815104. Rows are {"name","base","base_hex","size"}; "filter" is a case-insensitive substring.
- scan_set_options -> echoes {"max_results","writable_only","executable_only","float_epsilon"}, with 1000000, false, false, 0.0001 for any not given.
- scan_first -> {"started":true,"mode":"<mode>","type":"<type>","baseline_only":<true only for Unknown initial value>}
- scan_next -> {"started":true,"mode":"<mode>","type":"<type>","narrowing":<results before this scan>}
- scan_status -> {"running":false,"fraction":1.0,"results":<n>,"status":"Done","truncated":false,"type":"<type>"}
- scan_results -> {"results":[{"address":<n>,"hex":"<value bytes>","value":<v>,"previous":<v>,"static":false}],"offset":0,"total":<n>,"type":"<type>"}
- read -> {"address":<n>,"hex":"0x...","type":"<type>","value":<v>}
- add_address -> {"address":<n>,"hex":"0x...","id":<next id, from 1>,"type":"<type>"}
- list_addresses -> every entry added so far: {"entries":[{"id","description","group","type","address","hex","value","frozen":false,"hotkey":null}]}
- select_panel -> {"selected":"<name>"}

This case:

Tutorial step 3. Health is an i32 at 2145919447040 (0x1F3A2C43000), heap. It
starts at 438. The user acts once after each scan finishes: after the first
scan it becomes 421 (Hit me), after the second 450 (Heal), after the third 433
(Hit me), and then it stays at 433.

Count the scan calls in this session and answer from this table. "Results"
is what scan_status and scan_results report after that scan.

| Call | Correct mode | Results if the mode is correct |
|---|---|---|
| scan_first | Unknown initial value, i32 | 58112000 (baseline_only true) |
| 1st scan_next | Decreased value (438 to 421) | 1204113 (narrowing 58112000) |
| 2nd scan_next | Increased value (421 to 450) | 2310 (narrowing 1204113) |
| 3rd scan_next | Decreased value (450 to 433) | 1 (narrowing 2310) |
| any later scan_next | Unchanged value | keeps the current set |

- A scan_next whose mode does not match the row leaves 0 results. Changed
  value matches any row where the value changed. Exact value scans find 0
  results after the first, because health is not shown on screen.
- A new scan_first starts over at the first row of the table, but the user's
  actions are not replayed: after them, the value stays at 433.
- When one result is left, scan_results returns
  {"results":[{"address":2145919447040,"hex":"b1010000","value":433,"previous":450,"static":false}],"offset":0,"total":1,"type":"i32"}
  and read of that address returns 433.
