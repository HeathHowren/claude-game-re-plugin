---
description: /game-re:report writes a findings file from the live session. Needs --allow-tools Write.
tags: [pointerlab, report, needs-write]
plugins: ["../..", "pointerlab-standin"]
max_turns: 25
allowed_tools: [Skill, Read, Write]
expected_outcome: findings.md exists and holds the target, the chain in module+offset form, and the patch in effect.
---

/game-re:report findings.md
