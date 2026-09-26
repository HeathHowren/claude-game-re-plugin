---
type: llm
---

PASS if the reply gives the chain PointerLabTutorial.exe+0x2E5A0 with offsets
0x10, 0x0, 0x18, 0x8 (in any clear notation), says it was checked against the
value's address after Move it, and prefers it over the ntdll.dll-rooted chain.
FAIL if it reports a chain rooted in ntdll.dll, reports only a fixed address,
or does not say the chain was verified.
