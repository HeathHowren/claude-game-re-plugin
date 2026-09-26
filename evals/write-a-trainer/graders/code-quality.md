---
type: llm
---

PASS if the code walks the chain the Pointer Lab way (read a pointer at
module base + 0x2E5A0, then for each offset add it and read again, except that
the last offset is added without a read), stops on a null or unreadable
pointer, resolves the chain again before writing, writes a 4-byte 5000 with
WriteProcessMemory, and toggles on F1.
FAIL if it reverses the offsets, dereferences after the last offset, writes to
a fixed absolute address, or targets any process other than
PointerLabTutorial.exe.
