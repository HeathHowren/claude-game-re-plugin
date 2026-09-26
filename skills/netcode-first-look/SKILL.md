---
name: netcode-first-look
description: Take a first look at a game's network traffic on your own machine. Capture one process with procpcap into a pcapng, read its live stats (packets, bytes, endpoints, payload entropy), open it in Wireshark, tie packets to in-game actions, and start a Lua dissector from procpcap's template. Use when the user asks to capture, sniff or analyze a game's packets, study its netcode or protocol, or find the code that sends a packet, for a game or server they own and run locally.
---

# Netcode: a first look

Capture one program's traffic, measure whether it can be read at all, then
line packets up with actions. Handbook: Ch. 28 *Multiplayer Hacking and
Network Analysis*. Tutorial: the Pointer Lab tutorial does not use the network,
so there is no lesson for this; practice on a client and server you run.

## The boundary, first

Check the `safety` skill. For traffic that means:

- Only the user's own client talking to a server the user runs: their own
  game, or an open-source game with a local server on the same machine.
- Never capture, decode or replay traffic to servers the user does not run,
  and never another person's traffic. Do not help modify or inject packets for
  an online game.
- procpcap reads packets only. It does not block, change or inject them.

If the program talks to a public server, stop and say why.

## What procpcap needs

[procpcap](https://github.com/HeathHowren/procpcap) uses the WinDivert driver:

- It must run in an **Administrator** terminal. Do not run it yourself and
  never try to elevate; ask the user to run the command.
- `WinDivert.dll` and `WinDivert64.sys` must sit next to `procpcap.exe`.
  Antivirus often flags the driver, and Memory Integrity (HVCI) or Smart App
  Control can refuse to load it. That is the user's decision to change, not
  something to work around.

## Procedure

1. Get the process id. With Pointer Lab attached, `processes` lists them;
   otherwise ask the user, or run `tasklist /fi "imagename eq mygame.exe"`.

2. Ask the user to start the capture in an Administrator terminal:

   ```
   procpcap --pid 5120 -o capture.pcapng
   ```

   `--name mygame --children` captures a launcher and the game it starts.
   `-w - | wireshark -k -i -` streams straight into Wireshark.

3. Script the actions while it runs. Ask the user to do one thing at a time
   and note the wall-clock second: idle for ten seconds, move, fire once, chat
   one word. Idle traffic is the baseline every other packet is compared
   against.

4. Read the stats line procpcap prints each second, and have the user paste a
   few lines. Its fields are packets per second, bytes per second, distinct
   endpoints, and the mean payload entropy in bits per byte (0 to 8).

   | Entropy | What it usually means |
   |---|---|
   | Under about 5 | Plaintext or a simple binary layout. There is something to read |
   | 5 to 7 | Mixed: compact binary fields, or partly compressed |
   | Near 8 | Encrypted or compressed. Nothing to dissect until the key or the compression is found |

   Endpoints above one or two while playing locally mean the program talks to
   something besides the local server; find out what before going on.

5. Stop with Ctrl+C. procpcap closes the file and prints the packet count.
   Each packet's comment holds `pid <n> <name>`.

6. Summarize the capture. If Wireshark's `tshark` is on PATH, these read the
   file without the GUI:

   ```
   tshark -r capture.pcapng -q -z conv,udp
   tshark -r capture.pcapng -q -z conv,tcp
   tshark -r capture.pcapng -q -z io,stat,1
   ```

   `conv` gives the conversations (the server's port is the one to dissect);
   `io,stat,1` gives packets per second, where each scripted action should
   show as a bump over the idle baseline.

7. Line packets up with actions. In Wireshark, filter to the game's port
   (`udp.port == 27015`) and compare the packets sent in the second of an
   action with idle ones. Fields that change with the action (a sequence number
   that counts, a coordinate that moves, an opcode byte that differs between
   move and fire) are the start of the layout.

8. Start a dissector from procpcap's `examples\game-protocol.lua`: set
   `GAME_PORT`, replace the placeholder fields with the ones found in step 7,
   and load it in Wireshark (Help > About Wireshark > Folders > Personal Lua
   Plugins, or Tools > Lua > Evaluate).

## From a packet to the code that sends it

Static and live tools meet here:

1. `static-recon`: `imports {"dll": "ws2_32.dll"}` gives the IAT slot of
   `send`, `sendto` or `WSASend`; `xrefs_to` on that slot gives every call
   site.
2. Live, a hardware execute breakpoint on a call site shows its registers,
   which point at the buffer about to be sent:

   ```pointerlab
   breakpoint_add {"address": "mygame.exe+0x4A2C10", "kind": "execute", "label": "sendto call"}
   breakpoints_list {}
   read_bytes {"address": 2381400145672, "size": 64}
   ```

   The address and buffer here are examples. `breakpoints_list` shows the
   last thread's registers; on x64 the buffer is in RDX for `send` and
   `sendto`. The bytes read there should match a packet in the capture.

## Success, and dead ends

**Success** is a capture of one process, an entropy reading, and at least one
field whose value follows an in-game action.

| What happened | What it means | Next step |
|---|---|---|
| procpcap exits: not elevated | It needs Administrator | The user reruns it from an Administrator terminal |
| The driver will not load | Antivirus, HVCI or Smart App Control | The user's call. procpcap cannot be used until they allow it |
| 0 packets | Wrong pid (a launcher), or the game uses a helper process | `--name <part of the name> --children` |
| Entropy near 8 everywhere | Encrypted or compressed | The buffer at the send call is already encoded. Work back from that call site with `static-recon` (`disassemble` the caller) to the function that fills it |
| Traffic goes to hosts on the internet | Not a local-only setup | Stop. See the boundary above |
