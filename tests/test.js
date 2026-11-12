const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const mode = location.hash.slice(1);
  await sleep(50);
  if (mode === "hover") {
    // show the hover buttons on one tile and a drop target on another, for the screenshot
    const s = document.querySelectorAll("#grid .slot");
    s[1].querySelectorAll(".tile-action").forEach((b) => (b.style.opacity = 1));
    s[5].classList.add("drop-target");
    s[2].classList.add("dragging");
    return;
  }
  if (mode === "menu") {
    $("settings-open").click();
    return;
  }
  if (mode === "find") {
    document.body.classList.add("finding");
    $("find").value = "d";
    $("find").dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }
  if (mode !== "test") return;

  const log = [];
  const check = (name, ok) => log.push(`${ok ? "PASS" : "FAIL"} ${name}`);
  const slots = () => document.querySelectorAll("#grid .slot");
  const links = () => __store.tabsaic.topics[0].links;
  const fill = async (url, title) => {
    $("link-url").value = url;
    $("link-url").dispatchEvent(new Event("input"));
    $("link-title").value = title;
    $("link-form").requestSubmit();
    await sleep(20);
  };
  const add = async (slot, url, title) => {
    slots()[slot].querySelector("button.empty").click();
    await fill(url, title);
  };
  const drag = async (from, to) => {
    const dt = new DataTransfer();
    const source = slots()[from].querySelector("a.tile");
    source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
    const target = typeof to === "number" ? slots()[to] : to;
    const over = new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt });
    target.dispatchEvent(over);
    const accepted = over.defaultPrevented && target.classList.contains("drop-target");
    target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
    source.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt })); // a browser always ends the drag on the source
    await sleep(20);
    return accepted;
  };

  check("first run: 4 topics", document.querySelectorAll(".topic").length === 4);
  check("first run: 12 empty slots", document.querySelectorAll(".tile.empty").length === 12);
  check("first run: Work active", document.querySelector('.topic[aria-pressed="true"]').textContent === "Work");
  check("hint text removed", !document.body.textContent.includes("Double-click"));

  await add(0, "github.com", "");
  check("add: scheme added", links()[0]?.url === "https://github.com/");
  check("add: label falls back to domain", slots()[0].querySelector(".label").textContent === "github.com");
  check("add: dialog closed", !$("link-dialog").open);

  await add(1, "edge://settings", "Settings");
  check("add: edge:// kept", links()[1]?.url.startsWith("edge://settings"));

  slots()[2].querySelector("button.empty").click();
  check("add: heading names the topic", $("link-heading").textContent === "Add link to Work" && $("link-save").textContent === "Add");
  await fill("foo bar", "");
  check("invalid: dialog stays open", $("link-dialog").open);
  check("invalid: nothing saved", links()[2] === null);
  $("link-dialog").querySelector("[data-close]").click();
  check("cancel: dialog closed", !$("link-dialog").open);
  check("cancel: nothing saved", links()[2] === null);

  // edit a link with the pencil button
  slots()[0].querySelector(".edit").click();
  check("edit: dialog prefilled", $("link-dialog").open && $("link-url").value === "https://github.com/" && $("link-heading").textContent === "Edit link" && $("link-save").textContent === "Save");
  await fill("https://github.com/", "GitHub");
  check("edit: title saved", links()[0]?.title === "GitHub" && slots()[0].querySelector(".label").textContent === "GitHub");
  check("edit: same slot, nothing else touched", links()[1]?.title === "Settings" && links().filter(Boolean).length === 2);
  slots()[0].querySelector(".edit").click();
  $("link-dialog").querySelector("[data-close]").click();
  check("edit: cancel keeps link", links()[0]?.title === "GitHub");

  // drag and drop
  check("drag: tiles are draggable", slots()[0].querySelector("a.tile").draggable === true);
  const acceptedEmpty = await drag(1, 5);
  check("drag: empty slot accepts drop", acceptedEmpty);
  check("drag: moved to empty slot", links()[5]?.title === "Settings" && links()[1] === null);
  const acceptedFull = await drag(0, 5);
  check("drag: filled slot accepts drop", acceptedFull);
  check("drag: two tiles swapped", links()[0]?.title === "Settings" && links()[5]?.title === "GitHub");
  check("drag: page shows new order", slots()[0].querySelector(".label").textContent === "Settings" && slots()[5].querySelector(".label").textContent === "GitHub");
  const acceptedSelf = await drag(0, 0);
  check("drag: drop on itself does nothing", !acceptedSelf && links()[0]?.title === "Settings");
  check("drag: no leftover highlight", document.querySelectorAll(".drop-target").length === 0);
  // a drag that did not start on a tile (a file, text from another page) must be ignored
  const foreign = new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() });
  slots()[3].dispatchEvent(foreign);
  check("drag: foreign drag ignored", !foreign.defaultPrevented);

  slots()[5].querySelector(".remove").click();
  await sleep(20);
  check("remove: slot empty", links()[5] === null && !!slots()[5].querySelector(".tile.empty"));
  check("remove: other link kept", links()[0] !== null);

  // rename with the pencil button next to the topics
  document.querySelector(".topic-edit").click();
  check("rename: dialog prefilled", $("topic-dialog").open && $("topic-name").value === "Work");
  $("topic-name").value = "  Deep work ";
  $("topic-form").requestSubmit();
  await sleep(20);
  check("rename: saved trimmed", __store.tabsaic.topics[0].name === "Deep work");
  check("rename: tab shows it", document.querySelectorAll(".topic")[0].textContent === "Deep work");

  document.dispatchEvent(new KeyboardEvent("keydown", { key: "2" }));
  await sleep(20);
  check("key 2: switches topic", __store.tabsaic.active === 1);
  check("key 2: Personal is empty", document.querySelectorAll(".tile.empty").length === 12);
  document.querySelector(".topic-edit").click();
  check("rename: targets the active topic", $("topic-name").value === "Personal");
  $("topic-dialog").querySelector("[data-close]").click();
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "9" }));
  await sleep(20);
  check("key 9: no topic switch", __store.tabsaic.active === 1);
  check("key 9: starts the find instead", document.body.classList.contains("finding") && document.activeElement === $("find"));
  $("find").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  check("find: Esc closes it", !document.body.classList.contains("finding"));

  // drag a tile to another topic
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }));
  await sleep(20);
  const pills = () => document.querySelectorAll(".topic");
  const topics = () => __store.tabsaic.topics;
  const seed = async (change) => {
    const next = structuredClone(__store.tabsaic);
    change(next);
    await chrome.storage.local.set({ tabsaic: next });
    await sleep(20);
  };
  check("move: back on Deep work with one link", __store.tabsaic.active === 0 && topics()[0].links[0]?.title === "Settings");
  check("move: drop on the active topic is ignored", !(await drag(0, pills()[0])) && topics()[0].links[0]?.title === "Settings");
  check("move: other topic accepts the drop", await drag(0, pills()[1]));
  check("move: link is in the first free slot there", topics()[1].links[0]?.title === "Settings");
  check("move: link left the source topic", topics()[0].links.every((l) => l === null));
  check("move: view stays on the current topic", __store.tabsaic.active === 0 && document.querySelectorAll(".tile.empty").length === 12);
  check("move: no leftover highlight", document.querySelectorAll(".drop-target").length === 0);

  await add(0, "example.com", "One");
  await seed((d) => {
    d.topics[2].links = Array.from({ length: 12 }, (_, i) => ({ url: `https://full${i}.example/`, title: `F${i}` }));
  });
  check("move: full topic refuses the drop", !(await drag(0, pills()[2])));
  check("move: full topic unchanged, link kept", topics()[0].links[0]?.title === "One" && topics()[2].links.every((l) => l.title.startsWith("F")));

  await seed((d) => {
    d.topics[2].links[3] = null;
  });
  check("move: topic with one gap accepts the drop", await drag(0, pills()[2]));
  check("move: link fills the gap", topics()[2].links[3]?.title === "One" && topics()[0].links[0] === null);

  // tiles show the name only
  check("tiles: no site icon", document.querySelectorAll(".tile .icon, .tile img").length === 0);
  check("credit: short text", document.querySelector(".credit").textContent.trim() === "Tabsaic · inspired by mosaic");

  // import from the Favorites bar. State now: Deep work empty, Personal 1 link, Tools full, Reading empty.
  const used = () => topics().map((tp) => tp.links.filter(Boolean).length);
  const openImport = async () => {
    $("import-open").click();
    await sleep(20);
  };
  check("import: start state", JSON.stringify(used()) === "[0,1,12,0]");
  await openImport();
  check("import: dialog names the count", $("confirm-dialog").open && $("confirm-text").textContent.includes("has 4 links") && $("confirm-text").textContent.includes("4 go into"));
  check("import: nothing changes before confirming", JSON.stringify(used()) === "[0,1,12,0]");
  $("confirm-dialog").querySelector("[data-close]").click();
  check("import: cancel changes nothing", JSON.stringify(used()) === "[0,1,12,0]");

  await openImport();
  $("confirm-form").requestSubmit();
  await sleep(20);
  const w = () => topics()[0].links;
  check("import: 4 links added to the current topic", JSON.stringify(used()) === "[4,1,12,0]");
  check("import: bar order kept, folders included", w().slice(0, 4).map((l) => l.url).join() === "https://github.com/,https://folder.example/,https://deep.example/,https://last.example/");
  check("import: titles kept", w()[0].title === "GitHub" && w()[1].title === "In folder");
  check("import: bookmarklet skipped", !JSON.stringify(topics()).includes("javascript:"));
  check("import: Other favorites not imported", !JSON.stringify(topics()).includes("other.example"));
  check("import: untitled link shows its domain", slots()[2].querySelector(".label").textContent === "deep.example");

  await openImport();
  check("import: second run finds only duplicates", $("confirm-text").textContent === "Your Favorites bar has 4 links. All of them are already here." && $("confirm-save").hidden);
  $("confirm-dialog").querySelector("[data-close]").click();
  check("import: duplicates not added", JSON.stringify(used()) === "[4,1,12,0]");

  // 2 known links, 1 new, and the new one twice on the bar
  window.__bar = [
    { title: "GitHub again", url: "https://github.com/" },
    { title: "New", url: "https://new.example/" },
    { title: "Last", url: "https://last.example/" },
    { title: "New twice", url: "https://new.example/" },
  ];
  await openImport();
  check("import: dialog counts the skipped links", $("confirm-text").textContent.includes("has 4 links") && $("confirm-text").textContent.includes("Already here and skipped: 3.") && $("confirm-text").textContent.includes("1 go into"));
  $("confirm-form").requestSubmit();
  await sleep(20);
  check("import: only the new link added, once", JSON.stringify(used()) === "[5,1,12,0]" && w()[4].title === "New");
  $("undo").click();
  await sleep(20);
  check("undo: import reversed", JSON.stringify(used()) === "[4,1,12,0]");

  // more links than empty slots: 31 empty (8 + 11 + 0 + 12), 40 on the bar
  window.__bar = Array.from({ length: 40 }, (_, i) => ({ title: `B${i}`, url: `https://b${i}.example/` }));
  await openImport();
  check("import: dialog says what does not fit", $("confirm-text").textContent.includes("31 go into") && $("confirm-text").textContent.includes("9 do not fit"));
  $("confirm-form").requestSubmit();
  await sleep(20);
  check("import: every slot filled, none overwritten", JSON.stringify(used()) === "[12,12,12,12]" && w()[0].title === "GitHub" && topics()[1].links[0].title === "Settings");
  check("import: fills the current topic first, then the next", w()[4].title === "B0" && w()[11].title === "B7" && topics()[1].links[1].title === "B8" && topics()[3].links[11].title === "B30");

  await openImport();
  check("import: full page offers no import", $("confirm-text").textContent.includes("all 48 slots are full") && $("confirm-save").hidden);
  $("confirm-dialog").querySelector("[data-close]").click();

  window.__bar = [];
  await openImport();
  check("import: empty bar", $("confirm-text").textContent === "Your Favorites bar has no links." && $("confirm-save").hidden);
  $("confirm-dialog").querySelector("[data-close]").click();

  const saved = chrome.bookmarks;
  delete chrome.bookmarks;
  await openImport();
  check("import: missing permission explained", $("confirm-text").textContent.includes("reload arrow") && $("confirm-save").hidden);
  $("confirm-dialog").querySelector("[data-close]").click();
  chrome.bookmarks = saved;

  // bottom row: credit, import, extensions page
  // bottom row: credit, undo, settings gear. The four options live in the settings menu.
  const menu = $("settings-menu");
  const visible = (el) => el.getBoundingClientRect().width > 0;
  check("settings: bottom row shows only credit, undo and the gear", JSON.stringify([...document.querySelectorAll(".footer > *")].map((el) => el.className || el.id)) === JSON.stringify(["credit", "footer-button", "settings", "restore-file"]));
  check("settings: menu holds the four options", JSON.stringify([...menu.children].map((el) => el.textContent)) === JSON.stringify(["Import from Favorites bar", "Export backup", "Restore backup", "Edge extensions"]));
  check("settings: options hidden at first", menu.hidden && !visible($("import-open")) && $("settings-open").getAttribute("aria-expanded") === "false");
  $("settings-open").click();
  check("settings: gear opens the menu", !menu.hidden && visible($("import-open")) && $("settings-open").getAttribute("aria-expanded") === "true");
  check("settings: open menu adds no scrolling", document.documentElement.scrollHeight <= innerHeight && menu.getBoundingClientRect().top >= 0);
  $("settings-open").click();
  check("settings: gear closes it again", menu.hidden);
  $("settings-open").click();
  document.body.click();
  check("settings: click elsewhere closes it", menu.hidden);
  $("settings-open").click();
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  check("settings: Esc closes it", menu.hidden && !document.body.classList.contains("finding"));
  $("settings-open").click();
  $("import-open").click();
  await sleep(20);
  check("settings: choosing an option closes the menu and runs it", menu.hidden && $("confirm-dialog").open && $("confirm-heading").textContent === "Import from Favorites bar");
  $("confirm-dialog").querySelector("[data-close]").click();
  $("extensions-open").click();
  check("footer: third item opens edge://extensions/", window.__tabUpdate?.url === "edge://extensions/");

  // backup: export to a file, restore from a file. State now: all 48 slots full.
  let blob = null;
  let downloadName = null;
  URL.createObjectURL = (b) => {
    blob = b;
    return "blob:test";
  };
  HTMLAnchorElement.prototype.click = function () {
    downloadName = this.download;
  };
  const now = () => JSON.stringify(__store.tabsaic);
  const pick = async (name, content) => {
    const dt = new DataTransfer();
    dt.items.add(new File([content], name, { type: "application/json" }));
    $("restore-file").files = dt.files;
    $("restore-file").dispatchEvent(new Event("change"));
    // reading the file is real I/O, so wait until the dialog is open instead of a fixed time
    for (let i = 0; i < 200 && !$("confirm-dialog").open; i++) await sleep(20);
  };
  const closeConfirm = () => $("confirm-dialog").querySelector("[data-close]").click();

  const before = now();
  $("export-open").click();
  const exported = await blob.text();
  const parsed = JSON.parse(exported);
  check("export: file name has the date", /^tabsaic-backup-\d{4}-\d{2}-\d{2}\.json$/.test(downloadName));
  check("export: file holds every topic and link", parsed.app === "tabsaic" && JSON.stringify(parsed.data) === before);
  check("export: page unchanged", now() === before);

  slots()[0].querySelector(".remove").click();
  await sleep(20);
  document.querySelector(".topic-edit").click();
  $("topic-name").value = "Changed";
  $("topic-form").requestSubmit();
  await sleep(20);
  const changed = now();
  check("restore: page differs from the backup first", changed !== before);

  await pick("backup.json", exported);
  check("restore: asks first, with both counts", $("confirm-dialog").open && $("confirm-text").textContent.includes("has 48 links") && $("confirm-text").textContent.includes("your 47 current links") && $("confirm-save").textContent === "Restore");
  check("restore: nothing changes before confirming", now() === changed);
  closeConfirm();
  check("restore: cancel changes nothing", now() === changed);

  await pick("backup.json", exported);
  $("confirm-form").requestSubmit();
  await sleep(20);
  check("restore: page equals the backup again", now() === before);
  check("restore: page redrawn", document.querySelectorAll(".topic")[0].textContent === "Deep work" && slots()[0].querySelector(".label").textContent === "GitHub");

  await pick("notes.json", "this is not json");
  check("restore: non-JSON file refused", $("confirm-text").textContent.includes("not a Tabsaic backup") && $("confirm-save").hidden && $("confirm-cancel").textContent === "Close");
  closeConfirm();
  await pick("other.json", JSON.stringify({ topics: [] }));
  check("restore: other JSON refused", $("confirm-text").textContent.includes("not a Tabsaic backup") && $("confirm-save").hidden);
  closeConfirm();
  check("restore: refused files change nothing", now() === before);

  // a hand-edited backup: only known fields are taken, bookmarklets are dropped, missing parts are filled
  await pick("edited.json", JSON.stringify({ app: "tabsaic", version: 1, data: { active: 7, topics: [
    { name: "  Mine  ", extra: "x", links: [{ url: "https://ok.example/", title: 5, evil: 1 }, { url: "javascript:alert(1)", title: "bad" }, "junk"] },
  ] } }));
  check("restore: backup without date still offered", $("confirm-text").textContent.startsWith("This backup has 1 link."));
  $("confirm-form").requestSubmit();
  await sleep(20);
  const r = __store.tabsaic;
  check("restore: cleaned link kept", JSON.stringify(r.topics[0].links[0]) === JSON.stringify({ url: "https://ok.example/", title: "5" }));
  check("restore: bookmarklet and junk dropped", r.topics[0].links[1] === null && r.topics[0].links[2] === null && !now().includes("javascript:"));
  check("restore: name trimmed, unknown fields gone", r.topics[0].name === "Mine" && !now().includes("extra") && !now().includes("evil"));
  check("restore: missing topics and slots filled", r.topics.length === 4 && r.topics.every((tp) => tp.links.length === 12) && r.active === 0 && r.topics[1].name === "Personal");
  check("restore: page shows it", document.querySelectorAll("a.tile").length === 1 && document.querySelectorAll(".tile.empty").length === 11);

  // ---- undo. State now: topic "Mine" with one link, the other topics empty.
  const s0 = now();
  check("undo: button shown after changes", !$("undo").hidden);
  slots()[0].querySelector(".remove").click();
  await sleep(20);
  check("undo: link removed first", __store.tabsaic.topics[0].links[0] === null);
  $("undo").click();
  await sleep(20);
  check("undo: removal reversed", now() === s0);
  document.querySelector(".topic-edit").click();
  $("topic-name").value = "Renamed";
  $("topic-form").requestSubmit();
  await sleep(20);
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "z", metaKey: true, bubbles: true }));
  await sleep(20);
  check("undo: Cmd+Z reverses a rename", now() === s0);
  const depth = undoStack.length;
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "2" }));
  await sleep(20);
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }));
  await sleep(20);
  check("undo: switching topics is not recorded", undoStack.length === depth);
  undoStack.length = 0;
  await seed((d) => d);
  check("undo: button hidden when there is nothing to undo", $("undo").hidden);

  // ---- find
  await seed((d) => {
    d.active = 0;
    d.topics[0].links = [{ url: "https://github.com/", title: "GitHub" }, null, { url: "edge://settings/", title: "Settings" }];
    d.topics[1].links = [{ url: "https://git-scm.com/docs", title: "Reference" }];
    d.topics[2].links = [{ url: "https://mail.example/", title: "Mail" }];
    d.topics[3].links = [{ url: "https://dg.example/", title: "Digital garden" }, { url: "https://hub.example/", title: "The hub" }, { url: "https://www.wikipedia.org/", title: "" }];
  });
  const type = async (text) => {
    $("find").value = text;
    $("find").dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(20);
  };
  const found = () => [...document.querySelectorAll("#grid .label")].map((el) => el.textContent);
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "g", bubbles: true }));
  check("find: a letter opens the find bar and focuses it", document.body.classList.contains("finding") && document.activeElement === $("find") && getComputedStyle($("topics")).display === "none" && getComputedStyle($("find-bar")).display === "flex");
  await type("git");
  check("find: the address is not searched", JSON.stringify(found()) === JSON.stringify(["GitHub", "Digital garden"]) && !found().includes("Reference"));
  await type("co");
  check("find: 'co' does not match every .com link", found().length === 0);
  await type("g");
  check("find: one letter matches word starts only, across topics", JSON.stringify(found()) === JSON.stringify(["GitHub", "Digital garden"]));
  check("find: first match marked, count shown", document.querySelectorAll("#grid .slot.first").length === 1 && $("find-count").textContent.startsWith("2 links found"));
  await type("hu");
  check("find: two letters do not match inside a word", JSON.stringify(found()) === JSON.stringify(["The hub"]));
  await type("hub");
  check("find: three letters also match inside a word, after word starts", JSON.stringify(found()) === JSON.stringify(["The hub", "GitHub"]));
  await type("wiki");
  check("find: an untitled link is found by its domain", JSON.stringify(found()) === JSON.stringify(["wikipedia.org"]));
  await type("g");
  check("find: result tiles have no edit or remove", document.querySelectorAll("#grid .tile-action, #grid .tile.empty").length === 0);
  window.__tabUpdate = null;
  $("find").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  check("find: Enter opens the first match", window.__tabUpdate?.url === "https://github.com/");
  await type("MAIL");
  check("find: not case sensitive", JSON.stringify(found()) === JSON.stringify(["Mail"]) && $("find-count").textContent.startsWith("1 link found"));
  await type("zzz");
  window.__tabUpdate = null;
  $("find").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  check("find: no match shows a message and Enter does nothing", found().length === 0 && $("find-count").textContent.startsWith("No link matches") && window.__tabUpdate === null);
  $("find").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await sleep(20);
  check("find: Esc brings the topic back", !document.body.classList.contains("finding") && $("find").value === "" && slots().length === 12 && getComputedStyle($("topics")).display === "flex");
  check("find: nothing was changed", __store.tabsaic.topics[0].links[0].title === "GitHub" && undoStack.length === 0);

  // ---- drop a link from outside on an empty slot
  const dropLink = async (slotIndex, data) => {
    const dt = new DataTransfer();
    for (const [k, v] of Object.entries(data)) dt.setData(k, v);
    const target = slots()[slotIndex];
    const over = new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt });
    target.dispatchEvent(over);
    if (over.defaultPrevented) target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
    await sleep(20);
    return over.defaultPrevented;
  };
  const L = () => __store.tabsaic.topics[0].links;
  check("drop: empty slot takes a link with the browser's title", (await dropLink(1, { "text/uri-list": "https://a.example/page", "text/x-moz-url": "https://a.example/page\nA page" })) && JSON.stringify(L()[1]) === JSON.stringify({ url: "https://a.example/page", title: "A page" }));
  check("drop: title from the dragged link's text", (await dropLink(3, { "text/uri-list": "https://b.example/", "text/html": '<a href="https://b.example/">B site</a>' })) && L()[3]?.title === "B site");
  check("drop: address only gives an empty title", (await dropLink(4, { "text/uri-list": "https://c.example/", "text/plain": "https://c.example/" })) && L()[4]?.url === "https://c.example/" && L()[4]?.title === "" && slots()[4].querySelector(".label").textContent === "c.example");
  check("drop: a filled slot refuses", !(await dropLink(0, { "text/uri-list": "https://d.example/" })) && L()[0].title === "GitHub");
  check("drop: plain text without a link refuses", !(await dropLink(5, { "text/plain": "just words" })) && L()[5] === null);
  check("drop: no leftover highlight", document.querySelectorAll(".drop-target").length === 0);
  $("undo").click();
  await sleep(20);
  check("undo: dropped link reversed", L()[4] === null && L()[3]?.title === "B site");

  // ---- reorder topics by dragging
  const names = () => [...pills()].map((el) => el.textContent);
  const dragTopicTo = async (from, to) => {
    const dt = new DataTransfer();
    const source = pills()[from];
    source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
    const target = pills()[to];
    const over = new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt });
    target.dispatchEvent(over);
    target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
    source.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));
    await sleep(20);
    return over.defaultPrevented;
  };
  check("topics: start order", JSON.stringify(names()) === JSON.stringify(["Mine", "Personal", "Tools", "Reading"]) && pills()[0].draggable);
  check("topics: drop on another topic accepted", await dragTopicTo(0, 2));
  check("topics: moved to that position", JSON.stringify(names()) === JSON.stringify(["Personal", "Tools", "Mine", "Reading"]));
  check("topics: the open topic stays open", __store.tabsaic.active === 2 && document.querySelector('.topic[aria-pressed="true"]').textContent === "Mine" && slots()[0].querySelector(".label").textContent === "GitHub");
  check("topics: links moved with their topic", __store.tabsaic.topics[2].links[0].title === "GitHub" && __store.tabsaic.topics[0].links[0].title === "Reference");
  check("topics: drop on itself refused", !(await dragTopicTo(1, 1)) && JSON.stringify(names()) === JSON.stringify(["Personal", "Tools", "Mine", "Reading"]));
  check("topics: move to the front", (await dragTopicTo(3, 0)) && JSON.stringify(names()) === JSON.stringify(["Reading", "Personal", "Tools", "Mine"]) && __store.tabsaic.active === 3);
  check("topics: a tile can still be dropped on a topic", (await drag(0, pills()[1])) && __store.tabsaic.topics[1].links[1]?.title === "GitHub");
  $("undo").click();
  await sleep(20);
  $("undo").click();
  await sleep(20);
  check("undo: tile move and topic move reversed", JSON.stringify(names()) === JSON.stringify(["Personal", "Tools", "Mine", "Reading"]) && __store.tabsaic.topics[2].links[0].title === "GitHub");

  // ---- the page fits the window: nothing to scroll, bottom row visible
  const fits = () => document.documentElement.scrollHeight <= innerHeight && $("settings-open").getBoundingClientRect().bottom <= innerHeight && $("settings-open").getBoundingClientRect().height > 0 && slots()[11].getBoundingClientRect().bottom <= $("undo").parentElement.getBoundingClientRect().top;
  check(`fit: no scrolling at ${innerWidth}x${innerHeight}`, fits());
  const heights = [...slots()].map((el) => Math.round(el.getBoundingClientRect().height));
  check(`fit: 12 tiles of equal height (${heights[0]}px)`, slots().length === 12 && new Set(heights).size === 1 && heights[0] >= 40);

  document.body.dataset.results = log.join(" | ");
})();
