# Tabsaic

A new tab page for Edge and Chrome. It shows your links as big colored tiles, grouped by topic. Inspired by mosaic.

- 4 topics, 12 links each. Everything is on one page and fits the window, so there is no scrolling.
- No account, no sync, no tracking. Your links stay in your browser.

## Install

1. Get the folder: clone this repository, or download it as a zip and unpack it.
   Put it where it can stay. If you move or rename the folder later, the browser treats it as a new extension and your links are gone.
2. Open the extensions page: `edge://extensions` in Edge, `chrome://extensions` in Chrome.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and pick the folder.
5. Open a new tab. If the browser asks whether to keep the change, choose **Keep changes**.

## Update

Replace the files in the folder with the new version, for example with `git pull`. Then open the extensions page and click the reload arrow on Tabsaic. Your links stay.

## Use

| What | How |
|---|---|
| Add a link | Click an empty slot. Or drag a link from another tab or the bookmarks bar onto an empty slot. |
| Edit or remove a link | Hover over the tile, then click the pencil or the ×. |
| Move a link | Drag the tile onto another slot. The two swap places. |
| Move a link to another topic | Drag the tile onto the topic button. |
| Switch topics | Click the topic, or press 1 to 4. |
| Rename a topic | Click the pencil next to the topics. |
| Reorder topics | Drag a topic button onto another one. |
| Find a link | Click the page once, then type. Enter opens the first match, Esc closes. |
| Undo | Click **Undo** in the bottom row, or press Cmd+Z / Ctrl+Z. |

The gear in the bottom row holds the rest:

- **Import from Favorites bar / Bookmarks bar:** adds all links from the bar to the empty slots. Links you already have are skipped.
- **Export backup:** saves all topics and links as one file in your Downloads folder.
- **Restore backup:** loads such a file. It replaces everything on the page.
- **Extensions:** opens the browser's extensions page.

## Keep your links safe

The links are stored inside the extension, per browser and per computer. They are lost if you remove the extension, or move or rename its folder. Use **Export backup** before you do that, and **Restore backup** afterwards. The same two steps copy your links to another browser or computer.

## Change the look

The values are at the top of `newtab.css`:

- Glaze colors: `--blue`, `--green`, `--saffron`, `--terracotta`.
- Tile shape: `--tile-gap`, `--tile-radius`, `--tile-max-height`.
- Star pattern behind the page: see the comment at `--mosaic`.

The number of topics and slots is at the top of `newtab.js`: `TOPIC_COUNT` and `SLOT_COUNT`.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | Tells the browser that this is a new tab extension. |
| `newtab.html`, `newtab.css`, `newtab.js` | The page. |
| `icons/` | The extension icon. `icon.svg` is the source. |
| `mosaic.svg`, `mosaic-dark.svg` | Optional star pattern for the page background. Off by default. |
| `tests/` | Scripted checks. See below. |

## Tests

```bash
tests/run.sh
```

This opens the page in headless Edge or Chrome with a stand-in for the browser's storage and bookmarks, clicks and drags through every feature, and prints the result. It needs Edge or Chrome installed. It does not touch your real browser profile.

## Origin of the artwork

The star pattern and the icon use the eight-point star and cross tiling, a traditional geometric pattern. All shapes were computed and drawn for this project. No existing image was used.
