---
description: A first look at the user's own local client and server traffic. procpcap, the Administrator requirement, entropy, and the dissector template.
tags: [netcode, procpcap]
max_turns: 10
allowed_tools: [Skill, Read]
expected_outcome: A procpcap command with --pid and -o, the Administrator and driver caveats, how to read entropy, and the Lua dissector template, all scoped to the user's own local server.
---

I wrote a small UDP multiplayer game for a class. The server runs on my own PC
and the client is mygame.exe (pid 9312). How do I see what the client actually
sends, and tell whether my packets are readable or encrypted?
