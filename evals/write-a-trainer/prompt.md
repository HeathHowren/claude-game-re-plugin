---
description: Write a small external trainer in C++ for the tutorial from a verified pointer chain, in the External-Coding-Examples style.
tags: [trainer, write-a-trainer]
max_turns: 10
allowed_tools: [Skill, Read]
expected_outcome: C++ that finds PointerLabTutorial.exe by name, gets the module base, walks the chain with ReadProcessMemory and null checks, re-resolves before each write, and writes 5000 on F1.
---

I have a verified chain for the step 7 value in the Pointer Lab tutorial
(PointerLabTutorial.exe, 64-bit): PointerLabTutorial.exe+0x2E5A0 -> 0x10 -> 0x0
-> 0x18 -> 0x8, an i32. Write me a small external C++ trainer that sets it to
5000 while F1 is toggled on. Just show me the code; I'll build it myself.
