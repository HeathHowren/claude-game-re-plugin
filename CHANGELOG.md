# Changelog

All notable changes to claude-game-re-plugin are recorded here. This project
follows [Semantic Versioning](https://semver.org/). The plugin name `game-re`,
the command names, the skill names and the `GRC_ALLOW_WRITES` variable are
pinned for the whole 1.x series, because *The Game Hacker's Handbook* and the
Game Reversal Club lessons quote them; a change to any of them is a 2.0.

## [1.0.0] - 2026-09-26

The first release.

### Added

- **Eight skills.** `find-a-value`, `find-what-writes`, `walk-a-pointer-chain`,
  `make-a-signature`, `write-a-trainer`, `static-recon`, `netcode-first-look`
  and `safety`. Each follows a Handbook chapter, gives the exact tool calls,
  and ends with a table of dead ends. Most also follow a Pointer Lab tutorial
  step.
- **Four commands.** `/game-re:attach`, `/game-re:scan`, `/game-re:sig` and
  `/game-re:report`. The report command writes a findings file from what the
  session found and never writes the MCP token.
- **The `re-analyst` agent,** which runs a longer investigation on its own and
  carries the safety rules in its prompt.
- **A write guard.** A PreToolUse hook in Windows PowerShell blocks 15 Pointer
  Lab tools that write, patch, allocate, inject, start threads, change the
  clock, set software breakpoints or load a table with frozen entries, unless
  Claude Code was started with `GRC_ALLOW_WRITES=1`. Undo and hardware
  breakpoints always pass. The block message tells Claude not to retry and
  tells the user how to opt in.
- **pe-mcp as a bundled MCP server,** started from PATH, for static analysis
  of the file on disk.
- **An eval suite** of 11 cases in the `claude plugin eval` format, with a
  simulated tutorial for the Pointer Lab cases and recorded pe-mcp output for
  the static ones. All 33 runs pass.
- **A checker,** `scripts/check-plugin.js`, that validates the manifests,
  frontmatter, cross-references, the eval suite, and every Pointer Lab and
  pe-mcp call in the docs against the tools' real schemas.
- **30 tests** for the hook and the checker, and CI on Windows that runs them
  in Windows PowerShell 5.1 and PowerShell 7, then runs
  `claude plugin validate`.

[1.0.0]: https://github.com/HeathHowren/claude-game-re-plugin/releases/tag/v1.0.0
