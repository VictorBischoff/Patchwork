# Patchwork

**[▶ Live demo](https://victorbischoff.github.io/Patchwork/)**

**v1.2.1** — a self-contained patchbay designer for planning, labeling, and exporting audio patchbays. No build step and no install: it's plain HTML/CSS/JS that runs from a folder. (One optional CDN script is used only for `.xlsx` export; everything else works fully offline.)

## Run

Open `index.html` directly in a browser, or serve the folder:

```bash
python3 -m http.server 4178
# then visit http://localhost:4178
```

To deploy, host the folder on any static web server (GitHub Pages, Netlify, S3, nginx, …). There is nothing to build.

**Browser support:** any current Chromium, Firefox, or Safari. Uses CSS subgrid and the File / Blob APIs.

## Saving your work

Your patchbay **autosaves to the browser's local storage** as you edit (see the "Saved ✓" indicator, bottom-right), and is restored automatically the next time you open the page. Use **New** to start an empty bay, **Save** to export a file, and **Load** to import one. For sharing or backups, always export a `.json` — local storage is per-browser and can be cleared.

## Features

- **✨ AI Design** — enter your gear as structured rows (name, outs/ins on the bay, note — add and remove as needed), sketch **default routings** with a visual "outputs of A → inputs of B" builder whose dropdowns fill in from your gear list, and add free-text priorities; the whole form is kept as a draft on your device, and **💾 Save / 📂 Load** buttons export it to a `patchwork-gear.json` file for backup or moving between devices. Claude then lays out an optimal patchbay: outputs on the top row, inputs on the bottom, sensible normalling, and colour-coded categories with labels. A set channel count is enforced exactly (extra AI channels are dropped, never added), and after generating, a dismissible **Designer's notes** card explains the reasoning — group ordering, normalling choices, and trade-offs. Optionally tick **Research my gear online first** to have Claude look up each unit's exact I/O (channel counts, connector types, insert points) via Anthropic's server-side web search before designing — slower and slightly costlier, but more accurate for obscure gear. **Bring your own Anthropic API key** — it's entered in your browser, sent directly to Anthropic, and (optionally) stored only in this browser's local storage; it is never bundled with the app or sent anywhere else. Pick the format, channel count, and model (Opus 5 / Sonnet 5 / Haiku 4.5), or leave them on Auto. Get a key at [console.anthropic.com](https://console.anthropic.com/settings/keys); each design costs a few cents of API usage.
- **Format / size picker** — 16 (XLR), 48 (TRS), 72 / 96 (TT). Changing size grows or trims columns while preserving your data.
- **Single page, three stacked panels** — each panel has a collapsible header (click the chevron) and its own internal scroll, so everything stays visible without an endless page. The filter and category bar is pinned at the top and drives all three at once.
  - **Faceplate** — a 1U rack panel with the **Neutrik NYS-SPP-L1** layout finished in **vintage SSL-console grey**: warm satin metalwork with a beveled, light-catching top edge, chrome corner screws, dark engraved legend (numbers, **A**/**B** markers, labels), and nickel jack bushings. Shows **per-jack** category color rings and normalling pills. **Edit directly on the panel:** click a label to type, click the normalling pill to cycle modes, and click a jack to set its category / colour / note in a popover. Drag a column to reorder; double-click a channel number to open it in the table. Adjustable label-line count and column spacing. **Multi-select & bulk edit:** **shift-drag** a rubber-band box around jacks (or **shift-click** individual jacks) to select many at once, then set category / normalling / colour on all of them — selection is shared with the table.
  - **Label Designer** — sits directly under the faceplate, column-aligned like the real hardware. Printable label strip with custom **cell width / strip height (mm)**, **font / size / weight / uppercase**, **border width & color**, **strip background & text color**, and optional per-jack-color cell fills.
  - **Table** — spreadsheet-style editing with a **Top** and **Bottom** row per channel, each carrying its own label, category, color and note; channel #, drag handle and normalling span both. Drag the `⠿` handle to reorder. **Multi-select & bulk edit:** tick rows (shift-click for a range, or the header box to select all), then set **category, normalling, or colour** on every selected point at once.
- **Organize** — labels, per-point colors, color-coded **categories** (add / rename / recolor / delete), and free-text notes.
- **Normalling per point** — Normalled, Half-normalled, Thru (open), Parallel / Mult, each with its own color badge.
- **Filter** — live keyword filter across labels, categories, notes and normalling. Matching points highlight; the rest dim. `Cmd/Ctrl+F` focuses the filter.
- **Merge / split cells** — in the Label Designer, click (or shift-click a range) cells in the Top or Bottom lane, then **Merge** for L/R pairs or **Split** to restore. Top and bottom lanes merge independently.
- **Save / Load**:
  - **JSON** (`.json`) — full project incl. categories, label-strip design and merges. Re-loadable.
  - **Sheets** (`.csv`) — one row per jack. Importable.
  - **Excel** (`.xlsx`) — `Patchbay` + `Info` sheets (uses SheetJS via CDN; falls back to CSV offline).
  - **Print / PDF** — print just the label strip from the Label Designer.
- **Import from other tools** — Load auto-detects another common patchbay JSON schema (per-jack `jacks` + `channels`/`meta`) and maps labels, per-jack colours, categories, normalling, merge spans and print labels.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Markup and page scaffolding |
| `styles.css` | Dark UI theme |
| `app.js` | State model, rendering, editing, drag-drop, import/export, autosave |
| `favicon.svg` | App icon |

## License

Released under the [MIT License](LICENSE).
