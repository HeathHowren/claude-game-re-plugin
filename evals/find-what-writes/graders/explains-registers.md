---
type: llm
---

PASS if the reply names the writing instruction (a sub from [rbx+0x10]) as
PointerLabTutorial.exe+0x1A2B, says the object's base is in RBX with the value at
offset 0x10, and says that 0x10 is useful as the last offset of a pointer chain
or as a struct field offset.
FAIL if it gives only an absolute address, misses the RBX+0x10 reading, or
claims to have patched or changed anything.
