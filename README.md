# Triage Deck

Local-first triage for X/Twitter bookmarks.

The project adds a small review panel on `x.com/i/bookmarks` so you can process visible bookmarks quickly:

- `Keep`: leave the bookmark in X and advance.
- `Inbox`: save a markdown note to your knowledge-base inbox, then remove the bookmark from X.
- `Delete`: remove the bookmark from X.

It does not use the paid X API. It runs inside your already logged-in browser session and sends notes to a local bridge on your machine.

## Project Shape

```text
.
├── AGENTS.md
├── WORKFLOW.md
├── README.md
├── app/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── docs/
│   ├── adaptation-guide.md
│   ├── architecture.md
│   └── live-session.md
├── scripts/
│   └── obsidian_bridge.py
└── userscript/
    └── x-bookmark-tinder.user.js
```

Layers:

- `userscript/`: live Tampermonkey/Violentmonkey script for the real X bookmarks page.
- `scripts/`: local HTTP bridge that writes markdown through a configured knowledge-base command.
- `app/`: static prototype for UI work without touching X.
- `WORKFLOW.md`: Symphony-style repo-owned policy for agents adapting this project.
- `AGENTS.md`: project instructions for coding agents.

## How It Works

1. You open `https://x.com/i/bookmarks` in a browser profile where you are already logged into X.
2. The userscript reads visible bookmark cards from the page DOM.
3. The overlay shows one bookmark at a time.
4. `Keep` marks the item reviewed locally and advances.
5. `Delete` uses X's own remove-bookmark UI.
6. `Inbox` builds markdown, sends it to the local bridge, copies markdown to the clipboard, and removes the bookmark only after the local write succeeds.

Session model:

- no X password is entered into this project
- no X API token is needed
- the script only sees what the browser page already renders
- the queue is based on visible DOM cards, not the full remote bookmark database

## Quick Start

### 1. Install A Userscript Manager

Install one userscript manager in the browser profile where you already use X:

- Tampermonkey
- Violentmonkey
- another userscript manager with `GM_xmlhttpRequest` support

Then install:

- [`userscript/x-bookmark-tinder.user.js`](userscript/x-bookmark-tinder.user.js)
- or the raw userscript URL: `https://raw.githubusercontent.com/Simonerrror/Triage-Deck/main/userscript/x-bookmark-tinder.user.js`

The userscript includes `@downloadURL` and `@updateURL` metadata for Tampermonkey-compatible updates when installed from the raw GitHub URL. If you paste the script manually, paste the new version again after changes.

### 2. Configure The Inbox Target

The default setup targets Obsidian through a local bridge.

Edit the top-level `CONFIG` object in [`userscript/x-bookmark-tinder.user.js`](userscript/x-bookmark-tinder.user.js):

```js
obsidianVault: "YOUR_VAULT_NAME",
obsidianFolder: "Path/Inside/Vault/Inbox/X Bookmarks",
cliBridgeBaseUrl: "http://127.0.0.1:8765",
bridgeLaunchCommand: "",
```

Set `bridgeLaunchCommand` to a local command if you want the red bridge lamp to copy it when the bridge is not running, for example `cd /path/to/Triage-Deck && python3 scripts/obsidian_bridge.py`.

Edit environment variables for [`scripts/obsidian_bridge.py`](scripts/obsidian_bridge.py):

```bash
XBT_OBSIDIAN_BIN=obsidian
XBT_OBSIDIAN_VAULT=YOUR_VAULT_NAME
XBT_VAULT_ROOT="/absolute/path/to/your/vault"
XBT_ALLOWED_FOLDER_PREFIX="Path/Inside/Vault/Inbox/X Bookmarks"
```

`XBT_VAULT_ROOT` is the most portable option across macOS, Windows, and Linux. If it is omitted, the bridge tries to discover the Obsidian vault from the platform-specific Obsidian config.

If your knowledge base is not Obsidian, adapt the bridge first. The bridge boundary is intentionally small: browser sends `{ vault, folder, file_name, content }`; the local script decides how to persist it.

### 3. Start The Local Bridge

macOS/Linux:

```bash
python3 scripts/obsidian_bridge.py
```

