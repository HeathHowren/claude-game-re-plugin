---
type: fixed
---

{"function":{"begin":"0x1B40","end":"0x1B79"},"items":[{"rva":"0x1B40","bytes":"4883EC38","text":"sub rsp, 0x38"},{"rva":"0x1B44","bytes":"488B057DC00200","text":"mov rax, [0x14002DBC8]","ref":"0x2DBC8"},{"rva":"0x1B4B","bytes":"4C8D05C6990100","text":"lea r8, [0x14001B518]","ref":"0x1B518","note":"L\"Health: %.3f     Ammo: %.4f\""},{"rva":"0x1B52","bytes":"F30F1000","text":"movss xmm0, dword ptr [rax]"},{"rva":"0x1B56","bytes":"488B0573C00200","text":"mov rax, [0x14002DBD0]","ref":"0x2DBD0"},{"rva":"0x1B5D","bytes":"0F5AD8","text":"cvtps2pd xmm3, xmm0"},{"rva":"0x1B60","bytes":"F20F1008","text":"movsd xmm1, qword ptr [rax]"},{"rva":"0x1B64","bytes":"66490F7ED9","text":"movq r9, xmm3"},{"rva":"0x1B69","bytes":"F20F114C2420","text":"movsd [rsp+0x20], xmm1"},{"rva":"0x1B6F","bytes":"E83C1F0000","text":"call 0x140003AB0","ref":"0x3AB0"},{"rva":"0x1B74","bytes":"4883C438","text":"add rsp, 0x38"},{"rva":"0x1B78","bytes":"C3","text":"ret"}],"next":null}
