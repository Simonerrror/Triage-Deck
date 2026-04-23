const SAMPLE_BOOKMARKS = [
  {
    id: "b1",
    category: "Fun",
    title: "Я полностью отказался от Claude, думал, что не привыкну, но больше не собираюсь возвращаться",
    author: "Bruno Pinheiro",
    handle: "@brunopinheiroms",
    date: "2026-04-21",
    url: "https://x.com/brunopinheiroms/status/191982144",
    tags: ["ai", "tools", "workflow"],
    text:
      "Я полностью отказался от Claude, думал, что не привыкну, но больше не собираюсь возвращаться. Claude очень хорош, но дорогой и медленный. Использую сейчас OpenCode Go, Kimi 4.6, GLM 5.1 и Codex 5.4. С Caveman и Rtk трачу сильно меньше токенов.",
  },
  {
    id: "b2",
    category: "Learning",
    title: "Obsidian capture pattern for links you actually want to revisit",
    author: "Lena Cho",
    handle: "@lenacho",
    date: "2026-04-18",
    url: "https://x.com/lenacho/status/191770441",
    tags: ["obsidian", "notes", "system"],
    text:
      "My default rule now: source link, quote, then one sentence about why it matters to future me. Without that third line, an inbox becomes a museum of fragments instead of a working note system.",
  },
  {
    id: "b3",
    category: "Fun",
    title: "Peak internet nonsense achieved via a tiny stock-market DVD logo",
    author: "Milo",
    handle: "@miloonline",
    date: "2026-04-16",
    url: "https://x.com/miloonline/status/191552920",
    tags: ["fun", "web", "meme"],
    text:
      "Someone rebuilt the DVD logo bounce as a stock market widget. It only turns green if the square hits the corner. There is no practical value here at all, which is exactly why it is perfect.",
  },
  {
    id: "b4",
    category: "Learning",
    title: "Planner / worker / reviewer is the cleanest agent split I have used",
    author: "Anya Petrov",
    handle: "@anyapetrov",
    date: "2026-04-14",
    url: "https://x.com/anyapetrov/status/191238401",
    tags: ["agents", "design", "automation"],
    text:
      "A planner chooses intent, workers own narrow side effects, and a reviewer checks irreversible steps. If one prompt tries to do all three jobs, the system becomes muddy and hard to trust.",
  },
];

const state = {
  queue: [...SAMPLE_BOOKMARKS],
  currentIndex: 0,
  kept: [],
  deleted: [],
  inboxed: [],
  history: [],
  dismissed: false,
};

const ui = {
  triageShell: document.querySelector(".triage-shell"),
  triageLauncher: document.querySelector("#triage-launcher"),
  keptCount: document.querySelector("#kept-count"),
  deletedCount: document.querySelector("#deleted-count"),
  inboxedCount: document.querySelector("#inboxed-count"),
  progressBar: document.querySelector("#progress-bar"),
  bookmarkPosition: document.querySelector("#bookmark-position"),
  bookmarkCard: document.querySelector("#bookmark-card"),
  actionButtons: document.querySelectorAll("[data-action]"),
  undoButton: document.querySelector("#undo-button"),
  queueLeft: document.querySelector("#queue-left"),
  statusLabel: document.querySelector("#status-label"),
  statusCaption: document.querySelector("#status-caption"),
};

const DEFAULT_CARD_MARKUP = ui.bookmarkCard.innerHTML;

function syncCardRefs() {
  ui.bookmarkCategory = document.querySelector("#bookmark-category");
  ui.bookmarkTitle = document.querySelector("#bookmark-title");
  ui.bookmarkAuthor = document.querySelector("#bookmark-author");
  ui.bookmarkHandle = document.querySelector("#bookmark-handle");
  ui.bookmarkDate = document.querySelector("#bookmark-date");
  ui.bookmarkText = document.querySelector("#bookmark-text");
  ui.bookmarkLink = document.querySelector("#bookmark-link");
  ui.bookmarkLinkSecondary = document.querySelector("#bookmark-link-secondary");
  ui.bookmarkTags = document.querySelector("#bookmark-tags");
  ui.noteTitle = document.querySelector("#note-title");
  ui.noteKind = document.querySelector("#note-kind");
  ui.notePath = document.querySelector("#note-path");
}

syncCardRefs();

function currentBookmark() {
  return state.queue[state.currentIndex] ?? null;
}

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function buildNotePath(bookmark) {
  return `Sergio/00_System/Inbox/X Bookmarks/${bookmark.date}-${slugify(bookmark.title)}.md`;
}

function renderTags(tags) {
  ui.bookmarkTags.innerHTML = "";

  tags.forEach((tag) => {
    const chip = document.createElement("span");
    chip.className = "tag-chip";
    chip.textContent = tag;
    ui.bookmarkTags.appendChild(chip);
  });

  const addChip = document.createElement("span");
  addChip.className = "tag-chip tag-chip--add";
  addChip.textContent = "+";
  ui.bookmarkTags.appendChild(addChip);
}

