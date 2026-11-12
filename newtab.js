// Tabsaic: a new tab page of big link tiles, grouped by topic.
// The layout is fixed: TOPIC_COUNT topics, each with SLOT_COUNT link slots.
// Links are stored in this extension's local storage, not in the browser's bookmarks.
// Works in Edge and Chrome.

const TOPIC_COUNT = 4;
const SLOT_COUNT = 12;
const DEFAULT_TOPICS = ["Work", "Personal", "Tools", "Reading"];
const STORAGE_KEY = "tabsaic";
const UNDO_LIMIT = 30;

const PENCIL =
  '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">' +
  '<path d="M11.3 2.2l2.5 2.5-8.3 8.3-3.2.7.7-3.2z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>' +
  "</svg>";

const $ = (id) => document.getElementById(id);

// Edge and Chrome differ in two things here: the name of the bookmarks bar
// and the address of the extensions page.
const BROWSER = /\bEdg\//.test(navigator.userAgent)
  ? { name: "Edge", bar: "Favorites bar", extensions: "edge://extensions/" }
  : { name: "Chrome", bar: "Bookmarks bar", extensions: "chrome://extensions/" };
const count = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

let state = null; // { active: number, topics: [{ name, links: [{ url, title } | null] }] }
let undoStack = []; // earlier states, newest last. Kept in memory, so it is empty in every new tab.
let linkTarget = null; // { topic, slot } the link dialog writes to
let topicTarget = null; // topic index the rename dialog renames
let dragSlot = null; // slot index of the tile being dragged
let dragTopic = null; // index of the topic button being dragged
let confirmAction = null; // what the confirm dialog does when its action button is clicked

// Fill missing topics and slots. Never drops saved data, so changing the counts is safe.
function normalize(saved) {
  const topics = Array.isArray(saved?.topics) ? saved.topics : [];
  for (let t = 0; t < TOPIC_COUNT; t++) {
    topics[t] ??= { name: DEFAULT_TOPICS[t] ?? `Topic ${t + 1}`, links: [] };
    for (let s = 0; s < SLOT_COUNT; s++) topics[t].links[s] ??= null;
  }
  const active = Number.isInteger(saved?.active) && saved.active < TOPIC_COUNT ? saved.active : 0;
  return { active, topics };
}

function save() {
  chrome.storage.local.set({ [STORAGE_KEY]: state });
}

// Every change to links or topics goes through here, so it can be undone.
// Switching the topic passes undoable = false: it is not a change worth undoing.
function update(change, undoable = true) {
  if (undoable) {
    undoStack.push(structuredClone(state));
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  }
  change();
  render();
  save();
}

function undo() {
  const previous = undoStack.pop();
  if (!previous) return;
  state = previous;
  render();
  save();
}

// "github.com" -> "https://github.com/". Returns null if it is not a usable address.
function toUrl(text) {
  const raw = text.trim();
  // Edge's URL parser accepts "https://foo bar", so reject spaces here.
  if (!raw || /\s/.test(raw)) return null;
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) || /^(mailto|about):/i.test(raw);
  try {
    return new URL(hasScheme ? raw : `https://${raw}`).href;
  } catch {
    return null;
  }
}

function displayName(link) {
  let host = "";
  try {
    host = new URL(link.url).hostname.replace(/^www\./, "");
  } catch {}
  return link.title || host || link.url;
}

// A plain link on an extension page cannot open edge://, file:// and similar URLs,
// so the tab is navigated instead.
function openUrl(url) {
  chrome.tabs.update({ url });
}

// First empty slot of a topic, or -1 if the topic is full.
function freeSlot(t) {
  return state.topics[t].links.slice(0, SLOT_COUNT).indexOf(null);
}

// A dragged tile can move to another topic that still has an empty slot.
function canMoveTo(t) {
  return dragSlot !== null && t !== state.active && freeSlot(t) !== -1;
}

// True while a link from outside this page is dragged over it: from another tab,
// the address bar or the Favorites bar.
function isOutsideLink(event) {
  return dragSlot === null && dragTopic === null && event.dataTransfer.types.includes("text/uri-list");
}

// The link in a drop from outside, or null. The title comes from the browser's own
// "address + title" format when present, else from the dragged link's text.
function droppedLink(data) {
  const raw = (data.getData("text/uri-list").split("\n").find((line) => line.trim() && !line.startsWith("#")) ?? "").trim();
  const url = toUrl(raw);
  if (!url) return null;
  const [mozUrl = "", mozTitle = ""] = data.getData("text/x-moz-url").split("\n");
  let title = mozUrl.trim() === raw ? mozTitle.trim() : "";
  if (!title) {
    const html = new DOMParser().parseFromString(data.getData("text/html"), "text/html");
    title = html.querySelector("a")?.textContent.trim() ?? "";
  }
  if (title === raw) title = ""; // a dragged address has itself as text
  return { url, title };
}

