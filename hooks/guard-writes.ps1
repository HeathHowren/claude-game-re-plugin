# PreToolUse hook for the game-re plugin.
#
# Blocks the Pointer Lab MCP tools that change a live process (writes, patches,
# allocation, injection, remote threads, freezes, software breakpoints, and a
# project load that re-arms frozen entries) unless GRC_ALLOW_WRITES is 1 in the
# environment Claude Code was started from. Every other tool call is let through
# untouched, so the normal permission prompt still decides.
#
# Input: the PreToolUse JSON on stdin. Output: nothing and exit 0 to allow;
# a message on stderr and exit 2 to block. Claude Code shows the stderr text to
# the model, which relays it to the user.
#
# Runs on Windows PowerShell 5.1 and PowerShell 7 with nothing to install.

$ErrorActionPreference = 'Stop'

# The tools that change the target, and what each one does, in words a user
# can act on. Names are Pointer Lab 3.x's published MCP names (docs/mcp-api.md).
$gated = [ordered]@{
    'write'             = "writes a value into the target's memory"
    'write_bytes'       = "writes bytes into the target's memory"
    'update_value'      = "writes a new value into an address list entry"
    'set_frozen'        = 'freezes a value, which writes it twenty times a second'
    'patch_apply'       = "patches the target's code"
    'patch_set_enabled' = 'applies a recorded patch'
    'alloc'             = 'allocates memory inside the target'
    'free'              = 'frees memory inside the target'
    'create_thread'     = 'starts a thread inside the target'
    'load_library'      = 'loads a DLL into the target'
    'aa_set_enabled'    = 'runs an auto-assembler script, which patches and allocates'
    'speed_load'        = 'injects the speed DLL into the target'
    'speed_set_scale'   = "changes the target's clock through the injected speed DLL"
    'breakpoint_add'    = "sets a software breakpoint, which writes an int3 into the target's code"
    'project_load'      = 'loads a table, and any frozen entries in it start writing as soon as it opens'
}

function Stop-Call([string]$text) {
    [Console]::Error.WriteLine($text)
    exit 2
}

function Test-False($value) {
    return ($value -is [bool]) -and (-not $value)
}

try {
    [Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
} catch {
    # Not every host lets the input encoding change. ASCII tool names still parse.
}

$raw = [Console]::In.ReadToEnd()

try {
    $call = $raw | ConvertFrom-Json
} catch {
    $call = $null
}

if ($null -eq $call -or $null -eq $call.tool_name) {
    # This hook only runs for tool names its matcher picked out as Pointer Lab
    # write tools. If the call cannot be read, refusing is the safe answer.
    Stop-Call ('game-re blocked a tool call it could not read. The PreToolUse input was not the JSON ' +
               'this hook expects, so the call was refused rather than let through.')
}

$toolName = [string]$call.tool_name

# MCP tools are named mcp__<server>__<tool>. A plugin-provided server shows up
# as mcp__plugin_<plugin>_<server>__<tool>, so the server part is matched by
# substring rather than exactly.
if ($toolName -notmatch '^mcp__(.+)__([^_].*)$') {
    exit 0
}
$server = $Matches[1]
$tool = $Matches[2]

$serverKey = ($server.ToLowerInvariant() -replace '[-_ .]', '')
if (-not $serverKey.Contains('pointerlab')) {
    exit 0
}
if (-not $gated.Contains($tool)) {
    exit 0
}

$inputArgs = $call.tool_input

# The undo half of a toggle changes nothing that was not already changed, so it
# is never blocked: releasing a freeze, restoring a patch, switching a script off.
switch ($tool) {
    'set_frozen' {
        if ($null -ne $inputArgs -and (Test-False $inputArgs.frozen)) { exit 0 }
    }
    'patch_set_enabled' {
        if ($null -ne $inputArgs -and (Test-False $inputArgs.enabled)) { exit 0 }
    }
    'aa_set_enabled' {
        if ($null -ne $inputArgs -and (Test-False $inputArgs.enabled)) { exit 0 }
    }
    'breakpoint_add' {
        # execute, write and readwrite use a debug register and modify nothing.
        # A missing kind means software, which is Pointer Lab's default.
        if ($null -ne $inputArgs -and $null -ne $inputArgs.kind -and
            @('execute', 'write', 'readwrite') -contains ([string]$inputArgs.kind).ToLowerInvariant()) {
            exit 0
        }
    }
}

$optIn = [Environment]::GetEnvironmentVariable('GRC_ALLOW_WRITES')
if ($null -ne $optIn -and $optIn.Trim() -eq '1') {
    exit 0
}

$what = $gated[$tool]
Stop-Call (@"
game-re blocked $toolName`: it $what.

Pointer Lab's write, patch, allocate, inject and thread tools are off until the user opts in. This is the game-re plugin's safety default, not a Pointer Lab error. Do not retry the call or look for another way to make the change. Tell the user what was blocked and how to opt in.

To opt in, and only for software they own or the Pointer Lab tutorial, the user closes Claude Code and starts it again with GRC_ALLOW_WRITES set to 1:
  PowerShell:  `$env:GRC_ALLOW_WRITES = "1"; claude
  cmd:         set "GRC_ALLOW_WRITES=1" then claude
  Git Bash:    GRC_ALLOW_WRITES=1 claude

Reads, scans, pointer scans, the access watch and hardware breakpoints work without it. Undo is never blocked: patch_restore_all, patch_remove, set_frozen with frozen false, and aa_disable_all.
"@)
