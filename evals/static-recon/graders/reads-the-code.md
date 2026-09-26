---
type: llm
---

PASS if the reply says the function at RVA 0x1B40 reads health as a float
through a pointer stored at RVA 0x2DBC8 and ammo as a double through a pointer
at RVA 0x2DBD0, and gives each as a module-relative root such as
PointerLabTutorial.exe+0x2DBC8 with a final offset of 0.
FAIL if it swaps float and double, gives absolute addresses such as
0x14002DBC8 as the thing to use in Pointer Lab without the module-relative
form, or invents results that no tool returned.
