---
description: Build a signature for PointerLabTutorial.exe+0x1670 from pe-mcp's disassembly, check it with pe-mcp find_pattern, and hand it over in every form.
tags: [pe-mcp, find-pattern, make-a-signature]
max_turns: 25
allowed_tools: [Skill, Read]
expected_outcome: A 20-byte pattern with the RIP-relative displacement wildcarded, checked with find_pattern (one match at RVA 0x1670), given in x64dbg, IDA and aobscanmodule forms.
---

pe-mcp has C:\Users\Admin\Documents\Pointer-Lab\build\Release\PointerLabTutorial.exe
open as f1. I want a byte signature for the function at RVA 0x1670 that will
still find it after a rebuild. Check it's unique in the file, and give it to me
in the forms I can paste into x64dbg, IDA and a Pointer Lab script.