Windows PowerShell:

```powershell
py scripts\obsidian_bridge.py
```

Health check:

```bash
curl http://127.0.0.1:8765/health
```

Expected meanings:

- `200`: bridge is running and basic checks passed.
- `503`: bridge process is alive, but its local config is degraded.
- connection error: bridge is not running on `127.0.0.1:8765`.

### 4. Open X Bookmarks

Open:

```text
https://x.com/i/bookmarks
```

The panel should appear only on the bookmarks route.

Keyboard:

- `Left Arrow`: Keep
- `Down Arrow`: Inbox
- `Right Arrow`: Delete
- `Up Arrow`: Undo safe `Keep`

Panel controls:

- `Update`: rescan visible bookmarks.
- `Shift+Update`: restart reviewed state for the visible set.
- green/red lamp: bridge health. Green rechecks `/health`; red shows the failure. If the bridge is down and `bridgeLaunchCommand` is configured, clicking the lamp copies that command. If the bridge is reachable, degraded, and `restart_allowed` is true, clicking the lamp asks for confirmation before calling `POST /restart`.
- `x`: hide panel; the launcher can reopen it.

## Platform Notes

### macOS

- Python is usually available as `python3`.
- Browser userscript managers work in Chromium-based browsers and Firefox.
- Obsidian routing can use a CLI command, an Obsidian URI, or direct markdown file writes.

### Windows

- Use PowerShell commands and Python Launcher (`py`) when available.
- If the configured knowledge-base CLI is not on `PATH`, use an absolute executable path.
- Prefer direct markdown file writes if a CLI bridge is unreliable.

### Linux

- Use `python3`.
- Make sure browser extension permissions allow `127.0.0.1`.
- If the knowledge-base app has no stable CLI, write markdown directly into a synced folder.

## Adapting With An Agent

This repo is designed to be adapted by a coding agent.

Give the agent this prompt:

```text
Adapt this project to my machine and knowledge-base inbox.

Use WORKFLOW.md as the workflow policy and AGENTS.md as repository instructions.

My environment:
- OS:
- Browser:
- Userscript manager:
- Knowledge base app:
- Desired inbox path:
- Should Inbox delete the X bookmark after save? yes/no
- Should notes be created through a CLI, direct file write, or custom local HTTP API?

Do not ask for my X password or paid X API credentials.
Keep the setup local-first.
Validate with the health endpoint and one manual bookmark triage pass.
```

The agent should produce:

- an adaptation brief
- exact file changes
- install steps for your OS/browser
- a validation checklist
- rollback notes

For the full agent workflow, read:

- [`WORKFLOW.md`](WORKFLOW.md)
- [`AGENTS.md`](AGENTS.md)
- [`docs/adaptation-guide.md`](docs/adaptation-guide.md)

## Safety Model

This project intentionally avoids:

- X password collection
- paid X API access
- remote bookmark processing
- cloud sync of captured bookmark content

Local risks still exist:

- the userscript can click X page controls
- `Delete` and `Inbox` mutate X bookmarks
- the local bridge writes files on your machine
- X DOM changes can break selectors

Before publishing a personal fork, review:

- default vault/folder names
- hardcoded local paths
- bridge token settings
- whether `POST /restart` should be enabled with `XBT_BRIDGE_ALLOW_RESTART=1`; it is disabled by default, token-protected when `XBT_BRIDGE_TOKEN` is set, and only useful when the bridge process is still reachable

## Development

Run the static prototype:

```bash
python3 -m http.server 4173
```

Open:

```text
http://localhost:4173/app/
```

Validate scripts:

```bash
node --check userscript/x-bookmark-tinder.user.js
python3 -m py_compile scripts/obsidian_bridge.py
```

## Known Constraints

- The script only sees bookmark cards currently rendered by X.
- If the queue is empty, scroll X to load more cards or use `Shift+Update` to reset local reviewed state.
- X can change labels, menus, or DOM structure without warning.
- `Delete` and `Inbox` are intentionally not undoable.
- The default bridge assumes a command compatible with `obsidian create`; adapt it for other knowledge bases.

## License

No license has been selected yet. Choose one before publishing a public repository.
