---
type: agent
tools: [processes, attach, session_info, modules, read, pointer_scan_start, pointer_scan_status, pointer_scan_filter, pointer_scan_results, resolve_chain, add_chain_address, list_addresses, project_save, select_panel, scan_first, scan_next, scan_status, scan_results]
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

Tutorial step 7, already attached to pid 5120. The value is an i32, 5213.
Before Move it it lives at 2145920271128 (0x1F3A2D0C318). The user presses Move
it once, right after the first pointer scan completes; from then on it lives
at 2145920612120 (0x1F3A2D5F718).
The one true chain is module "PointerLabTutorial.exe", module_offset 189856
(0x2E5A0), offsets [16, 0, 24, 8]. Four dereferences.
- pointer_scan_start with max_depth below 4 -> scan completes with 0 results.
  With max_depth 4 or more -> {"started":true,...}, then pointer_scan_status
  {"running":false,"fraction":1.0,"results":2871,"status":"Done"}.
- pointer_scan_filter with the new address 2145920612120 -> started; status
  then shows 3 results. Filtering with any other address leaves 0.
- pointer_scan_results before filtering: a page of plausible chains, most
  rooted in PointerLabTutorial.exe with other offsets, some in ntdll.dll.
  After filtering: {"chains":[{"module":"PointerLabTutorial.exe","module_offset":189856,"module_offset_hex":"0x2E5A0","offsets":[16,0,24,8]},{"module":"PointerLabTutorial.exe","module_offset":189856,"module_offset_hex":"0x2E5A0","offsets":[16,0,24,8,0,0]},{"module":"ntdll.dll","module_offset":1622264,"module_offset_hex":"0x18C0F8","offsets":[40,16,0,24,8]}],"offset":0,"total":3}
- resolve_chain for the true chain -> {"address":2145920612120,"hex":"0x1F3A2D5F718","chain":{...}}. Other chains resolve to other addresses, or fail with "The chain could not be followed: the pointer at level 2 is not readable."
- add_chain_address -> {"id":1,"chain":{...},"type":"i32"}
- read of the current address returns 5213.
