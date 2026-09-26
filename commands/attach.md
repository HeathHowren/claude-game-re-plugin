---
description: Connect to Pointer Lab's MCP server and attach to a process you own, such as PointerLabTutorial.exe
argument-hint: <process name or pid>
---

# Attach to a process through Pointer Lab

The user wants to attach to: $ARGUMENTS

Follow the `safety` skill throughout. Do these steps in order and stop at the
first one that fails.

1. **Check the target.** If `$ARGUMENTS` names an online, multiplayer or
   anti-cheat-protected game, or anything the user does not own, stop and say
   why (see `safety`). If it is empty, ask which program; suggest
   `PointerLabTutorial.exe` for practice.

2. **Check Pointer Lab's tools are connected.** Look for tools named
   `mcp__pointerlab__*`. If there are none, give the user this setup and stop:

   1. Start Pointer Lab (from the
      [Pointer Lab releases](https://github.com/HeathHowren/Pointer-Lab/releases)).
      `PointerLabTutorial.exe` ships in the same zip.
   2. In Pointer Lab, open **Tools > MCP Server** and press **Start server**.
      Starting it is the one confirmation Pointer Lab asks for; after that, a
      client with the token can change the target without asking again. This
      plugin's write guard stays in front of the write tools.
   3. Press **Copy claude mcp add command** and run the copied command in a
      terminal. It looks like
      `claude mcp add --transport http pointerlab http://127.0.0.1:8722 --header "Authorization: Bearer <token>"`.
      Keep the name `pointerlab`.
   4. Restart Claude Code and run this command again.

   The token changes every time the server starts, so an old command will get
   `401`. Never write a token into a file.

3. **Find the process.**

   ```pointerlab
   processes {}
   ```

   Match `$ARGUMENTS` against the names, case-insensitively, or use it as the
   pid. If more than one process matches, list them with their pids and ask.

4. **Attach and describe it.**

   ```pointerlab
   attach {"pid": 5120}
   session_info {}
   modules {"filter": "pointerlabtutorial"}
   ```

   Use the real pid and the process's own module name as the filter.

5. **Report**, in a short list: process name and pid, bitness, whether the
   handle is `read_only` (and what that means: reads and scans work, writes
   will fail), and the main module's `base_hex` and `size`. Say that the base
   changes every run because of ASLR, so addresses should be written as
   `module+offset`.

6. Suggest the next step: `/game-re:scan <value>` to find a value, or ask what
   the user wants to find.
