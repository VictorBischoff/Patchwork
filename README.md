# Patchwork

**v1.0.0** — a self-contained patchbay designer for planning, labeling, and exporting audio patchbays. No build step and no install: it's plain HTML/CSS/JS that runs from a folder. (One optional CDN script is used only for `.xlsx` export; everything else works fully offline.)

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

- **Format / size picker** — 16 (XLR), 48 (TRS), 72 / 96 (TT). Changing size grows or trims columns while preserving your data.
- **Single page, three stacked panels** — each panel has a collapsible header (click the chevron) and its own internal scroll, so everything stays visible without an endless page. The filter and category bar is pinned at the top and drives all three at once.
  - **Faceplate** — a 1U rack panel with the **Neutrik NYS-SPP-L1** layout finished in **vintage SSL-console grey**: warm satin metalwork with a beveled, light-catching top edge, chrome corner screws, dark engraved legend (numbers, **A**/**B** markers, labels), and nickel jack bushings. Shows **per-jack** category color rings and normalling pills. **Edit directly on the panel:** click a label to type, click the normalling pill to cycle modes, and click a jack to set its category / colour / note in a popover. Drag a column to reorder; double-click a channel number to open it in the table. Adjustable label-line count and column spacing.
  - **Label Designer** — sits directly under the faceplate, column-aligned like the real hardware. Printable label strip with custom **cell width / strip height (mm)**, **font / size / weight / uppercase**, **border width & color**, **strip background & text color**, and optional per-jack-color cell fills.
  - **Table** — spreadsheet-style editing with a **Top** and **Bottom** row per channel, each carrying its own label, category, color and note; channel #, drag handle and normalling span both. Drag the `⠿` handle to reorder.
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