function clearDropTargets() {
  for (const el of document.querySelectorAll(".drop-target")) el.classList.remove("drop-target");
}

// A slot holds a link tile or an "Add link" button.
// Dropping a dragged tile on a slot swaps the two slots, so a tile can also move to an empty slot.
// Dropping a link from outside on an empty slot adds it.
function makeSlot(slot, ...children) {
  const wrap = document.createElement("div");
  wrap.className = "slot";
  wrap.append(...children);

  const isEmpty = () => state.topics[state.active].links[slot] === null;
  const accepts = (event) => (dragSlot !== null ? dragSlot !== slot : isEmpty() && isOutsideLink(event));

  wrap.addEventListener("dragover", (event) => {
    if (!accepts(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = dragSlot !== null ? "move" : "copy";
    wrap.classList.add("drop-target");
  });
  wrap.addEventListener("dragleave", (event) => {
    if (!wrap.contains(event.relatedTarget)) wrap.classList.remove("drop-target");
  });
  wrap.addEventListener("drop", (event) => {
    if (!accepts(event)) return;
    event.preventDefault();
    if (dragSlot !== null) {
      const from = dragSlot;
      dragSlot = null;
      update(() => {
        const links = state.topics[state.active].links;
        [links[from], links[slot]] = [links[slot], links[from]];
      });
      return;
    }
    const link = droppedLink(event.dataTransfer);
    wrap.classList.remove("drop-target");
    if (link) {
      update(() => {
        state.topics[state.active].links[slot] = link;
      });
    }
  });
  return wrap;
}

function makeTile(link, slot) {
  const name = displayName(link);

  const tile = document.createElement("a");
  tile.className = "tile";
  tile.href = link.url;
  tile.title = link.url;
  tile.draggable = true;

  const label = document.createElement("span");
  label.className = "label";
  label.textContent = name;
  tile.append(label);

  if (!/^https?:/i.test(link.url)) {
    tile.addEventListener("click", (event) => {
      event.preventDefault();
      openUrl(link.url);
    });
  }

  const edit = document.createElement("button");
  edit.className = "tile-action edit";
  edit.innerHTML = PENCIL;
  edit.title = "Edit";
  edit.setAttribute("aria-label", `Edit ${name}`);
  edit.addEventListener("click", () => openLinkDialog(slot));

  const remove = document.createElement("button");
  remove.className = "tile-action remove";
  remove.textContent = "×";
  remove.title = "Remove";
  remove.setAttribute("aria-label", `Remove ${name}`);
  remove.addEventListener("click", () =>
    update(() => {
      state.topics[state.active].links[slot] = null;
    })
  );

  const wrap = makeSlot(slot, tile, edit, remove);

  tile.addEventListener("dragstart", () => {
    dragSlot = slot;
    wrap.classList.add("dragging");
  });
  tile.addEventListener("dragend", () => {
    dragSlot = null;
    wrap.classList.remove("dragging");
    clearDropTargets();
  });
  return wrap;
}

function makeEmptySlot(slot) {
  const button = document.createElement("button");
  button.className = "tile empty";
  button.innerHTML = '<span class="plus">+</span><span class="label">Add link</span>';
  button.addEventListener("click", () => openLinkDialog(slot));
  return makeSlot(slot, button);
}

// Moves a topic to another position. The topic that is open stays open.
function moveTopic(from, to) {
  update(() => {
    const open = state.topics[state.active];
    const [moved] = state.topics.splice(from, 1);
    state.topics.splice(to, 0, moved);
    state.active = state.topics.indexOf(open);
  });
}

function makeTopicButton(topic, t) {
  const button = document.createElement("button");
  button.className = "topic";
  button.textContent = topic.name;
  button.draggable = true;
  button.setAttribute("aria-pressed", String(t === state.active));
  button.addEventListener("click", () => selectTopic(t));

  button.addEventListener("dragstart", () => {
    dragTopic = t;
    button.classList.add("dragging");
  });
  button.addEventListener("dragend", () => {
    dragTopic = null;
    button.classList.remove("dragging");
    clearDropTargets();
  });

  // Two things can be dropped on a topic:
  // another topic (the dragged one moves to this position) or a link tile
  // (the link moves to this topic's first free slot).
  const accepts = () => (dragTopic !== null ? dragTopic !== t : canMoveTo(t));

  button.addEventListener("dragover", (event) => {
    if (!accepts()) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    button.classList.add("drop-target");
  });
  button.addEventListener("dragleave", () => button.classList.remove("drop-target"));
  button.addEventListener("drop", (event) => {
    if (!accepts()) return;
    event.preventDefault();
    if (dragTopic !== null) {
      const from = dragTopic;
      dragTopic = null;
      moveTopic(from, t);
      return;
    }
    const from = dragSlot;
    dragSlot = null;
    update(() => {
      state.topics[t].links[freeSlot(t)] = state.topics[state.active].links[from];
      state.topics[state.active].links[from] = null;
    });
  });
  return button;
}

// How well a tile name matches the typed text. Lower is better, -1 is no match.
// 0: the name starts with it. 1: a word in the name starts with it.
// 2: it is inside a word. That only counts from 3 letters on, so one letter does not match almost everything.
function matchRank(name, query) {
  const text = name.toLowerCase();
  if (text.startsWith(query)) return 0;
  if (text.split(/[^\p{L}\p{N}]+/u).some((word) => word.startsWith(query))) return 1;
  if (query.length >= 3 && text.includes(query)) return 2;
  return -1;
}

// Links in all topics whose name matches the text, best matches first.
// Only the name on the tile is searched, not the address: "co" would match every .com link.
function findMatches(text) {
  const query = text.trim().toLowerCase();
  if (!query) return [];
  return state.topics
    .slice(0, TOPIC_COUNT)
    .flatMap((topic) => topic.links.slice(0, SLOT_COUNT))
    .filter(Boolean)
    .map((link) => ({ link, rank: matchRank(displayName(link), query) }))
    .filter((match) => match.rank !== -1)
    .sort((a, b) => a.rank - b.rank)
    .map((match) => match.link);
}

// A tile in the find results: opens the link, nothing else.
function makeFoundTile(link, isFirst) {
  const tile = document.createElement("a");
  tile.className = "tile";
  tile.href = link.url;
  tile.title = link.url;
  const label = document.createElement("span");
  label.className = "label";
  label.textContent = displayName(link);
  tile.append(label);
  if (!/^https?:/i.test(link.url)) {
    tile.addEventListener("click", (event) => {
      event.preventDefault();
      openUrl(link.url);
    });
  }
  const wrap = document.createElement("div");
  wrap.className = isFirst ? "slot first" : "slot";
  wrap.append(tile);
  return wrap;
}

function renderGrid() {
  const query = $("find").value.trim();
  if (query) {
    const found = findMatches(query);
    $("find-count").textContent = found.length
      ? `${count(found.length, "link")} found. Enter opens the first, Esc closes.`
      : "No link matches. Esc closes.";
    const tiles = found.slice(0, SLOT_COUNT).map((link, i) => makeFoundTile(link, i === 0));
    // Blank positions keep the grid at its usual shape, so the tiles do not change size.
    while (tiles.length < SLOT_COUNT) {
      const blank = document.createElement("div");
      blank.className = "slot";
      tiles.push(blank);
    }
    $("grid").replaceChildren(...tiles);
    return;
  }
  $("find-count").textContent = "Type to find a link in all topics. Esc closes.";
  const links = state.topics[state.active].links.slice(0, SLOT_COUNT);
  $("grid").replaceChildren(...links.map((link, s) => (link ? makeTile(link, s) : makeEmptySlot(s))));
}

function render() {
  const rename = document.createElement("button");
  rename.className = "topic-edit";
  rename.innerHTML = PENCIL;
  rename.title = "Rename this topic";
  rename.setAttribute("aria-label", `Rename topic ${state.topics[state.active].name}`);
  rename.addEventListener("click", () => openTopicDialog(state.active));

  $("topics").replaceChildren(...state.topics.slice(0, TOPIC_COUNT).map(makeTopicButton), rename);
  $("undo").hidden = undoStack.length === 0;
  renderGrid();
}

function selectTopic(t) {
  if (t !== state.active) {
    update(() => {
      state.active = t;
    }, false);
  }
}

// Find: the first typed letter shows the find bar in place of the topics.
function startFind() {
  document.body.classList.add("finding");
  $("find").focus(); // the key that started this lands in the field
}

function stopFind() {
  $("find").value = "";
  document.body.classList.remove("finding");
  $("find").blur();
  renderGrid();
}

$("find").addEventListener("input", renderGrid);
$("find").addEventListener("blur", () => {
  if (!$("find").value.trim()) stopFind();
});
$("find").addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    stopFind();
  } else if (event.key === "Enter") {
    const [first] = findMatches($("find").value);
    if (first) openUrl(first.url);
  }
});

