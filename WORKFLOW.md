---
workflow:
  name: triage-deck-adaptation
  purpose: Adapt a local-first X bookmark triage userscript to a user's OS, browser, and knowledge-base inbox.
  mode: agent-guided-local-setup
targets:
  platforms:
    - macos
    - windows
    - linux
  browsers:
    - chromium
    - firefox
  userscript_managers:
    - tampermonkey
    - violentmonkey
knowledge_base:
  supported_patterns:
    - obsidian_cli
    - direct_markdown_file_write
    - obsidian_uri
    - custom_local_http_api
safety:
  local_first: true
  require_x_api: false
  collect_x_password: false
  remote_backend_default: false
validation:
  required_commands:
    - node --check userscript/x-bookmark-tinder.user.js
    - python3 -m py_compile scripts/obsidian_bridge.py
  manual_checks:
    - panel appears only on x.com/i/bookmarks
    - Keep advances
    - Inbox writes one note
    - Delete removes one bookmark
    - bridge health indicator reflects /health
---

# Triage Deck Adaptation Workflow

You are adapting this repository for a real person who wants to triage X/Twitter bookmarks into their own knowledge-base inbox.

Use this file as the project-owned workflow contract. Do not rely on private chat context when a setting can be written into the repository, documented, or represented as an environment variable.

## 1. Discovery

Start by collecting an adaptation brief.

Required fields:

- OS: macOS, Windows, or Linux.
- Browser and profile where X is already logged in.
- Userscript manager: Tampermonkey, Violentmonkey, or equivalent.
- Knowledge-base app: Obsidian, Logseq, plain folder, custom app, or other.
- Inbox destination: vault name, folder path, filesystem path, or HTTP endpoint.
- Persistence mode: CLI command, direct markdown file write, URI scheme, or custom local bridge.
- Desired `Inbox` behavior: remove X bookmark after successful save, or keep bookmark.
- Language/classification preferences: learning/fun keywords, tags, note template.

Forbidden discovery:

- Do not ask for X password.
- Do not ask for paid X API credentials.
- Do not request remote bookmark export unless the user explicitly chooses that architecture.

## 2. Architecture Choice

Pick the smallest reliable write path for the user's machine.

Preferred order:

1. Direct markdown file write when the target inbox is a normal folder.
2. Knowledge-base CLI command when the user already has a trusted CLI.
3. App URI scheme when it is reliable enough for the target app.
4. Custom local HTTP API only when the target app exposes one locally.

Keep the bridge boundary stable:

```json
{
  "vault": "optional logical vault name",
  "folder": "target inbox path",
  "file_name": "note.md",
  "content": "markdown"
}
```

If replacing Obsidian, keep or reimplement:

- `GET /health`
- `POST /capture`
- clear JSON errors
- path traversal protection
- one deterministic target file per bookmark

## 3. Configure The Userscript

Edit the `CONFIG` object in `userscript/x-bookmark-tinder.user.js`.

Common fields:

- `obsidianVault`: logical vault/app namespace; rename only if you also rename downstream payload fields.
- `obsidianFolder`: folder inside the knowledge base.
- `cliBridgeBaseUrl`: local bridge base URL.
- `cliBridgeUrl`: local bridge capture endpoint.
- `cliBridgeHealthUrl`: local bridge health endpoint.
- `cliBridgeRestartUrl`: local bridge restart endpoint.
- `bridgeFallbackToUri`: only enable if URI fallback is safe for the user's app.
- `learningKeywords`: user-specific classification terms.
- `removeLabels` and `bookmarkedLabels`: add localized X labels if the user's browser language differs.

Do not broaden `@match` beyond bookmark routes unless the user explicitly asks for another surface.

## 4. Configure The Bridge

Default bridge environment variables:

- `XBT_BRIDGE_HOST`
- `XBT_BRIDGE_PORT`
- `XBT_BRIDGE_TOKEN`
- `XBT_OBSIDIAN_BIN`
- `XBT_OBSIDIAN_VAULT`
- `XBT_VAULT_ROOT`
- `XBT_ALLOWED_FOLDER_PREFIX`
- `XBT_BRIDGE_ALLOW_RESTART`

Adaptation rules:

- For macOS/Linux, prefer `python3 scripts/obsidian_bridge.py`.
- For Windows, prefer `py scripts\obsidian_bridge.py`.
- Prefer `XBT_VAULT_ROOT` for portable vault resolution across macOS, Windows, and Linux.
- If a CLI binary is not on `PATH`, use an absolute path or switch to direct file writes.
- Keep `XBT_ALLOWED_FOLDER_PREFIX` narrow.
- If the bridge writes directly to disk, normalize paths per OS and reject `..` path traversal.
- Restart is disabled by default. Enable it only when needed with `XBT_BRIDGE_ALLOW_RESTART=1`; if `XBT_BRIDGE_TOKEN` is set, `/restart` must require the same token as `/capture`.

## 5. Install Path

Tell the user clearly that userscript managers usually store their own copy.

Acceptable install flows:

- Paste the script into the userscript manager editor.
- Install from a local or hosted raw `.user.js` URL.
- Reinstall when the repository file changes.

Do not claim that editing the repo file automatically updates the installed browser script unless an explicit auto-update URL is configured and tested.

## 6. Validation Gates

Before handoff, run:

```bash
node --check userscript/x-bookmark-tinder.user.js
python3 -m py_compile scripts/obsidian_bridge.py
```

Then perform or instruct the user to perform one manual triage pass:

1. Start bridge.
2. Open `/health` and confirm `200`.
3. Open `https://x.com/i/bookmarks`.
4. Confirm panel appears only on the bookmarks page.
5. Press `Update`.
6. Press `Keep` on one visible bookmark and confirm the panel advances.
7. Press `Inbox` on one non-critical bookmark and confirm one markdown file is created.
8. Confirm the X bookmark is removed only after the note is saved.
9. Press `Delete` on a test bookmark only if the user accepts the irreversible action.

## 7. Handoff

Final response must include:

- what was adapted
- what files changed
- exact install/update steps for the user's OS/browser
- bridge start command
- health check command
- one manual QA checklist
- known limitations and rollback instructions

Do not end with vague "next steps" if a concrete command or file path is known.
