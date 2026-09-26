# pointerlab-standin

An eval fixture, not a plugin to install.

`claude plugin eval` mocks only the MCP servers a plugin under test declares,
and never loads the user's own servers. Pointer Lab is registered by the user
with a token that changes on every start, so `game-re` does not declare it.
This fixture declares a server named `pointerlab` so the Pointer Lab cases can
list it under `plugins` and answer its tools from `mocks/pointerlab/`. The URL
is never contacted during a mocked run.