// Adds a link to an empty slot, or edits the link that is already there.
function openLinkDialog(slot) {
  const topic = state.topics[state.active];
  const link = topic.links[slot];
  linkTarget = { topic: state.active, slot };
  $("link-heading").textContent = link ? "Edit link" : `Add link to ${topic.name}`;
  $("link-save").textContent = link ? "Save" : "Add";
  $("link-url").value = link?.url ?? "";
  $("link-title").value = link?.title ?? "";
  $("link-url").setCustomValidity("");
  $("link-dialog").showModal();
}

function openTopicDialog(t) {
  topicTarget = t;
  $("topic-name").value = state.topics[t].name;
  $("topic-dialog").showModal();
  $("topic-name").select();
}

// All links in the bookmarks bar (Edge: Favorites bar), subfolders included, in the order of the bar.
// Bookmarklets are skipped.
async function favoritesBarLinks() {
  const [tree] = await chrome.bookmarks.getTree();
  const links = [];
  const walk = (folder) => {
    for (const node of folder.children ?? []) {
      if (!node.url) walk(node);
      else if (!node.url.startsWith("javascript:")) links.push({ url: node.url, title: node.title });
    }
  };
  walk(tree.children[0]);
  return links;
}

// The links that are not on this page yet. A link that is twice on the bar counts once.
function withoutDuplicates(links) {
  const sameAddress = (url) => {
    try {
      return new URL(url).href;
    } catch {
      return url;
    }
  };
  const known = new Set(state.topics.flatMap((topic) => topic.links).filter(Boolean).map((link) => sameAddress(link.url)));
  return links.filter((link) => {
    const address = sameAddress(link.url);
    if (known.has(address)) return false;
    known.add(address);
    return true;
  });
}

