# Architecture

## Goal

Turn the X bookmarks backlog into a fast review surface with three outcomes:

- defer and keep bookmarked
- delete bookmark
- capture into Obsidian inbox

## Constraints

- no paid X API
- no blind scraping service
- should operate from the user's own authenticated browser session
- should remain usable even if X changes some page details

## Recommended architecture

### 1. Capture layer

Preferred:

- browser extension content script on `https://x.com/i/bookmarks*`

Fallback:

- userscript in Tampermonkey

Responsibilities:

- discover visible bookmark items
- extract stable fields: post URL, author, handle, text, timestamp
- keep a local triage cursor
- expose a small in-page overlay or full-screen mode

### 2. Action layer

Actions should be explicit and reversible where possible.

- `keep`: mark as reviewed locally and advance
- `delete`: trigger the same removal behavior the page already exposes
- `inbox`: create a markdown payload and hand it to Obsidian

For `delete`, prefer driving the existing page action rather than hardcoding undocumented request signatures.

### 3. Obsidian layer

Three options, in order:

1. `obsidian://advanced-uri` with a prepared note body
2. plain `obsidian://new` style deep links if enough for the chosen vault setup
3. a small local helper that appends markdown into a known inbox file

Suggested inbox format:

```md
# X Bookmark

- Author: Name (@handle)
- Saved: 2026-04-22
- URL: https://x.com/...
- Tags: #x #bookmark #triage

> Post text here
```

## MVP phases

### Phase 1

- static prototype with keyboard loop
- sample queue
- live markdown preview
- undo support

### Phase 2

- userscript on top of X bookmarks
- live extraction from DOM
- persisted reviewed state in browser storage

### Phase 3

- one-click Obsidian vault routing
- bulk session stats
- filters for `learn` vs `fun`
- optional category suggestion from heuristics or local model

## Future differentiation

The product becomes materially better if it learns a lightweight classification pass:

- technical thread -> default toward inbox
- meme/video -> default toward keep/delete
- duplicate topic -> suggest delete

That classification can remain local and optional. The core value is still the fast triage loop, not AI for its own sake.
