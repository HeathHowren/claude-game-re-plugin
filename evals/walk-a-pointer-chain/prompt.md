---
description: Tutorial step 7. Pointer scan at depth 5 or more, filter after the object moves, verify with resolve_chain, track with add_chain_address.
tags: [pointerlab, tutorial, walk-a-pointer-chain]
plugins: ["../..", "pointerlab-standin"]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Skill, Read]
expected_outcome: pointer_scan_start with max_depth of at least 5, pointer_scan_filter on the new address, one chain verified with resolve_chain and added with add_chain_address.
---

Step 7 of the Pointer Lab tutorial, the multi-level pointer. The value is an i32
at 0x1F3A2D0C318 right now and Pointer Lab's MCP server is attached to the
tutorial. Find a pointer chain to it that survives Move it, and track the chain
in the address list.

When you need it: I'll press Move it after your first pointer scan finishes,
and the value will then be at 0x1F3A2D5F718. Don't wait for me.
