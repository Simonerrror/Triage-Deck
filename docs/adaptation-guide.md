# Adaptation Guide

This guide explains how to adapt Triage Deck to another person's machine and knowledge-base inbox.

The intended workflow is agent-assisted: a user clones the repo, gives an agent their environment details, and the agent updates config, docs, and validation steps without changing the local-first architecture.

## The Core Question

Every adaptation answers one question:

```text
When the user presses Inbox, where should the markdown go and how should it be written?
```

Everything else follows from that:

- browser profile
- userscript install method
- local bridge command
- note template
- OS-specific process startup
- validation checklist

## Minimal User Brief

Ask the user for:

```text
OS:
Browser:
Userscript manager:
Knowledge-base app:
Inbox path:
Preferred write method: CLI / direct file write / URI / local HTTP API
Should Inbox remove the X bookmark after save: yes/no
Preferred note tags:
Preferred note template changes:
Browser language for X UI:
```

Do not ask for:

- X password
- X API key
- cloud service credentials unless the user explicitly chooses a cloud target

## Adaptation Patterns

### Pattern A: Obsidian CLI

Use when the user already has a command that can create notes.

Files to edit:

- `userscript/x-bookmark-tinder.user.js`
- `scripts/obsidian_bridge.py`

Set:

- userscript `obsidianVault`
- userscript `obsidianFolder`
- bridge `XBT_OBSIDIAN_BIN`
- bridge `XBT_OBSIDIAN_VAULT`
- bridge `XBT_VAULT_ROOT`
- bridge `XBT_ALLOWED_FOLDER_PREFIX`

Validate:

```bash
curl http://127.0.0.1:8765/health
```

### Pattern B: Direct Markdown File Write

Use when the knowledge-base inbox is just a synced folder.

Change the bridge so `/capture` writes `content` to:

```text
{INBOX_ROOT}/{safe_file_name}
```

Rules:

- reject `..`
- create the inbox directory if missing
- avoid overwriting by adding a suffix or using status ID in the filename
- keep `/health`
- return JSON with the created path

This is the most portable path across macOS, Windows, and Linux.

### Pattern C: Obsidian URI Or App URI

Use when the app has a reliable URI scheme and the user accepts app focus changes.

Rules:

- URI fallback must be explicit.
- Keep clipboard fallback.
- Do not remove the X bookmark unless note creation is confirmed or the user accepts best-effort behavior.

### Pattern D: Custom Local HTTP API

Use when the user's knowledge-base app exposes a local API.

Rules:

- keep the userscript-to-bridge boundary stable
- put app-specific auth only in local environment variables
- do not put tokens in the userscript
- make `/health` verify the local API is reachable without printing secrets

## Platform Matrix

| Platform | Bridge command | Path caution | Good default |
| --- | --- | --- | --- |
| macOS | `python3 scripts/obsidian_bridge.py` | app bundles and shell `PATH` can differ | CLI or direct file write |
| Windows | `py scripts\obsidian_bridge.py` | backslashes, PowerShell quoting, executable paths | direct file write |
| Linux | `python3 scripts/obsidian_bridge.py` | desktop URI handlers vary | direct file write or CLI |

## Userscript Manager Notes

Userscript managers usually copy the script into extension storage.

After repo edits:

- reinstall the script
- paste the new content into the manager
- or install from a stable raw `.user.js` URL with update metadata

Do not assume the browser reads `userscript/x-bookmark-tinder.user.js` from disk.

## Acceptance Criteria

An adaptation is done when:

- the user can start the bridge on their OS
- `/health` returns a useful result
- the panel appears only on `x.com/i/bookmarks`
- `Update` finds visible bookmarks
- `Keep` advances without touching X
- `Inbox` creates exactly one note in the configured inbox
- `Inbox` removes the bookmark only after the note is saved, unless the user chose otherwise
- `Delete` removes exactly one bookmark
- the docs include the user's install/update flow

## Rollback

If something behaves badly:

1. Disable the userscript in the manager.
2. Stop the local bridge process.
3. Delete or move any test notes created in the inbox.
4. Clear browser local state for this project if needed:

```js
localStorage.removeItem("x-bookmark-tinder:v1")
sessionStorage.removeItem("x-bookmark-tinder:ui:v1")
```

Run that JavaScript only on `x.com` in the same browser profile.

## Agent Handoff Template

Use this at the end of an adaptation:

````md
## Adapted Setup

- OS:
- Browser:
- Userscript manager:
- Inbox target:
- Write method:

## Changed Files

- 

## Install

1. 

## Run Bridge

```bash

```

## Validate

- [ ] `/health` result:
- [ ] panel appears on bookmarks page:
- [ ] Keep advances:
- [ ] Inbox creates note:
- [ ] Delete removes bookmark:

## Known Limits

- 
````