// Empty slots in the order an import fills them: the current topic first, then the next ones.
function emptySlots() {
  const empty = [];
  for (let i = 0; i < TOPIC_COUNT; i++) {
    const topic = (state.active + i) % TOPIC_COUNT;
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      if (!state.topics[topic].links[slot]) empty.push({ topic, slot });
    }
  }
  return empty;
}

// One dialog for questions and messages. Without `action` it only shows the text.
function askConfirm({ heading, text, action, onConfirm }) {
  confirmAction = onConfirm ?? null;
  $("confirm-heading").textContent = heading;
  $("confirm-text").textContent = text;
  $("confirm-save").textContent = action ?? "";
  $("confirm-save").hidden = !action;
  $("confirm-cancel").textContent = action ? "Cancel" : "Close";
  $("confirm-dialog").showModal();
}

$("confirm-form").addEventListener("submit", () => confirmAction?.());

// Shows what an import would do. Nothing changes until the Import button is clicked.
async function openImportDialog() {
  const heading = `Import from ${BROWSER.bar}`;
  if (!chrome.bookmarks) {
    askConfirm({
      heading,
      text: `Tabsaic may not read your ${BROWSER.bar} yet. Open ${BROWSER.extensions}, click the reload arrow on Tabsaic, then try again.`,
    });
    return;
  }
  const found = await favoritesBarLinks();
  if (found.length === 0) {
    askConfirm({ heading, text: `Your ${BROWSER.bar} has no links.` });
    return;
  }
  const fresh = withoutDuplicates(found);
  if (fresh.length === 0) {
    askConfirm({ heading, text: `Your ${BROWSER.bar} has ${count(found.length, "link")}. All of them are already here.` });
    return;
  }
  const empty = emptySlots().length;
  const fit = Math.min(fresh.length, empty);
  if (fit === 0) {
    askConfirm({
      heading,
      text: `Your ${BROWSER.bar} has ${count(fresh.length, "new link")}, but all ${TOPIC_COUNT * SLOT_COUNT} slots are full. Remove some links first.`,
    });
    return;
  }
  let text = `Your ${BROWSER.bar} has ${count(found.length, "link")}, folders included.`;
  if (found.length > fresh.length) text += ` Already here and skipped: ${found.length - fresh.length}.`;
  text += ` ${fit} go into the empty slots, starting with ${state.topics[state.active].name}.`;
  if (fresh.length > fit) text += ` ${fresh.length - fit} do not fit, because only ${count(empty, "slot")} are empty.`;
  askConfirm({
    heading,
    text,
    action: "Import",
    onConfirm: () => {
      const slots = emptySlots();
      update(() => {
        fresh.slice(0, slots.length).forEach((link, i) => {
          state.topics[slots[i].topic].links[slots[i].slot] = link;
        });
      });
    },
  });
}

