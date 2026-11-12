(() => {
  const store = {};
  const listeners = [];
  const mode = location.hash.slice(1);
  if (mode === "shot" || mode === "dialog" || mode === "hover" || mode === "find" || mode === "menu") {
    store.tabsaic = {
      active: 0,
      topics: [
        { name: "Work", links: [
          { url: "https://github.com/", title: "GitHub" },
          { url: "https://dagster.io/", title: "Dagster" },
          { url: "https://docs.getdbt.com/", title: "dbt docs" },
          { url: "https://www.wikipedia.org/", title: "" },
          { url: "edge://settings/", title: "Edge settings" },
          null,
          { url: "https://board.example.com/", title: "A board with a very long name that needs more than two lines" },
        ] },
        { name: "Personal", links: [] },
      ],
    };
  }
  window.chrome = {
    bookmarks: {
      getTree: async () => [{ children: [
        { title: "Favorites bar", children: window.__bar },
        { title: "Other favorites", children: [{ title: "Not on the bar", url: "https://other.example/" }] },
      ] }],
    },
    tabs: { update(arg) { window.__tabUpdate = arg; } },
    storage: {
      local: {
        get: async (key) => (key in store ? { [key]: structuredClone(store[key]) } : {}),
        set: async (obj) => {
          for (const [k, v] of Object.entries(obj)) {
            const oldValue = store[k];
            store[k] = structuredClone(v);
            listeners.forEach((l) => l({ [k]: { oldValue, newValue: structuredClone(v) } }, "local"));
          }
        },
      },
      onChanged: { addListener: (l) => listeners.push(l) },
    },
  };
  window.__store = store;
  window.__bar = [
    { title: "GitHub", url: "https://github.com/" },
    { title: "Folder", children: [
      { title: "In folder", url: "https://folder.example/" },
      { title: "Bookmarklet", url: "javascript:alert(1)" },
      { title: "Deep", children: [{ title: "", url: "https://deep.example/" }] },
    ] },
    { title: "Last", url: "https://last.example/" },
  ];
})();