function renderCounts() {
  ui.keptCount.textContent = state.kept.length;
  ui.deletedCount.textContent = state.deleted.length;
  ui.inboxedCount.textContent = state.inboxed.length;

  const left = Math.max(state.queue.length - state.currentIndex, 0);
  ui.queueLeft.textContent = `${left} left`;

  const progress = state.queue.length === 0
    ? 100
    : (state.currentIndex / state.queue.length) * 100;
  ui.progressBar.style.width = `${Math.min(progress, 100)}%`;
}

function renderControls() {
  ui.undoButton.disabled = state.history.length === 0;
  ui.triageShell.hidden = state.dismissed;
  ui.triageLauncher.hidden = !state.dismissed;
}

function renderStatus() {
  const bookmark = currentBookmark();

  if (!bookmark) {
    ui.statusLabel.textContent = "Complete";
    ui.statusCaption.textContent = "queue cleared";
    return;
  }

  if (state.history.length === 0) {
    ui.statusLabel.textContent = "Ready";
    ui.statusCaption.textContent = "for triage";
    return;
  }

  const latest = state.history[state.history.length - 1];
  ui.statusLabel.textContent = latest.action;
  ui.statusCaption.textContent = latest.shortTitle;
}

function renderBookmark() {
  const bookmark = currentBookmark();

  if (!bookmark) {
    ui.bookmarkPosition.textContent = `${state.queue.length} of ${state.queue.length}`;
    ui.bookmarkCard.classList.add("empty-state");
    ui.bookmarkCard.innerHTML = `
      <div>
        <h2>Queue complete.</h2>
        <p>Restart the sample session to keep iterating on the triage surface.</p>
      </div>
    `;
    ui.noteTitle.textContent = "No active bookmark";
    ui.noteKind.textContent = "done";
    ui.notePath.textContent = "Sergio/00_System/Inbox/X Bookmarks";
    ui.bookmarkTags.innerHTML = "";
    return;
  }

  if (ui.bookmarkCard.classList.contains("empty-state")) {
    ui.bookmarkCard.classList.remove("empty-state");
    ui.bookmarkCard.innerHTML = DEFAULT_CARD_MARKUP;
    syncCardRefs();
  }

  const position = state.currentIndex + 1;
  ui.bookmarkPosition.textContent = `${position} of ${state.queue.length}`;
  ui.bookmarkCategory.textContent = bookmark.category;
  ui.bookmarkTitle.textContent = bookmark.title;
  ui.bookmarkAuthor.textContent = bookmark.author;
  ui.bookmarkHandle.textContent = bookmark.handle;
  ui.bookmarkDate.textContent = bookmark.date;
  ui.bookmarkText.textContent = bookmark.text;
  ui.bookmarkLink.href = bookmark.url;
  ui.bookmarkLinkSecondary.href = bookmark.url;

  ui.noteTitle.textContent = bookmark.title;
  ui.noteKind.textContent = bookmark.category.toLowerCase();
  ui.notePath.textContent = buildNotePath(bookmark);
  renderTags(bookmark.tags);
}

function render() {
  renderCounts();
  renderControls();
  renderBookmark();
  renderStatus();
}

function takeAction(type) {
  const bookmark = currentBookmark();
  if (!bookmark) {
    return;
  }

  const bucketMap = {
    keep: state.kept,
    delete: state.deleted,
    inbox: state.inboxed,
  };

  const labelMap = {
    keep: "Kept",
    delete: "Deleted",
    inbox: "Inboxed",
  };

  bucketMap[type].push(bookmark);
  state.history.push({
    action: labelMap[type],
    shortTitle: bookmark.title.slice(0, 36) + (bookmark.title.length > 36 ? "..." : ""),
    type,
    index: state.currentIndex,
  });
  state.currentIndex += 1;
  render();
}

function undoLastAction() {
  const last = state.history.pop();
  if (!last) {
    return;
  }

  const bucketMap = {
    keep: state.kept,
    delete: state.deleted,
    inbox: state.inboxed,
  };

  bucketMap[last.type].pop();
  state.currentIndex = last.index;
  render();
}

function restartQueue() {
  state.queue = [...SAMPLE_BOOKMARKS];
  state.currentIndex = 0;
  state.kept = [];
  state.deleted = [];
  state.inboxed = [];
  state.history = [];
  render();
}

document.addEventListener("keydown", (event) => {
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

  if (state.dismissed) {
    return;
  }

  event.preventDefault();

  if (action === "undo") {
    undoLastAction();
    return;
  }

  takeAction(action);
});

ui.actionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.action;

    if (action === "restart") {
      restartQueue();
      return;
    }

    if (action === "undo") {
      undoLastAction();
      return;
    }

    if (action === "close") {
      state.dismissed = true;
      renderControls();
      return;
    }

    takeAction(action);
  });
});

ui.triageLauncher.addEventListener("click", () => {
  state.dismissed = false;
  renderControls();
});

render();
