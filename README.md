# Tabsaic

A new tab page for Edge and Chrome. Your links as big colored tiles, grouped by topic, on one page without scrolling. Inspired by mosaic.

Your links stay in your browser. No account, no sync, no tracking.

## Install

1. Clone this repository, or download it as a zip and unpack it. Put the folder where it can stay.
2. Open `edge://extensions` (Edge) or `chrome://extensions` (Chrome).
3. Turn on **Developer mode**, click **Load unpacked** and pick the folder.
4. Open a new tab. If the browser asks whether to keep the change, choose **Keep changes**.

To update, replace the files (for example with `git pull`) and click the reload arrow on Tabsaic in the extensions page.

## Use

| What | How |
|---|---|
| Add a link | Click an empty slot, or drag a link onto it. |
| Edit or remove a link | Hover over the tile, then click the pencil or the ×. |
| Move a link | Drag the tile onto another slot or onto a topic. |
| Switch topics | Click the topic, or press 1 to 4. |
| Rename or reorder topics | Pencil next to the topics. Drag a topic onto another one. |
| Find a link | Click the page once, then type. Enter opens the first match. |
| Undo | **Undo** in the bottom row, or Cmd+Z / Ctrl+Z. |

The gear in the bottom row imports the links from your bookmarks bar, and exports or restores a backup file.

## Keep your links safe

The links are stored inside the extension. They are lost if you remove the extension, or move or rename its folder. Use **Export backup** before and **Restore backup** after. The same two steps copy your links to another browser or computer.

## Change the look

Colors and tile shape are at the top of `newtab.css`. The number of topics and slots is at the top of `newtab.js`.
