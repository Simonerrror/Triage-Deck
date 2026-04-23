# Agent Instructions

This repository is a local-first userscript + bridge project. The main job for an agent is usually to adapt it to a specific user's browser, OS, and knowledge-base inbox without introducing a remote backend or paid X API dependency.

## Operating Model

Follow the repo-owned workflow in [`WORKFLOW.md`](WORKFLOW.md). It is the canonical adaptation policy, inspired by OpenAI Symphony's pattern of keeping workflow behavior versioned in the repository.

Before editing code:

- Identify the user's OS, browser, userscript manager, knowledge-base app, and desired inbox destination.
- Decide whether inbox writes should use a CLI command, direct markdown file writes, an Obsidian URI, or a custom local HTTP API.
- Preserve the local-first model unless the user explicitly requests a remote service.
- Do not ask for or store X passwords.
- Do not add paid X API requirements.

## Files To Know

- [`userscript/x-bookmark-tinder.user.js`](userscript/x-bookmark-tinder.user.js): live browser integration and UI.
- [`scripts/obsidian_bridge.py`](scripts/obsidian_bridge.py): local HTTP bridge for markdown persistence.
- [`app/`](app/): static prototype for visual/UI changes.
- [`docs/adaptation-guide.md`](docs/adaptation-guide.md): human and agent adaptation checklist.

## Change Rules

- Prefer configuration changes before structural rewrites.
- Keep OS-specific instructions in docs, not scattered through code comments.
- Keep browser-session behavior explicit: the userscript uses the current logged-in X tab.
- Keep destructive actions conservative. `Delete` and post-save bookmark removal must stay explicit.
- If adapting the bridge to a non-Obsidian target, preserve the `/health` endpoint or replace it with an equivalent.

## Validation

Run these checks after code changes:

```bash
node --check userscript/x-bookmark-tinder.user.js
python3 -m py_compile scripts/obsidian_bridge.py
```

For manual validation, verify:

- the panel appears only on `x.com/i/bookmarks`
- `Keep` advances to the next card
- `Update` rescans visible bookmarks
- the bridge lamp turns green when `/health` is healthy
- `Inbox` creates exactly one markdown note in the configured inbox
- `Delete` removes the bookmark through X's own UI

## Publishing Hygiene

Before pushing public:

- remove local absolute paths from docs
- avoid committing generated files
- choose a license
- ensure no vault names, personal paths, or private handles are embedded as defaults unless intentionally shown as examples
