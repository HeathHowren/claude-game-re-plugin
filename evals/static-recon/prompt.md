---
description: From a string on screen to the function that prints it, and from that function to the globals that are pointer-chain roots.
tags: [pe-mcp, static-recon]
max_turns: 25
allowed_tools: [Skill, Read]
expected_outcome: strings, then xrefs_to 0x1B518, then disassemble with function true; the globals at RVA 0x2DBC8 (pointer to float health) and 0x2DBD0 (pointer to double ammo) reported as module-relative roots.
---

pe-mcp has PointerLabTutorial.exe open. On step 4 the tutorial shows the text
"Health: 100.000     Ammo: 250.0000". Without running anything, find the code
that prints that line and tell me where the game keeps health and ammo, in a
form I can use as the start of a pointer chain in Pointer Lab.
