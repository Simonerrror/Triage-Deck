// ==UserScript==
// @name         X Bookmark Tinder
// @namespace    https://local.hobby.ai/x-bookmark-tinder
// @version      0.2.9
// @description  Triage X bookmarks with arrow keys and send selected posts to Obsidian.
// @match        https://x.com/i/bookmarks*
// @match        https://twitter.com/i/bookmarks*
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @connect      localhost
// @run-at       document-idle
// ==/UserScript==

(() => {
  "use strict";

  const CONFIG = {
    storageKey: "x-bookmark-tinder:v1",
    uiStateKey: "x-bookmark-tinder:ui:v1",
    obsidianVault: "YOUR_VAULT_NAME",
    obsidianFolder: "Inbox/X Bookmarks",
    noteTitlePrefix: "X",
    cliBridgeBaseUrl: "http://127.0.0.1:8765",
    cliBridgeUrl: "http://127.0.0.1:8765/capture",
    cliBridgeHealthUrl: "http://127.0.0.1:8765/health",
    cliBridgeRestartUrl: "http://127.0.0.1:8765/restart",
    cliBridgeToken: "",
    bridgeFallbackToUri: false,
    rescanIntervalMs: 1400,
    bridgeHealthIntervalMs: 15000,
    removeLabels: [
      "Remove Bookmark",
      "Remove bookmark",
      "Remove from Bookmarks",
      "Delete bookmark",
      "Удалить закладку",
      "Удалить из закладок",
    ],
    bookmarkedLabels: [
      "Bookmarked",
      "Remove Bookmark",
      "Remove bookmark",
      "В закладках",
      "Удалить закладку",
      "Удалить из закладок",
    ],
    learningKeywords: [
      "guide",
      "how to",
      "tutorial",
      "thread",
      "workflow",
      "prompt",
      "agent",
      "build",
      "architecture",
      "learn",
      "pattern",
      "обуч",
      "гайд",
      "разбор",
      "архитект",
    ],
  };

  const ui = {};
  const state = {
    queue: [],
    currentIndex: 0,
    history: [],
    stats: {
      keep: 0,
      delete: 0,
      inbox: 0,
    },
    reviewed: loadReviewed(),
    observer: null,
    intervalId: null,
    bridgeHealthIntervalId: null,
    lastHighlightedId: null,
    dismissed: loadUiState(),
    routeActive: false,
    bridge: {
      status: "checking",
      pending: false,
      lastError: "",
      lastCheckedAt: 0,
    },
  };

  const styleText = `
    #xbt-root {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 999999;
      width: min(360px, calc(100vw - 32px));
      color: #f4efe7;
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      pointer-events: none;
    }

    #xbt-root * {
      box-sizing: border-box;
    }

    #xbt-root[hidden] {
      display: none !important;
    }

    #xbt-root[data-mode="launcher"] .xbt-panel {
      display: none;
    }

    #xbt-root[data-mode="panel"] .xbt-launcher {
      display: none;
    }

    .xbt-panel {
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 28px;
      background:
        radial-gradient(circle at top right, rgba(121, 98, 255, 0.12), transparent 34%),
        radial-gradient(circle at bottom left, rgba(79, 128, 255, 0.08), transparent 26%),
        linear-gradient(180deg, rgba(9, 14, 23, 0.98), rgba(11, 17, 27, 0.96));
      box-shadow: 0 28px 72px rgba(0, 0, 0, 0.44);
      backdrop-filter: blur(20px);
      pointer-events: auto;
    }

    .xbt-launcher {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      margin-left: auto;
      padding: 12px 14px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 999px;
      background: rgba(11, 16, 25, 0.94);
      color: #f4efe7;
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.36);
      backdrop-filter: blur(20px);
      font: inherit;
      cursor: pointer;
      pointer-events: auto;
      transition: transform 120ms ease, background 120ms ease;
    }

    .xbt-launcher:hover {
      transform: translateY(-1px);
      background: rgba(16, 22, 35, 0.96);
    }

    .xbt-launcher-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 999px;
      background: rgba(110, 124, 255, 0.16);
      color: #c3c9ff;
      font-size: 0.92rem;
    }

    .xbt-header,
    .xbt-card,
    .xbt-footer {
      padding: 14px 16px;
    }

    .xbt-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .xbt-header-copy {
      min-width: 0;
      flex: 1 1 auto;
    }

    .xbt-kicker,
    .xbt-muted,
    .xbt-log-action {
      letter-spacing: 0.14em;
      text-transform: uppercase;
      font-size: 0.68rem;
    }

    .xbt-kicker {
      color: rgba(212, 190, 145, 0.82);
      margin: 0 0 4px;
    }

    .xbt-title {
      margin: 0;
      font-family: "Iowan Old Style", "Palatino Linotype", serif;
      font-size: 1.55rem;
      line-height: 0.98;
    }

    .xbt-header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 0 0 auto;
    }

    .xbt-icon-button,
    .xbt-close-button,
    .xbt-bridge-indicator {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      width: 34px;
      height: 34px;
      padding: 0;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.04);
      color: #d9d2c6;
      font: inherit;
      font-size: 1rem;
      cursor: pointer;
      transition: transform 120ms ease, background 120ms ease;
    }

    .xbt-icon-button:hover,
    .xbt-close-button:hover,
    .xbt-bridge-indicator:hover {
      transform: translateY(-1px);
      background: rgba(255, 255, 255, 0.08);
    }

    .xbt-icon-button {
      font-size: 0.95rem;
      line-height: 1;
    }

    .xbt-icon-button[data-action="refresh"] {
      color: #d9d2c6;
    }

    .xbt-bridge-indicator {
      position: relative;
    }

    .xbt-close-button {
      font-size: 1.1rem;
      line-height: 1;
    }

    .xbt-bridge-indicator-dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: #d88b31;
      box-shadow: 0 0 0 3px rgba(216, 139, 49, 0.14);
      transition: background 120ms ease, box-shadow 120ms ease, transform 120ms ease;
    }

    .xbt-bridge-indicator[data-status="up"] .xbt-bridge-indicator-dot {
      background: #41d36d;
      box-shadow: 0 0 0 3px rgba(65, 211, 109, 0.14);
    }

    .xbt-bridge-indicator[data-status="down"] .xbt-bridge-indicator-dot {
      background: #e05757;
      box-shadow: 0 0 0 3px rgba(224, 87, 87, 0.16);
    }

    .xbt-bridge-indicator[data-status="checking"] .xbt-bridge-indicator-dot {
      background: #d0a45f;
      box-shadow: 0 0 0 3px rgba(208, 164, 95, 0.16);
      animation: xbt-bridge-pulse 1.2s ease-in-out infinite;
    }

    .xbt-bridge-indicator[data-status="restarting"] .xbt-bridge-indicator-dot {
      background: #d0a45f;
      box-shadow: 0 0 0 3px rgba(208, 164, 95, 0.16);
      animation: xbt-bridge-spin 800ms linear infinite;
    }

    @keyframes xbt-bridge-pulse {
      0%, 100% { transform: scale(1); opacity: 0.82; }
      50% { transform: scale(1.18); opacity: 1; }
    }

    @keyframes xbt-bridge-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .xbt-muted {
      color: #b7b0a3;
      margin: 4px 0 0;
    }

    .xbt-position-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 10px;
    }

    .xbt-position-label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 9px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.04);
      color: #d8d1c6;
      font-size: 0.68rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .xbt-position-label strong {
      color: #f4efe7;
      font-size: 0.72rem;
      letter-spacing: 0.1em;
    }

    .xbt-progress {
      flex: 1 1 auto;
      height: 5px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
    }

    .xbt-progress span {
      display: block;
      width: 0%;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #8fa4ff, #7660d8);
      transition: width 140ms ease;
    }

    .xbt-card {
      display: grid;
      gap: 10px;
    }

    .xbt-category {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: fit-content;
      margin: 0;
      padding: 4px 8px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 999px;
      color: #c8bfaf;
      background: rgba(255, 255, 255, 0.03);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      font-size: 0.58rem;
    }

    .xbt-bookmark-title {
      margin: 0;
      font-family: "Iowan Old Style", "Palatino Linotype", serif;
      font-size: 1.72rem;
      line-height: 0.98;
    }

    .xbt-meta {
      color: #b7b0a3;
      font-size: 0.74rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .xbt-text {
      margin: 0;
      font-size: 0.92rem;
      line-height: 1.5;
      color: #f2ebe2;
    }

    .xbt-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .xbt-link {
      color: #f4efe7;
      text-decoration: none;
      border-bottom: 1px solid rgba(255, 255, 255, 0.35);
    }

    .xbt-handle {
      padding: 7px 11px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.04);
      color: #b7b0a3;
      font-size: 0.76rem;
    }

    .xbt-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 16px 12px;
    }

    .xbt-button {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      flex: 1 1 0;
      min-height: 54px;
      padding: 10px 12px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.04);
      color: #f4efe7;
      font: inherit;
      text-align: center;
      cursor: pointer;
      transition: background 120ms ease, transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
    }

    .xbt-button:hover {
      transform: translateY(-1px);
    }

    .xbt-button:disabled {
      opacity: 0.4;
      cursor: default;
      transform: none;
    }

    .xbt-button:disabled:hover {
      transform: none;
    }

    .xbt-button[data-action="keep"] {
      background: linear-gradient(180deg, rgba(92, 169, 106, 0.88), rgba(71, 139, 84, 0.9));
      border-color: rgba(149, 225, 163, 0.18);
    }

    .xbt-button[data-action="delete"] {
      background: linear-gradient(180deg, rgba(187, 61, 68, 0.92), rgba(156, 43, 50, 0.94));
      border-color: rgba(255, 140, 145, 0.18);
    }

    .xbt-button[data-action="inbox"] {
      background: linear-gradient(180deg, rgba(114, 89, 195, 0.92), rgba(88, 66, 160, 0.94));
      border-color: rgba(181, 168, 255, 0.18);
    }

    .xbt-button-arrow {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 28px;
      width: 28px;
      height: 28px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      background: rgba(255, 255, 255, 0.1);
      font-size: 0.92rem;
      font-weight: 700;
    }

    .xbt-button-label {
      display: inline-flex;
      min-width: 0;
    }

    .xbt-button-title {
      font-size: 0.88rem;
      font-weight: 700;
      letter-spacing: 0.01em;
    }

    .xbt-button-subtitle {
      display: none;
    }

    .xbt-utility-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 0 16px 10px;
    }

    .xbt-utility-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
    }

    .xbt-utility-button {
      padding: 8px 11px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.04);
      color: #cfc7bb;
      font: inherit;
      font-size: 0.72rem;
      cursor: pointer;
      transition: background 120ms ease, border-color 120ms ease, transform 120ms ease;
    }

    .xbt-utility-button:hover {
      transform: translateY(-1px);
      background: rgba(255, 255, 255, 0.08);
    }

    .xbt-utility-button[hidden] {
      display: none;
    }

    .xbt-utility-button--undo {
      color: #efe5d7;
      border-color: rgba(244, 208, 111, 0.28);
      background: rgba(244, 208, 111, 0.08);
    }

    .xbt-utility-button--undo:hover {
      background: rgba(244, 208, 111, 0.14);
      border-color: rgba(244, 208, 111, 0.4);
    }

    .xbt-hint {
      color: #9f978a;
      font-size: 0.68rem;
      line-height: 1.35;
    }

    .xbt-footer {
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      display: grid;
      gap: 8px;
    }

    .xbt-stats {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .xbt-stats article {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 0;
      border-radius: 0;
      background: transparent;
    }

    .xbt-stats strong {
      display: inline;
      margin-top: 0;
      font-size: 0.82rem;
      font-family: inherit;
    }

    .xbt-log {
      display: block;
      max-height: none;
      overflow: visible;
      color: #ddd5c8;
      font-size: 0.78rem;
      line-height: 1.45;
    }

    .xbt-log-item {
      padding-top: 0;
      border-top: 0;
    }

    .xbt-log-item:first-child {
      border-top: 0;
      padding-top: 0;
    }

    .xbt-log-action {
      display: inline;
      color: #d3bf9a;
      margin-bottom: 0;
    }

    .xbt-toast {
      position: fixed;
      left: 50%;
      bottom: 24px;
      transform: translateX(-50%);
      z-index: 1000000;
      max-width: min(520px, calc(100vw - 32px));
      padding: 12px 16px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 999px;
      background: rgba(10, 13, 22, 0.92);
      color: #f4efe7;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.44);
      backdrop-filter: blur(16px);
      opacity: 0;
      pointer-events: none;
      transition: opacity 140ms ease;
    }

    .xbt-toast[data-visible="true"] {
      opacity: 1;
    }

    article[data-xbt-active="true"] {
      outline: 2px solid rgba(255, 141, 93, 0.72);
      outline-offset: 6px;
      border-radius: 22px;
      transition: outline-color 160ms ease;
    }

    @media (max-width: 720px) {
      #xbt-root {
        right: 12px;
        left: 12px;
        width: auto;
      }

      .xbt-position-row,
      .xbt-utility-row {
        display: grid;
        gap: 10px;
      }

      .xbt-utility-actions {
        margin-left: 0;
      }

      .xbt-actions {
        gap: 8px;
      }

      .xbt-actions {
        justify-content: stretch;
      }
    }
  `;

  function loadReviewed() {
    try {
      const raw = window.localStorage.getItem(CONFIG.storageKey);
      const parsed = raw ? JSON.parse(raw) : {};
      return typeof parsed === "object" && parsed ? parsed : {};
    } catch {
      return {};
    }
  }

  function loadUiState() {
    try {
      const raw = window.sessionStorage.getItem(CONFIG.uiStateKey);
      const parsed = raw ? JSON.parse(raw) : {};
      return Boolean(parsed?.dismissed);
    } catch {
      return false;
    }
  }

  function saveUiState() {
    window.sessionStorage.setItem(
      CONFIG.uiStateKey,
      JSON.stringify({ dismissed: state.dismissed })
    );
  }

  function saveReviewed() {
    window.localStorage.setItem(CONFIG.storageKey, JSON.stringify(state.reviewed));
  }

  function isBookmarksRoute() {
    return /^\/i\/bookmarks\/?$/.test(window.location.pathname);
  }

  function syncUiMode() {
    if (!ui.root) {
      return;
    }

    ui.root.hidden = !state.routeActive;
    ui.root.dataset.mode = state.dismissed ? "launcher" : "panel";
  }

  function setDismissed(nextValue) {
    state.dismissed = Boolean(nextValue);
    saveUiState();
    syncUiMode();
  }

  function syncRouteState() {
    const nextRouteActive = isBookmarksRoute();
    if (state.routeActive === nextRouteActive) {
      syncUiMode();
      return nextRouteActive;
    }

    state.routeActive = nextRouteActive;
    if (!state.routeActive) {
      clearHighlight();
    } else {
      scanQueue();
    }

    syncUiMode();
    return nextRouteActive;
  }

  function isEditableTarget(target) {
    return Boolean(
      target &&
      (
        target.closest("input, textarea, [contenteditable='true']") ||
        target.isContentEditable
      )
    );
  }

  function formatDate(dateValue) {
    if (!dateValue) {
      return "Unknown date";
    }

    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) {
      return dateValue;
    }

    return parsed.toISOString().slice(0, 10);
  }

  function looksLikeLearning(text) {
    const normalized = text.toLowerCase();
    return CONFIG.learningKeywords.some((keyword) => normalized.includes(keyword));
  }

  function escapeYamlString(value) {
    return JSON.stringify(String(value ?? ""));
  }

  function fileSafeSegment(value) {
    return String(value ?? "")
      .replace(/^@/, "")
      .replace(/[\\/:*?"<>|#^[\]]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function titleCaseKind(kind) {
    return kind === "learn" ? "Learn" : "Fun";
  }

  function buildInboxMarkdown(bookmark) {
    const kind = bookmark.kind;
    const capturedAt = new Date().toISOString();

    return [
      "---",
      "type: x-bookmark",
      "status: inbox",
      `kind: ${kind}`,
      "source: x",
      "triage_source: x-bookmark-tinder",
      `author: ${escapeYamlString(bookmark.author)}`,
      `handle: ${escapeYamlString(bookmark.handle.replace(/^@/, ""))}`,
      `url: ${escapeYamlString(bookmark.url)}`,
      `tweet_date: ${escapeYamlString(bookmark.date)}`,
      `captured: ${escapeYamlString(capturedAt)}`,
      `x_status_id: ${escapeYamlString(bookmark.id)}`,
      "tags:",
      "  - x",
      "  - inbox",
      `  - ${kind}`,
      "---",
      "",
      `# ${bookmark.title}`,
      "",
      "## Tweet",
      "",
      bookmark.text,
      "",
      "## Why saved",
      "",
      "- ",
      "",
      "## Extract",
      "",
      "- ",
      "",
      "## Next",
      "",
      "- [ ] Move insight to a topic note",
      "- [ ] Keep as source if still useful",
      "- [ ] Archive or delete",
    ].join("\n");
  }

  function escapeUriValue(value) {
    return encodeURIComponent(value);
  }

  function buildObsidianUri(bookmark, markdown) {
    const handleSegment = fileSafeSegment(bookmark.handle) || "unknown";
    const titleSegment = fileSafeSegment(bookmark.title).slice(0, 72) || "bookmark";
    const fileName = `${bookmark.date} ${CONFIG.noteTitlePrefix} ${handleSegment} ${bookmark.id} ${titleSegment}`.slice(0, 180);
    const params = [
      `name=${escapeUriValue(fileName)}`,
      `content=${escapeUriValue(markdown)}`,
    ];

    if (CONFIG.obsidianVault) {
      params.push(`vault=${escapeUriValue(CONFIG.obsidianVault)}`);
    }

    if (CONFIG.obsidianFolder) {
      params.push(`folder=${escapeUriValue(CONFIG.obsidianFolder)}`);
    }

    return `obsidian://new?${params.join("&")}`;
  }

  function buildBridgePayload(bookmark, markdown) {
    const handleSegment = fileSafeSegment(bookmark.handle) || "unknown";
    const titleSegment = fileSafeSegment(bookmark.title).slice(0, 72) || "bookmark";
    const fileName = `${bookmark.date} ${CONFIG.noteTitlePrefix} ${handleSegment} ${bookmark.id} ${titleSegment}.md`.slice(0, 183);

    return {
      vault: CONFIG.obsidianVault,
      folder: CONFIG.obsidianFolder,
      file_name: fileName,
      content: markdown,
    };
  }

  function showToast(message) {
    if (!ui.toast) {
      return;
    }

    ui.toast.textContent = message;
    ui.toast.dataset.visible = "true";
    window.clearTimeout(showToast.timerId);
    showToast.timerId = window.setTimeout(() => {
      ui.toast.dataset.visible = "false";
    }, 2600);
  }

  function getStatusId(url) {
    const match = url.match(/status\/(\d+)/);
    return match ? match[1] : null;
  }

  function pickStatusLink(article) {
    const anchors = Array.from(article.querySelectorAll("a[href*='/status/']"));
    return anchors.find((anchor) => getStatusId(anchor.href));
  }

  function extractUserNameParts(article) {
    const container = article.querySelector("[data-testid='User-Name']");
    if (!container) {
      return { author: "Unknown author", handle: "@unknown" };
    }

    const texts = Array.from(container.querySelectorAll("span"))
      .map((node) => node.textContent.trim())
      .filter(Boolean)
      .filter((text) => text !== "·");

    const handle = texts.find((text) => text.startsWith("@")) || "@unknown";
    const author = texts.find((text) => !text.startsWith("@") && text !== "Follow") || "Unknown author";
    return { author, handle };
  }

  function extractBookmark(article) {
    const link = pickStatusLink(article);
    if (!link) {
      return null;
    }

    const url = link.href;
    const id = getStatusId(url);
    if (!id) {
      return null;
    }

    const { author, handle } = extractUserNameParts(article);
    const textNode = article.querySelector("[data-testid='tweetText']");
    const text = textNode ? textNode.innerText.trim() : "";
    const timeNode = article.querySelector("time");
    const date = formatDate(timeNode?.getAttribute("datetime"));
    const title = text
      ? text.split(/\s+/).slice(0, 7).join(" ")
      : `${author} bookmark`;
    const kind = looksLikeLearning(`${title} ${text}`) ? "learn" : "fun";
    const category = titleCaseKind(kind);

    return {
      id,
      url,
      author,
      handle,
      title,
      date,
      text: text || "(No extracted text. Open the post to inspect media or quoted content.)",
      kind,
      category,
      element: article,
    };
  }

  function scanQueue() {
    const articles = Array.from(document.querySelectorAll("article[data-testid='tweet']"));
    const nextQueue = [];
    const seen = new Set();

    for (const article of articles) {
      const bookmark = extractBookmark(article);
      if (!bookmark || seen.has(bookmark.id)) {
        continue;
      }

      seen.add(bookmark.id);
      if (!state.reviewed[bookmark.id]) {
        nextQueue.push(bookmark);
      }
    }

    state.queue = nextQueue;
    if (state.currentIndex >= state.queue.length) {
      state.currentIndex = Math.max(state.queue.length - 1, 0);
    }
  }

  function currentBookmark() {
    return state.queue[state.currentIndex] || null;
  }

  function clearHighlight() {
    if (!state.lastHighlightedId) {
      return;
    }

    const oldNode = document.querySelector(`article[data-xbt-id='${state.lastHighlightedId}']`);
    if (oldNode) {
      oldNode.removeAttribute("data-xbt-active");
    }
  }

  function highlightCurrent(bookmark) {
    const previousId = state.lastHighlightedId;
    clearHighlight();

    if (!bookmark?.element) {
      state.lastHighlightedId = null;
      return;
    }

    bookmark.element.dataset.xbtId = bookmark.id;
    bookmark.element.dataset.xbtActive = "true";
    state.lastHighlightedId = bookmark.id;

    if (bookmark.id !== previousId) {
      bookmark.element.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  function renderLog() {
    ui.log.innerHTML = "";

    if (state.history.length === 0) {
      const node = document.createElement("div");
      node.className = "xbt-log-item";
      node.innerHTML = `
        <span class="xbt-log-action">Ready:</span>
        <span>Use arrow keys or click buttons.</span>
      `;
      ui.log.appendChild(node);
      return;
    }

    const entry = state.history[state.history.length - 1];
    const node = document.createElement("div");
    node.className = "xbt-log-item";
    node.innerHTML = `
      <span class="xbt-log-action">${entry.action}:</span>
      <span>${entry.title}</span>
    `;
    ui.log.appendChild(node);
  }

  function bridgeStatusLabel() {
    if (state.bridge.status === "up") {
      return "Bridge active";
    }

    if (state.bridge.status === "restarting") {
      return "Bridge restarting";
    }

    if (state.bridge.status === "checking") {
      return "Checking bridge";
    }

    return "Bridge down";
  }

  function renderBridgeStatus() {
    if (!ui.bridgeIndicator) {
      return;
    }

    const label = bridgeStatusLabel();
    const title = state.bridge.lastError
      ? `${label}. ${state.bridge.lastError}`
      : label;

    ui.bridgeIndicator.dataset.status = state.bridge.status;
    ui.bridgeIndicator.setAttribute("aria-label", title);
    ui.bridgeIndicator.setAttribute("title", title);
  }

  function renderStats() {
    const queueCount = state.queue.length ? state.queue.length : 0;
    ui.queue.textContent = String(queueCount);
    ui.kept.textContent = String(state.stats.keep);
    ui.deleted.textContent = String(state.stats.delete);
    ui.inboxed.textContent = String(state.stats.inbox);

    const progress = state.queue.length
      ? (state.currentIndex / state.queue.length) * 100
      : 0;
    ui.progress.style.width = `${Math.max(0, Math.min(progress, 100))}%`;
  }

  function canUndoSafely() {
    const last = state.history[state.history.length - 1];
    return last?.actionType === "keep";
  }

  function renderControls(bookmark) {
    const hasBookmark = Boolean(bookmark);
    if (ui.keepButton) {
      ui.keepButton.disabled = !hasBookmark;
    }
    if (ui.deleteButton) {
      ui.deleteButton.disabled = !hasBookmark;
    }
    if (ui.inboxButton) {
      ui.inboxButton.disabled = !hasBookmark;
    }
    if (ui.undoButton) {
      ui.undoButton.hidden = !canUndoSafely();
    }
  }

  function renderBookmark(bookmark) {
    if (!bookmark) {
      ui.position.textContent = "No visible bookmarks in queue";
      ui.category.textContent = "Waiting";
      ui.category.dataset.kind = "waiting";
      ui.bookmarkTitle.textContent = "Scroll the X bookmarks page";
      ui.meta.textContent = "The script only reads visible bookmark cards that are not already marked as reviewed.";
      ui.text.textContent = "Scroll to load more bookmarks, press Update to rescan, or Shift-click Update to restart the reviewed state for the visible set.";
      ui.link.href = location.href;
      ui.link.textContent = "Open bookmarks";
      ui.handle.textContent = "@session";
      highlightCurrent(null);
      return;
    }

    ui.position.textContent = `Bookmark ${state.currentIndex + 1} of ${state.queue.length}`;
    ui.category.textContent = bookmark.category;
    ui.category.dataset.kind = bookmark.kind;
    ui.bookmarkTitle.textContent = bookmark.title;
    ui.meta.textContent = `${bookmark.author}  ${bookmark.date}`;
    ui.text.textContent = bookmark.text;
    ui.link.href = bookmark.url;
    ui.link.textContent = "Open original post";
    ui.handle.textContent = bookmark.handle;
    highlightCurrent(bookmark);
  }

  function render() {
    if (!state.routeActive || !ui.root) {
      return;
    }

    const bookmark = currentBookmark();
    renderBridgeStatus();
    renderStats();
    renderBookmark(bookmark);
    renderControls(bookmark);
    renderLog();
  }

  function markReviewed(bookmark, action) {
    state.reviewed[bookmark.id] = {
      action,
      date: new Date().toISOString(),
      url: bookmark.url,
    };
    saveReviewed();
  }

  function removeReviewed(bookmark) {
    delete state.reviewed[bookmark.id];
    saveReviewed();
  }

  function syncAfterMutation() {
    if (!syncRouteState()) {
      return;
    }

    const current = currentBookmark();
    const currentId = current?.id || null;
    scanQueue();

    if (currentId) {
      const index = state.queue.findIndex((item) => item.id === currentId);
      state.currentIndex = index >= 0 ? index : Math.min(state.currentIndex, Math.max(state.queue.length - 1, 0));
    }

    render();
  }

  async function tryClipboardWrite(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  function buildBridgeHeaders() {
    const headers = {
      "Content-Type": "application/json",
    };

    if (CONFIG.cliBridgeToken) {
      headers["X-XBT-Token"] = CONFIG.cliBridgeToken;
    }

    return headers;
  }

  async function requestBridge({ url, method = "GET", payload = null, timeoutMs = 5000 }) {
    const headers = buildBridgeHeaders();
    const data = payload === null ? null : JSON.stringify(payload);

    if (typeof GM_xmlhttpRequest === "function") {
      const response = await new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          url,
          method,
          headers,
          data,
          timeout: timeoutMs,
          responseType: "json",
          onload: (result) => resolve(result),
          onerror: () => reject(new Error("GM bridge request failed")),
          ontimeout: () => reject(new Error("GM bridge request timed out")),
          onabort: () => reject(new Error("GM bridge request aborted")),
        });
      });

      const responsePayload =
        response.response && typeof response.response === "object"
          ? response.response
          : (() => {
              try {
                return JSON.parse(response.responseText || "null");
              } catch {
                return null;
              }
            })();

      return {
        ok: (response.status || 0) >= 200 && (response.status || 0) < 300,
        status: response.status || 0,
        payload: responsePayload,
      };
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: data,
        signal: controller.signal,
      });

      let responsePayload = null;
      try {
        responsePayload = await response.json();
      } catch {
        responsePayload = null;
      }

      return {
        ok: response.ok,
        status: response.status,
        payload: responsePayload,
      };
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  function triggerObsidianUri(uri) {
    const anchor = document.createElement("a");
    anchor.href = uri;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  async function sendToCliBridge(bookmark, markdown) {
    const response = await requestBridge({
      url: CONFIG.cliBridgeUrl,
      method: "POST",
      payload: buildBridgePayload(bookmark, markdown),
    });

    if (!response.ok) {
      throw new Error(response.payload?.error || `Bridge request failed with ${response.status || "unknown status"}`);
    }

    return response.payload;
  }

  async function sendBookmarkToObsidian(bookmark) {
    const markdown = buildInboxMarkdown(bookmark);
    const clipboardPromise = tryClipboardWrite(markdown);

    if (CONFIG.cliBridgeUrl) {
      try {
        await sendToCliBridge(bookmark, markdown);
        state.bridge.status = "up";
        state.bridge.lastError = "";
        state.bridge.lastCheckedAt = Date.now();
        renderBridgeStatus();
        const copied = await clipboardPromise;
        showToast(copied ? "Saved to Obsidian via local bridge. Markdown copied." : "Saved to Obsidian via local bridge.");
        return true;
      } catch (error) {
        state.bridge.status = "down";
        state.bridge.lastError = error.message;
        state.bridge.lastCheckedAt = Date.now();
        renderBridgeStatus();
        if (!CONFIG.bridgeFallbackToUri) {
          const copied = await clipboardPromise;
          showToast(
            copied
              ? `Bridge failed: ${error.message}. Markdown copied.`
              : `Bridge failed: ${error.message}.`
          );
          return false;
        }
      }
    }

    const uri = buildObsidianUri(bookmark, markdown);
    triggerObsidianUri(uri);

    const copied = await clipboardPromise;
    showToast(copied ? "Markdown copied and Obsidian opened." : "Tried to open Obsidian. Clipboard copy failed.");
    return true;
  }

  function normalizeLabel(text) {
    return text.replace(/\s+/g, " ").trim().toLowerCase();
  }

  function findBookmarkToggleButton(bookmark) {
    const candidates = Array.from(bookmark.element.querySelectorAll("button"));
    return candidates.find((button) => {
      const label = normalizeLabel(
        button.getAttribute("aria-label") ||
        button.getAttribute("title") ||
        button.innerText ||
        button.textContent ||
        ""
      );

      const dataTestId = normalizeLabel(button.getAttribute("data-testid") || "");
      if (dataTestId === "removebookmark") {
        return true;
      }

      return CONFIG.bookmarkedLabels.some((candidate) => label.includes(candidate.toLowerCase()));
    }) || null;
  }

  async function removeBookmarkViaUi(bookmark) {
    const toggleButton = findBookmarkToggleButton(bookmark);
    if (toggleButton) {
      toggleButton.click();
      await wait(180);
      return true;
    }

    const caretButton = bookmark.element.querySelector("[data-testid='caret']");
    if (!caretButton) {
      return false;
    }

    caretButton.click();
    await wait(180);

    const menuItems = Array.from(document.querySelectorAll("[role='menuitem'], div[tabindex='-1']"));
    const targetItem = menuItems.find((item) => {
      const label = normalizeLabel(item.innerText || item.textContent || "");
      return CONFIG.removeLabels.some((candidate) => label.includes(candidate.toLowerCase()));
    });

    if (!targetItem) {
      document.body.click();
      return false;
    }

    targetItem.click();
    return true;
  }

  function recordHistory(actionLabel, bookmark, actionType) {
    state.history.push({
      action: actionLabel,
      actionType,
      title: bookmark.title,
      bookmark,
      index: state.currentIndex,
    });
  }

  function advanceQueueAfterAction(bookmarkId, previousIndex) {
    state.queue = state.queue.filter((item) => item.id !== bookmarkId);

    if (state.queue.length === 0) {
      state.currentIndex = 0;
      return;
    }

    state.currentIndex = Math.min(previousIndex, state.queue.length - 1);
  }

  async function takeAction(actionType) {
    if (!state.routeActive || state.dismissed) {
      return;
    }

    const bookmark = currentBookmark();
    const previousIndex = state.currentIndex;
    if (!bookmark) {
      showToast("No bookmark selected yet. Scroll the page to load more items.");
      return;
    }

    if (actionType === "delete") {
      const removed = await removeBookmarkViaUi(bookmark);
      if (!removed) {
        showToast("Could not find the remove-bookmark menu item. X probably changed the UI labels.");
        return;
      }
    }

    if (actionType === "inbox") {
      const delivered = await sendBookmarkToObsidian(bookmark);
      if (!delivered) {
        return;
      }

      const removed = await removeBookmarkViaUi(bookmark);
      if (!removed) {
        showToast("Saved to Obsidian, but could not remove the bookmark from X.");
        return;
      }
    }

    markReviewed(bookmark, actionType);
    state.stats[actionType] += 1;

    recordHistory(
      actionType === "keep"
        ? "Kept in X"
        : actionType === "delete"
          ? "Deleted"
          : "Sent to inbox and removed from X",
      bookmark,
      actionType
    );

    advanceQueueAfterAction(bookmark.id, previousIndex);
    render();
  }

  function undoLastAction() {
    if (!state.routeActive || state.dismissed) {
      return;
    }

    const last = state.history[state.history.length - 1];
    if (!last) {
      showToast("Nothing to undo.");
      return;
    }

    if (last.actionType === "delete" || last.actionType === "inbox") {
      showToast("Only Keep can be undone in this version.");
      return;
    }

    state.history.pop();
    removeReviewed(last.bookmark);
    state.stats[last.actionType] = Math.max(0, state.stats[last.actionType] - 1);
    scanQueue();
    const restoredIndex = state.queue.findIndex((item) => item.id === last.bookmark.id);
    state.currentIndex = restoredIndex >= 0 ? restoredIndex : 0;
    render();
  }

  function restartQueue() {
    if (!state.routeActive || state.dismissed) {
      return;
    }

    state.queue = [];
    state.currentIndex = 0;
    state.history = [];
    state.stats.keep = 0;
    state.stats.delete = 0;
    state.stats.inbox = 0;
    state.reviewed = {};
    saveReviewed();
    scanQueue();
    render();
    showToast("Bookmark queue restarted from the beginning.");
  }

  function refreshQueue() {
    if (!state.routeActive || state.dismissed) {
      return;
    }

    scanQueue();
    render();
    showToast("Queue updated from visible bookmarks.");
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function checkBridgeHealth({ silent = false } = {}) {
    if (!CONFIG.cliBridgeHealthUrl || state.bridge.pending) {
      return state.bridge.status === "up";
    }

    state.bridge.pending = true;
    state.bridge.status = silent ? state.bridge.status : "checking";
    renderBridgeStatus();

    try {
      const response = await requestBridge({
        url: CONFIG.cliBridgeHealthUrl,
        method: "GET",
        payload: null,
        timeoutMs: 2500,
      });

      const healthy = response.ok && response.payload?.ok;
      state.bridge.status = healthy ? "up" : "down";
      state.bridge.lastError = healthy
        ? ""
        : response.payload?.vault_error || response.payload?.error || `Bridge health returned ${response.status || "unknown status"}`;
      state.bridge.lastCheckedAt = Date.now();
      renderBridgeStatus();
      return healthy;
    } catch (error) {
      state.bridge.status = "down";
      state.bridge.lastError = error.message;
      state.bridge.lastCheckedAt = Date.now();
      renderBridgeStatus();
      return false;
    } finally {
      state.bridge.pending = false;
    }
  }

  async function requestBridgeRestart() {
    if (!CONFIG.cliBridgeRestartUrl) {
      return false;
    }

    try {
      const response = await requestBridge({
        url: CONFIG.cliBridgeRestartUrl,
        method: "POST",
        payload: {},
        timeoutMs: 2500,
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  async function handleBridgeIndicatorClick() {
    if (state.bridge.pending || state.bridge.status === "restarting") {
      return;
    }

    if (state.bridge.status === "up") {
      await checkBridgeHealth();
      showToast("Bridge is active.");
      return;
    }

    state.bridge.status = "restarting";
    state.bridge.lastError = "";
    renderBridgeStatus();

    const restartAccepted = await requestBridgeRestart();
    if (restartAccepted) {
      await wait(500);
      const healthy = await checkBridgeHealth();
      showToast(healthy ? "Bridge restarted." : "Restart requested, but bridge is still red.");
      return;
    }

    const healthy = await checkBridgeHealth();
    if (healthy) {
      showToast("Bridge is active again.");
      return;
    }

    const restartCommand = "cd /path/to/x-bookmark-tinder && python3 scripts/obsidian_bridge.py";
    const copied = await tryClipboardWrite(restartCommand);
    showToast(copied ? "Bridge is down. Restart command copied." : "Bridge is down. Start local bridge from terminal.");
  }

  function installUi() {
    if (document.querySelector("#xbt-root")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "xbt-style";
    style.textContent = styleText;
    document.head.appendChild(style);

    const root = document.createElement("section");
    root.id = "xbt-root";
    root.innerHTML = `
      <button class="xbt-launcher" type="button" aria-label="Open bookmark triage">
        <span class="xbt-launcher-icon">↺</span>
        <span>Open triage</span>
      </button>
      <div class="xbt-panel">
        <div class="xbt-header">
          <div class="xbt-header-copy">
            <p class="xbt-kicker">Bookmark triage</p>
            <h2 class="xbt-title">X Bookmark Tinder</h2>
            <div class="xbt-position-row">
              <div id="xbt-position" class="xbt-position-label"><strong>Waiting</strong></div>
              <div class="xbt-progress" aria-hidden="true"><span></span></div>
            </div>
          </div>
          <div class="xbt-header-actions">
            <button class="xbt-utility-button xbt-utility-button--undo" data-action="undo" hidden>Undo</button>
            <button class="xbt-icon-button" type="button" data-action="refresh" aria-label="Update queue" title="Update queue. Shift-click to restart reviewed state.">↻</button>
            <button class="xbt-bridge-indicator" type="button" data-action="bridge-status" aria-label="Checking bridge" title="Checking bridge">
              <span class="xbt-bridge-indicator-dot" aria-hidden="true"></span>
            </button>
            <button class="xbt-close-button" type="button" data-action="close" aria-label="Close triage" title="Close triage">×</button>
          </div>
        </div>
        <div class="xbt-card">
          <p class="xbt-category" id="xbt-category">Waiting</p>
          <h3 class="xbt-bookmark-title" id="xbt-bookmark-title">Load bookmarks</h3>
          <div class="xbt-meta" id="xbt-meta">Use the same browser profile where you are already logged into X.</div>
          <p class="xbt-text" id="xbt-text">Arrow keys work only when the page is open and bookmark cards are visible.</p>
          <div class="xbt-row">
            <a id="xbt-link" class="xbt-link" href="${location.href}" target="_blank" rel="noreferrer">Open bookmarks</a>
            <span id="xbt-handle" class="xbt-handle">@session</span>
          </div>
        </div>
        <div class="xbt-actions">
          <button class="xbt-button" data-action="keep" aria-label="Keep, left arrow">
            <span class="xbt-button-arrow">←</span>
            <span class="xbt-button-label">
              <span class="xbt-button-title">Keep</span>
            </span>
          </button>
          <button class="xbt-button" data-action="inbox" aria-label="Inbox, down arrow">
            <span class="xbt-button-arrow">↓</span>
            <span class="xbt-button-label">
              <span class="xbt-button-title">Inbox</span>
            </span>
          </button>
          <button class="xbt-button" data-action="delete" aria-label="Delete, right arrow">
            <span class="xbt-button-arrow">→</span>
            <span class="xbt-button-label">
              <span class="xbt-button-title">Delete</span>
            </span>
          </button>
        </div>
        <div class="xbt-utility-row">
          <div class="xbt-hint">Arrow keys match the button layout.</div>
        </div>
        <div class="xbt-footer">
          <div class="xbt-stats">
            <article><span class="xbt-muted">Queue:</span><strong id="xbt-queue">0</strong></article>
            <article><span class="xbt-muted">Kept</span><strong id="xbt-kept">0</strong></article>
            <article><span class="xbt-muted">Deleted</span><strong id="xbt-deleted">0</strong></article>
            <article><span class="xbt-muted">Inboxed</span><strong id="xbt-inboxed">0</strong></article>
          </div>
          <div class="xbt-log" id="xbt-log"></div>
        </div>
      </div>
    `;

    const toast = document.createElement("div");
    toast.className = "xbt-toast";
    toast.dataset.visible = "false";

    document.body.appendChild(root);
    document.body.appendChild(toast);

    ui.root = root;
    ui.launcher = root.querySelector(".xbt-launcher");
    ui.panel = root.querySelector(".xbt-panel");
    ui.position = root.querySelector("#xbt-position");
    ui.progress = root.querySelector(".xbt-progress span");
    ui.category = root.querySelector("#xbt-category");
    ui.bookmarkTitle = root.querySelector("#xbt-bookmark-title");
    ui.meta = root.querySelector("#xbt-meta");
    ui.text = root.querySelector("#xbt-text");
    ui.link = root.querySelector("#xbt-link");
    ui.handle = root.querySelector("#xbt-handle");
    ui.queue = root.querySelector("#xbt-queue");
    ui.kept = root.querySelector("#xbt-kept");
    ui.deleted = root.querySelector("#xbt-deleted");
    ui.inboxed = root.querySelector("#xbt-inboxed");
    ui.log = root.querySelector("#xbt-log");
    ui.toast = toast;
    ui.keepButton = root.querySelector(".xbt-button[data-action='keep']");
    ui.deleteButton = root.querySelector(".xbt-button[data-action='delete']");
    ui.inboxButton = root.querySelector(".xbt-button[data-action='inbox']");
    ui.undoButton = root.querySelector(".xbt-utility-button[data-action='undo']");
    ui.bridgeIndicator = root.querySelector(".xbt-bridge-indicator");
    ui.closeButton = root.querySelector(".xbt-close-button");

    ui.launcher.addEventListener("click", () => {
      setDismissed(false);
      render();
      showToast("Triage panel restored.");
    });

    root.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", async (event) => {
        if (button.disabled) {
          return;
        }

        const action = button.dataset.action;
        if (action === "undo") {
          undoLastAction();
          return;
        }

        if (action === "refresh") {
          if (event.shiftKey) {
            restartQueue();
            return;
          }

          refreshQueue();
          return;
        }

        if (action === "bridge-status") {
          await handleBridgeIndicatorClick();
          return;
        }

        if (action === "close") {
          setDismissed(true);
          showToast("Triage panel hidden. Use Open triage to bring it back.");
          return;
        }

        await takeAction(action);
      });
    });

    syncUiMode();
  }

  function installKeyboard() {
    document.addEventListener("keydown", async (event) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (!state.routeActive || state.dismissed) {
        return;
      }

      const keyMap = {
        ArrowLeft: "keep",
        ArrowRight: "delete",
        ArrowDown: "inbox",
        ArrowUp: "undo",
      };

      const action = keyMap[event.key];
      if (!action) {
        return;
      }

      event.preventDefault();

      if (action === "undo") {
        undoLastAction();
        return;
      }

      await takeAction(action);
    });
  }

  function installRouteListeners() {
    const schedule = () => {
      window.clearTimeout(installRouteListeners.timerId);
      installRouteListeners.timerId = window.setTimeout(() => {
        const routeActive = syncRouteState();
        if (routeActive) {
          render();
        }
      }, 60);
    };

    const originalPushState = history.pushState;
    history.pushState = function (...args) {
      const result = originalPushState.apply(this, args);
      schedule();
      return result;
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function (...args) {
      const result = originalReplaceState.apply(this, args);
      schedule();
      return result;
    };

    window.addEventListener("popstate", schedule);
    window.addEventListener("hashchange", schedule);
  }

  function installMutationObserver() {
    state.observer = new MutationObserver(() => {
      window.clearTimeout(installMutationObserver.timerId);
      installMutationObserver.timerId = window.setTimeout(syncAfterMutation, 120);
    });

    state.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    state.intervalId = window.setInterval(syncAfterMutation, CONFIG.rescanIntervalMs);
    state.bridgeHealthIntervalId = window.setInterval(() => {
      if (state.routeActive && !state.dismissed) {
        checkBridgeHealth({ silent: true });
      }
    }, CONFIG.bridgeHealthIntervalMs);
  }

  function boot() {
    installUi();
    installKeyboard();
    installRouteListeners();
    syncRouteState();
    if (state.routeActive) {
      scanQueue();
      render();
      checkBridgeHealth({ silent: false });
    }
    installMutationObserver();
    if (state.routeActive) {
      showToast("Live X session attached. No separate login required.");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
