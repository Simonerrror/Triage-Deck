# Live Session

## Short answer

You do not log into the tool separately.

The userscript runs inside the already-open X tab, so it inherits the same authenticated browser session:

- same cookies
- same local storage
- same logged-in browser profile

If `x.com/i/bookmarks` opens normally for you in that browser profile, the script can read the page and act on the visible bookmarks.

## What to do

1. Install a userscript manager in the browser profile where you already use X.
2. Add [`userscript/x-bookmark-tinder.user.js`](../userscript/x-bookmark-tinder.user.js).
3. Manually log into `https://x.com` once in that same browser profile.
4. Open `https://x.com/i/bookmarks`.
5. Wait for the page to load. The overlay should appear in the bottom-right corner.

## What not to do

- Do not enter your X password into this project.
- Do not try to build a fake login form for it.
- Do not run it in a different browser profile and expect it to see the session from another browser.

## Practical implications

### If you are logged into X

The script can:

- inspect visible bookmark cards in the DOM
- open the in-page caret menu
- trigger the same remove-bookmark UI that the page itself exposes
- build markdown for Obsidian from the visible post data

### If you are not logged into X

The script cannot do anything useful. It will only see the logged-out page or redirect flow.

### If you use multiple browser profiles

Install the userscript in the same profile where you actually browse X.

## Obsidian handoff

The script does not need an Obsidian login either.

For the current version:

- it copies the generated markdown to the clipboard
- it sends the markdown to the local bridge at `127.0.0.1:8765`
- the bridge calls the configured local note-creation command
- the public defaults are placeholders:
  - `obsidianVault = YOUR_VAULT_NAME`
  - `obsidianFolder = Inbox/X Bookmarks`

If your vault layout changes later, update these values at the top of the userscript:

- `obsidianVault`
- `obsidianFolder`

Also update the bridge environment variables:

- `XBT_OBSIDIAN_VAULT`
- `XBT_ALLOWED_FOLDER_PREFIX`
- `XBT_OBSIDIAN_BIN`

## Security model

This approach is acceptable because:

- no X password is stored in project files
- no third-party server receives your bookmarks
- no paid API token is needed
- everything runs locally in your own browser session

The tradeoff is fragility: if X changes page structure or menu labels, the script may need selector fixes.
