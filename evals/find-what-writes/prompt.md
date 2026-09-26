---
description: Tutorial step 5. Access watch on a known address, read the site's registers, name the instruction as module+offset.
tags: [pointerlab, tutorial, find-what-writes]
plugins: ["../..", "pointerlab-standin"]
max_turns: 30
timeout_seconds: 600
allowed_tools: [Skill, Read]
expected_outcome: access_watch_start with length 4, access_watch_sites, the writer named as PointerLabTutorial.exe+0x1A2B with its base register and offset, and the watch stopped. No patch attempted.
---

I'm on step 5 of the Pointer Lab tutorial and already found the value: it's an
i32 at 0x1F3A2C42A10, and Pointer Lab's MCP server is connected and attached.
Find out which instruction writes to it. I'll press Hit me three times as soon
as you've started watching, so don't wait for me. Just tell me what you find;
don't change anything.