$("import-open").addEventListener("click", openImportDialog);
$("extensions-open").addEventListener("click", () => openUrl(BROWSER.extensions));
$("import-open").textContent = `Import from ${BROWSER.bar}`;
$("extensions-open").textContent = `${BROWSER.name} extensions`;
$("undo").addEventListener("click", undo);

// Settings menu: the gear button in the bottom row opens it. It closes after a choice,
// on a click anywhere else, and on Esc.
function toggleSettings(open = $("settings-menu").hidden) {
  $("settings-menu").hidden = !open;
  $("settings-open").setAttribute("aria-expanded", String(open));
}

$("settings-open").addEventListener("click", () => toggleSettings());
$("settings-menu").addEventListener("click", () => toggleSettings(false));
document.addEventListener("click", (event) => {
  if (!event.target.closest(".settings")) toggleSettings(false);
});

// Backup: all topics and links as one JSON file in the Downloads folder.
function exportBackup() {
  const backup = { app: "tabsaic", version: 1, exported: new Date().toISOString(), data: state };
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
  link.download = `tabsaic-backup-${backup.exported.slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// Reads the text of a backup file. Returns { exported, data }, or null if it is not a Tabsaic backup.
// Only known fields are taken over, and bookmarklets are dropped.
function parseBackup(text) {
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    return null;
  }
  const topics = backup?.data?.topics;
  if (backup?.app !== "tabsaic" || !Array.isArray(topics)) return null;
  return {
    exported: backup.exported,
    data: {
      active: backup.data.active,
      topics: topics.map((topic, t) => ({
        name: String(topic?.name ?? "").trim().slice(0, 30) || `Topic ${t + 1}`,
        links: (Array.isArray(topic?.links) ? topic.links : []).map((link) =>
          typeof link?.url === "string" && !/^javascript:/i.test(link.url)
            ? { url: link.url, title: String(link.title ?? "") }
            : null
        ),
      })),
    },
  };
}

const countLinks = (topics) => topics.reduce((n, topic) => n + topic.links.filter(Boolean).length, 0);

$("export-open").addEventListener("click", exportBackup);
$("restore-open").addEventListener("click", () => $("restore-file").click());

$("restore-file").addEventListener("change", async () => {
  const file = $("restore-file").files[0];
  $("restore-file").value = ""; // so the same file can be picked again
  if (!file) return;
  const heading = "Restore backup";
  const backup = parseBackup(await file.text());
  if (!backup) {
    askConfirm({ heading, text: `"${file.name}" is not a Tabsaic backup file. Nothing was changed.` });
    return;
  }
  const day = /^\d{4}-\d{2}-\d{2}/.exec(backup.exported ?? "")?.[0];
  askConfirm({
    heading,
    text: `This backup${day ? ` from ${day}` : ""} has ${count(countLinks(backup.data.topics), "link")}. It replaces everything on this page: your ${count(countLinks(state.topics), "current link")} and the topic names.`,
    action: "Restore",
    onConfirm: () =>
      update(() => {
        state = normalize(backup.data);
      }),
  });
});

$("link-form").addEventListener("submit", (event) => {
  const url = toUrl($("link-url").value);
  if (!url) {
    event.preventDefault();
    $("link-url").setCustomValidity("Enter a web address, for example github.com");
    $("link-url").reportValidity();
    return;
  }
  const title = $("link-title").value.trim();
  update(() => {
    state.topics[linkTarget.topic].links[linkTarget.slot] = { url, title };
  });
});

$("link-url").addEventListener("input", () => $("link-url").setCustomValidity(""));

$("topic-form").addEventListener("submit", () => {
  const name = $("topic-name").value.trim();
  if (name) {
    update(() => {
      state.topics[topicTarget].name = name;
    });
  }
});

for (const button of document.querySelectorAll("[data-close]")) {
  button.addEventListener("click", () => button.closest("dialog").close());
}

// Keys on the page itself: Cmd/Ctrl+Z undoes, 1 to 4 switch topics, any other character starts the find.
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") toggleSettings(false);
  if (document.querySelector("dialog[open]") || event.target instanceof HTMLInputElement) return;
  if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undo();
    return;
  }
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const n = Number(event.key);
  if (event.key !== " " && n >= 1 && n <= TOPIC_COUNT) selectTopic(n - 1);
  else if (event.key.length === 1 && event.key !== " ") startFind();
});

// Keep several open new tabs in step.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[STORAGE_KEY]) return;
  state = normalize(changes[STORAGE_KEY].newValue);
  render();
});

chrome.storage.local.get(STORAGE_KEY).then((data) => {
  state = normalize(data[STORAGE_KEY]);
  render();
});
