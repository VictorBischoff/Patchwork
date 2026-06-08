/* PatchPlanerUltra — patchbay designer
   Self-contained vanilla JS. State -> render for three views. */

'use strict';

/* ---------------- Constants ---------------- */
const NORMALLING = {
  normalled: { label: 'Normalled',       abbr: 'NRM' },
  half:      { label: 'Half-normalled',  abbr: 'HALF' },
  thru:      { label: 'Thru (open)',     abbr: 'THRU' },
  parallel:  { label: 'Parallel / Mult', abbr: 'PAR' },
};
const NORM_ORDER = ['normalled', 'half', 'thru', 'parallel'];

const DEFAULT_CAT_COLORS = ['#5b9dff', '#3fb950', '#d29922', '#f85149', '#a371f7', '#2ea3a3', '#e96fb3', '#c9a227'];

const uid = () => Math.random().toString(36).slice(2, 9);

const APP_VERSION = '1.0.0';
const STORAGE_KEY = 'patchplanerultra.autosave.v1';

/* ---------------- State ---------------- */
let state = freshState('TRS', 24);
let ui = {
  collapsed: { faceplate: false, table: true, labels: true },
  catsCollapsed: false,
  filter: '',
  lane: 'top',            // label designer active lane
  selectedCells: new Set(), // indices in active lane
};

function freshState(format, count) {
  return {
    name: 'Untitled Patchbay',
    format,
    count,
    columns: Array.from({ length: count }, () => newColumn()),
    categories: [
      { id: 'c-mic', name: 'Mics', color: '#5b9dff' },
      { id: 'c-pre', name: 'Preamps', color: '#2ea3a3' },
      { id: 'c-out', name: 'Outboard', color: '#3fb950' },
      { id: 'c-inst', name: 'Instruments', color: '#e0913d' },
      { id: 'c-synth', name: 'Synths', color: '#a371f7' },
      { id: 'c-samp', name: 'Sampler', color: '#e96fb3' },
      { id: 'c-mix', name: 'Mixer', color: '#d29922' },
      { id: 'c-daw', name: 'DAW / Interface', color: '#56b6c2' },
      { id: 'c-fx', name: 'FX', color: '#c678dd' },
      { id: 'c-mon', name: 'Monitors', color: '#f0a500' },
      { id: 'c-cue', name: 'Headphones', color: '#7f8c9b' },
    ],
    faceplate: defaultFaceplate(),
    labelStrip: defaultLabelStrip(),
  };
}
// Fresh default sub-objects (new instances each call so states never share mutable arrays).
function defaultFaceplate() { return { labelLines: 2, gap: 4 }; }
function defaultLabelStrip() {
  return {
    cellW: 12, height: 9, font: "'Helvetica Neue', Arial, sans-serif",
    fontSize: 7, weight: 600, upper: true,
    borderW: 0.5, borderColor: '#222222',
    bg: '#f4f4f0', fg: '#111111', useCat: false,
    merges: { top: [], bottom: [] }, // each: {start, span}
  };
}

function newJack() { return { label: '', category: '', color: '', note: '', printLabel: '' }; }
function newColumn() {
  return { id: uid(), norm: 'half', top: newJack(), bottom: newJack() };
}
// Migrate a v1 (flat string) column or partial object to the per-jack shape.
function migrateColumn(c) {
  const col = newColumn();
  if (c == null) return col;
  if (c.id) col.id = c.id;
  if (c.norm) col.norm = c.norm;
  // v2 already nested
  if (typeof c.top === 'object' && c.top) col.top = Object.assign(newJack(), c.top);
  else { col.top = Object.assign(newJack(), { label: c.top || '', category: c.category || '', color: c.color || '', note: c.note || '' }); }
  if (typeof c.bottom === 'object' && c.bottom) col.bottom = Object.assign(newJack(), c.bottom);
  else { col.bottom = Object.assign(newJack(), { label: c.bottom || '', category: c.category || '', color: c.color || '', note: c.note || '' }); }
  return col;
}

/* ---------------- DOM helpers ---------------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c != null) node.append(c.nodeType ? c : document.createTextNode(c));
  return node;
}
function status(msg) { $('#status').textContent = msg; }

/* ---------------- Filtering ---------------- */
function matches(col) {
  const q = ui.filter.trim().toLowerCase();
  if (!q) return true;
  const parts = [];
  for (const lane of ['top', 'bottom']) {
    const j = col[lane];
    const cat = catById(j.category);
    parts.push(j.label, j.note, j.printLabel, cat ? cat.name : '');
  }
  parts.push(NORMALLING[col.norm].label);
  return parts.join(' ').toLowerCase().includes(q);
}
function catById(id) { return state.categories.find((c) => c.id === id) || null; }
// Resolve a jack's effective color: explicit override, else its category color.
function jackColor(jack) {
  if (!jack) return '';
  if (jack.color) return jack.color;
  const c = catById(jack.category);
  return c ? c.color : '';
}

/* ---------------- Render: dispatch ---------------- */
function render() {
  $('#countBadge').textContent = `${state.count} points · ${state.format}`;
  $('#pointCount').value = state.count;
  renderFormatButtons();
  renderCats();
  if (!ui.collapsed.faceplate) renderFaceplate();
  if (!ui.collapsed.labels) renderLabels();
  if (!ui.collapsed.table) renderTable();
}

function renderFormatButtons() {
  $$('.fmt').forEach((b) => {
    const active = b.dataset.format === state.format && Number(b.dataset.count) === state.count;
    b.classList.toggle('active', active);
  });
}

/* ---------------- Categories ---------------- */
function renderCats() {
  const wrap = $('#catChips');
  wrap.innerHTML = '';
  const count = $('#catCount');
  if (count) count.textContent = `(${state.categories.length})`;
  state.categories.forEach((c) => {
    const chip = el('span', { class: 'cat-chip', title: 'Click to rename · colour to recolour' }, [
      el('span', { class: 'dot', style: { background: c.color } }),
      el('input', {
        type: 'color', value: c.color, style: { width: '0', height: '0', opacity: '0', position: 'absolute' },
        onchange: (e) => { c.color = e.target.value; render(); },
        id: `catcolor-${c.id}`,
      }),
      el('span', { text: c.name, onclick: () => renameCat(c) }),
      el('span', { class: 'x', text: '✕', onclick: (e) => { e.stopPropagation(); deleteCat(c); } }),
    ]);
    chip.querySelector('.dot').addEventListener('click', () => $(`#catcolor-${c.id}`).click());
    wrap.append(chip);
  });
}
function renameCat(c) {
  const name = prompt('Category name:', c.name);
  if (name != null && name.trim()) { c.name = name.trim(); render(); }
}
function deleteCat(c) {
  if (!confirm(`Delete category “${c.name}”? Points keep their colours.`)) return;
  state.columns.forEach((col) => { if (col.category === c.id) col.category = ''; });
  state.categories = state.categories.filter((x) => x.id !== c.id);
  render();
}
function addCat() {
  const name = prompt('New category name:');
  if (!name || !name.trim()) return;
  const color = DEFAULT_CAT_COLORS[state.categories.length % DEFAULT_CAT_COLORS.length];
  state.categories.push({ id: 'c-' + uid(), name: name.trim(), color });
  render();
}

/* ---------------- Faceplate view ---------------- */
function renderFaceplate() {
  const fp = $('#faceplate');
  // Capture scroll BEFORE clearing — once emptied the container collapses to scrollLeft 0,
  // so reading it afterwards would always restore to the start.
  const scroller = $('.faceplate-scroll');
  const savedScroll = scroller ? scroller.scrollLeft : 0;
  fp.innerHTML = '';
  const fpCfg = state.faceplate;
  fp.style.setProperty('--fp-lines', fpCfg.labelLines);
  fp.style.setProperty('--fp-gap', fpCfg.gap + 'px');
  $('#fp-lines').value = fpCfg.labelLines;
  $('#fp-gap').value = fpCfg.gap;
  const earModel = $('#earModel');
  if (earModel) earModel.textContent = `ULTRA · ${state.format}`;
  const filtering = ui.filter.trim() !== '';
  state.columns.forEach((col, idx) => {
    const isMatch = matches(col);
    const colNode = el('div', {
      class: 'fp-col' + (filtering ? (isMatch ? ' match' : ' dimmed') : ''),
      draggable: 'true', 'data-idx': idx,
    });
    const num = el('div', { class: 'fp-num', text: String(idx + 1), title: 'Double-click → open in table',
      ondblclick: () => revealTable(col.id) });
    const normBadge = el('div', {
      class: 'fp-norm', text: NORMALLING[col.norm].abbr, title: 'Click to cycle — ' + NORMALLING[col.norm].label,
      onclick: (e) => { e.stopPropagation(); cycleNorm(col); },
      ondblclick: (e) => e.stopPropagation(),
    });
    colNode.append(
      num,
      fpLabel(col.top, colNode),
      jackNode(col, 'top'),
      normBadge,
      jackNode(col, 'bottom'),
      fpLabel(col.bottom, colNode),
    );
    attachColDrag(colNode, idx);
    fp.append(colNode);
  });
  if (scroller) scroller.scrollLeft = savedScroll;
}
// Inline-editable jack label. Disables column drag while editing so text can be selected.
function fpLabel(jack, colNode) {
  return el('input', {
    class: 'fp-lbl-input', value: jack.label, placeholder: '—', spellcheck: 'false', title: jack.label,
    onmousedown: () => { colNode.draggable = false; },
    onfocus: () => { colNode.draggable = false; },
    onblur: (e) => { colNode.draggable = true; jack.label = e.target.value; e.target.title = e.target.value; touch(); renderOthers('faceplate'); },
    oninput: (e) => { jack.label = e.target.value; },
    onkeydown: (e) => {
      if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
      else if (e.key === 'Escape') { e.target.value = jack.label; e.target.blur(); }
    },
    ondblclick: (e) => e.stopPropagation(),
  });
}
function jackNode(col, lane) {
  const color = jackColor(col[lane]);
  const j = el('div', {
    class: 'jack' + (color ? ' cat-fill' : ''), title: 'Click to set category / colour / note',
    onclick: (e) => { e.stopPropagation(); openJackPopover(col, lane, j); },
    ondblclick: (e) => e.stopPropagation(),
  });
  if (color) j.style.setProperty('--cat', color);
  return j;
}
function cycleNorm(col) {
  const i = NORM_ORDER.indexOf(col.norm);
  col.norm = NORM_ORDER[(i + 1) % NORM_ORDER.length];
  touch(); renderFaceplate(); renderOthers('faceplate');
}
// Re-render the open panels except the one being actively edited, so inline edits
// stay in sync without rebuilding (and stealing focus from) the panel in use.
function renderOthers(except) {
  if (except !== 'faceplate' && !ui.collapsed.faceplate) renderFaceplate();
  if (except !== 'table' && !ui.collapsed.table) renderTable();
  if (except !== 'labels' && !ui.collapsed.labels) renderLabels();
}
// Filtering only toggles match/dimmed classes on existing nodes — no rebuild,
// so typing in the filter stays fast even at 96 channels.
function applyFilter() {
  const filtering = ui.filter.trim() !== '';
  if (!ui.collapsed.faceplate) {
    $$('#faceplate .fp-col').forEach((node) => {
      const m = matches(state.columns[+node.dataset.idx]);
      node.classList.toggle('match', filtering && m);
      node.classList.toggle('dimmed', filtering && !m);
    });
  }
  if (!ui.collapsed.table) {
    $$('#gridBody tr').forEach((tr) => {
      tr.classList.toggle('dimmed', filtering && !matches(state.columns[+tr.dataset.idx]));
    });
  }
}

/* ---- Faceplate jack popover (category / colour / note) ---- */
let openPop = null;
function closePop() {
  if (!openPop) return;
  openPop.remove(); openPop = null;
  document.removeEventListener('mousedown', popOutside, true);
  document.removeEventListener('keydown', popKey, true);
}
function popOutside(e) { if (openPop && !openPop.contains(e.target)) closePop(); }
function popKey(e) { if (e.key === 'Escape') closePop(); }
function popRow(label, control) {
  return el('div', { class: 'pop-row' }, [el('span', { text: label }), control]);
}
function openJackPopover(col, lane, anchor) {
  closePop();
  const jack = col[lane];
  const idx = state.columns.indexOf(col) + 1;
  const commit = () => { touch(); renderFaceplate(); renderOthers('faceplate'); };

  const catSel = el('select', { onchange: (e) => { jack.category = e.target.value; commit(); } });
  catSel.append(el('option', { value: '', text: '— no category —' }));
  state.categories.forEach((c) => {
    const o = el('option', { value: c.id, text: c.name });
    if (c.id === jack.category) o.selected = true;
    catSel.append(o);
  });

  const colorInp = el('input', { type: 'color', value: jack.color || jackColor(jack) || '#888888',
    oninput: (e) => { jack.color = e.target.value; commit(); } });
  const resetColor = el('button', { class: 'ghost', text: '⟲', title: 'Use category colour',
    onclick: () => { jack.color = ''; closePop(); commit(); } });

  const noteInp = el('input', { type: 'text', value: jack.note || '', placeholder: 'note…',
    oninput: (e) => { jack.note = e.target.value; }, onchange: () => { touch(); renderOthers('faceplate'); } });

  const pop = el('div', { class: 'fp-popover' }, [
    el('div', { class: 'pop-head', text: `${lane === 'top' ? 'Top' : 'Bottom'} jack · channel ${idx}` }),
    popRow('Category', catSel),
    popRow('Colour', el('div', { class: 'color-cell' }, [colorInp, resetColor])),
    popRow('Note', noteInp),
  ]);
  document.body.append(pop);
  const r = anchor.getBoundingClientRect();
  const w = 210;
  let left = r.left + r.width / 2 - w / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
  pop.style.left = left + 'px';
  pop.style.top = (r.bottom + 8) + 'px';
  openPop = pop;
  setTimeout(() => {
    document.addEventListener('mousedown', popOutside, true);
    document.addEventListener('keydown', popKey, true);
  }, 0);
}
function renderLegend() {
  const lg = $('#legend');
  lg.innerHTML = '';
  lg.append(el('div', { class: 'item', html: '<b>Click</b> a label to edit · <b>click</b> a jack for category/colour · <b>click</b> the badge to cycle normalling · <b>double-click #</b> → table' }));
  NORM_ORDER.forEach((n) => {
    lg.append(el('div', { class: 'item' }, [
      el('span', { class: 'fp-norm', text: NORMALLING[n].abbr }),
      el('span', { text: NORMALLING[n].label }),
    ]));
  });
}

/* ---------------- Table view ---------------- */
function renderTable() {
  const body = $('#gridBody');
  body.innerHTML = '';
  const filtering = ui.filter.trim() !== '';
  state.columns.forEach((col, idx) => {
    const dim = filtering && !matches(col);
    const base = (dim ? ' dimmed' : '') + (idx % 2 ? ' band' : ''); // zebra band per channel
    // TOP row carries the rowspan cells (drag handle, #, normalling)
    const trTop = el('tr', { class: 'ch-top' + base, 'data-idx': idx, 'data-id': col.id });
    trTop.append(el('td', { class: 'drag-handle', draggable: 'true', rowspan: '2', text: '⠿', title: 'Drag to reorder channel' }));
    trTop.append(el('td', { class: 'num-col', rowspan: '2' }, el('span', { class: 'ch-chip', text: String(idx + 1) })));
    trTop.append(el('td', { class: 'row-tag' }, el('span', { class: 'tag tag-top', text: 'TOP' })));
    trTop.append(tdLabel(col.top));
    trTop.append(tdCat(col.top));
    trTop.append(tdColor(col.top));
    trTop.append(tdNorm(col)); // rowspan 2
    trTop.append(tdLabel(col.top, 'note'));
    attachRowDrag(trTop, idx);
    body.append(trTop);
    // BOTTOM row
    const trBot = el('tr', { class: 'ch-bottom' + base, 'data-idx': idx });
    trBot.append(el('td', { class: 'row-tag' }, el('span', { class: 'tag tag-bot', text: 'BOT' })));
    trBot.append(tdLabel(col.bottom));
    trBot.append(tdCat(col.bottom));
    trBot.append(tdColor(col.bottom));
    trBot.append(tdLabel(col.bottom, 'note'));
    body.append(trBot);
  });
}
function tdLabel(jack, field = 'label') {
  const td = el('td');
  td.append(el('input', {
    value: jack[field] || '', placeholder: field === 'note' ? 'note…' : '',
    oninput: (e) => { jack[field] = e.target.value; },
    onchange: () => { touch(); renderOthers('table'); },
  }));
  return td;
}
function tdCat(jack) {
  const sel = el('select', { onchange: (e) => { jack.category = e.target.value; touch(); render(); } });
  sel.append(el('option', { value: '', text: '— none —' }));
  state.categories.forEach((c) => {
    const o = el('option', { value: c.id, text: c.name });
    if (c.id === jack.category) o.selected = true;
    sel.append(o);
  });
  return el('td', {}, sel);
}
function tdColor(jack) {
  const input = el('input', {
    type: 'color', value: jack.color || jackColor(jack) || '#888888',
    onchange: (e) => { jack.color = e.target.value; touch(); render(); },
  });
  const clear = el('span', { class: 'ghost', text: '⟲', title: 'Use category colour', onclick: () => { jack.color = ''; touch(); render(); } });
  return el('td', {}, el('div', { class: 'color-cell' }, [input, clear]));
}
function tdNorm(col) {
  const sel = el('select', { class: 'norm-select', onchange: (e) => { col.norm = e.target.value; touch(); render(); } });
  NORM_ORDER.forEach((n) => {
    const o = el('option', { value: n, text: NORMALLING[n].label });
    if (n === col.norm) o.selected = true;
    sel.append(o);
  });
  return el('td', { rowspan: '2', class: 'norm-cell' },
    el('div', { class: 'norm-wrap n-' + col.norm }, [el('span', { class: 'norm-dot' }), sel]));
}
function focusRow(id) {
  const tr = $(`tr[data-id="${id}"]`);
  if (tr) { tr.scrollIntoView({ block: 'center' }); tr.querySelector('input').focus(); }
}
function touch() { state.modified = Date.now(); schedulePersist(); }

/* ---------------- Autosave (localStorage) ---------------- */
let persistTimer = null;
function schedulePersist() {
  setSaveState('saving');
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persistNow, 600);
}
function persistNow() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot())); setSaveState('saved'); }
  catch (e) { setSaveState('error'); }
}
function setSaveState(s) {
  const node = $('#saveState');
  if (!node) return;
  node.textContent = s === 'saving' ? 'Saving…' : s === 'saved' ? 'Saved ✓' : s === 'error' ? 'Autosave unavailable' : '';
  node.className = 'save-state ' + s;
}
function restoreAutosave() {
  let raw;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { return false; }
  if (!raw) return false;
  try { loadJSON(raw); return true; } catch (e) { return false; }
}
function newBay() {
  if (!confirm('Start a new, empty patchbay? This clears the current one (your autosave is replaced).')) return;
  state = freshState(state.format, state.count);
  ui.selectedCells.clear();
  $('#bayName').value = state.name;
  render(); persistNow();
  status('New patchbay started.');
}

/* ---------------- Drag & drop (shared reorder) ---------------- */
let dragFrom = null;
function moveColumn(from, to) {
  if (from === to || from == null) return;
  const [m] = state.columns.splice(from, 1);
  state.columns.splice(to > from ? to - 1 : to, 0, m);
  touch();
  render();
}
function attachColDrag(node, idx) {
  node.addEventListener('dragstart', (e) => { dragFrom = idx; node.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
  node.addEventListener('dragend', () => { node.classList.remove('dragging'); $$('.drop-target').forEach((n) => n.classList.remove('drop-target')); });
  node.addEventListener('dragover', (e) => { e.preventDefault(); node.classList.add('drop-target'); });
  node.addEventListener('dragleave', () => node.classList.remove('drop-target'));
  node.addEventListener('drop', (e) => { e.preventDefault(); moveColumn(dragFrom, idx); dragFrom = null; });
}
function attachRowDrag(tr, idx) {
  const handle = tr.querySelector('.drag-handle');
  handle.addEventListener('dragstart', (e) => { dragFrom = idx; tr.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text', ''); });
  handle.addEventListener('dragend', () => { tr.classList.remove('dragging'); $$('.drop-target').forEach((n) => n.classList.remove('drop-target')); });
  tr.addEventListener('dragover', (e) => { e.preventDefault(); tr.classList.add('drop-target'); });
  tr.addEventListener('dragleave', () => tr.classList.remove('drop-target'));
  tr.addEventListener('drop', (e) => { e.preventDefault(); moveColumn(dragFrom, idx); dragFrom = null; });
}

/* ---------------- Label Designer ---------------- */
function renderLabels() {
  const ls = state.labelStrip;
  // sync controls
  $('#ls-cellw').value = ls.cellW; $('#ls-height').value = ls.height;
  $('#ls-font').value = ls.font; $('#ls-fontsize').value = ls.fontSize;
  $('#ls-weight').value = ls.weight; $('#ls-upper').checked = ls.upper;
  $('#ls-bw').value = ls.borderW; $('#ls-bc').value = ls.borderColor;
  $('#ls-bg').value = ls.bg; $('#ls-fg').value = ls.fg; $('#ls-usecat').checked = ls.useCat;
  $$('.lane-btn').forEach((b) => b.classList.toggle('active', b.dataset.lane === ui.lane));

  renderStrip('top', $('#stripTop'));
  renderStrip('bottom', $('#stripBottom'));
  renderRuler();
}
const MM = 3.78; // px per mm at 96dpi
function renderRuler() {
  const ls = state.labelStrip;
  const totalMm = state.count * ls.cellW;
  $('#ruler').textContent = `Strip: ${totalMm.toFixed(0)} mm × ${ls.height} mm  (${state.count} cells × ${ls.cellW} mm)`;
}
function laneText(col, lane) { const j = col[lane]; return j.printLabel || j.label; }

function renderStrip(lane, container) {
  const ls = state.labelStrip;
  container.innerHTML = '';
  const merges = ls.merges[lane];
  const mergeAt = (i) => merges.find((m) => i >= m.start && i < m.start + m.span);
  const cellPx = ls.cellW * MM;
  const heightPx = ls.height * MM;

  let i = 0;
  while (i < state.count) {
    const idx = i; // per-iteration capture for the click closure below
    const m = mergeAt(idx);
    const span = m ? m.span : 1;
    const col = state.columns[idx];
    const text = (m && m.text) ? m.text : (laneText(col, lane) || '');
    const display = ls.upper ? text.toUpperCase() : text;
    const fill = ls.useCat ? (jackColor(col[lane]) || ls.bg) : ls.bg;
    const cell = el('div', {
      class: 'label-cell' + (ui.lane === lane && isSelected(lane, idx) ? ' selected' : ''),
      'data-idx': idx, 'data-lane': lane,
      style: {
        width: (cellPx * span) + 'px', height: heightPx + 'px',
        background: fill, color: ls.fg,
        font: `${ls.weight} ${ls.fontSize}pt ${ls.font}`,
        border: `${ls.borderW}px solid ${ls.borderColor}`,
      },
      text: display,
      title: m ? `Merged cells ${m.start + 1}–${m.start + m.span}` : `Cell ${idx + 1}`,
    });
    cell.addEventListener('click', (e) => onCellClick(lane, idx, e));
    container.append(cell);
    i += span;
  }
}
function isSelected(lane, i) { return ui.lane === lane && ui.selectedCells.has(i); }
function onCellClick(lane, i, e) {
  if (ui.lane !== lane) { ui.lane = lane; ui.selectedCells.clear(); }
  if (e.shiftKey && ui.selectedCells.size) {
    const arr = [...ui.selectedCells];
    const last = arr[arr.length - 1];
    const [a, b] = [Math.min(last, i), Math.max(last, i)];
    for (let k = a; k <= b; k++) ui.selectedCells.add(k);
  } else if (e.metaKey || e.ctrlKey) {
    ui.selectedCells.has(i) ? ui.selectedCells.delete(i) : ui.selectedCells.add(i);
  } else {
    ui.selectedCells.clear(); ui.selectedCells.add(i);
  }
  renderLabels();
}
// Derive a sensible label for a merged cell: the shared base of the cells'
// labels (e.g. "COMP L" + "COMP R" -> "COMP"), else the first label.
function smartMergeLabel(labels) {
  const items = labels.map((s) => (s || '').trim()).filter(Boolean);
  if (items.length <= 1) return items[0] || '';
  let prefix = items[0];
  for (let n = 1; n < items.length && prefix; n++) {
    const s = items[n];
    let k = 0;
    while (k < prefix.length && k < s.length && prefix[k].toLowerCase() === s[k].toLowerCase()) k++;
    prefix = prefix.slice(0, k);
  }
  prefix = prefix.replace(/[\s\-_/.]+$/, '').trim(); // drop trailing separators (the "L"/"R" divider)
  // Only use the prefix if the labels actually differ by a suffix; otherwise keep the first label.
  if (prefix && items.some((s) => s.toLowerCase() !== prefix.toLowerCase())) return prefix;
  return items[0];
}
function mergeCells() {
  const lane = ui.lane;
  const sel = [...ui.selectedCells].sort((a, b) => a - b);
  if (sel.length < 2) { status('Select 2+ adjacent cells to merge.'); return; }
  const start = sel[0], end = sel[sel.length - 1];
  if (end - start + 1 !== sel.length) { status('Merge requires a contiguous range.'); return; }
  // remove overlapping merges, then add
  const merges = state.labelStrip.merges[lane].filter((m) => m.start + m.span <= start || m.start > end);
  const labels = [];
  for (let k = start; k <= end; k++) { const j = state.columns[k][lane]; labels.push(j.label || j.printLabel || ''); }
  const smart = smartMergeLabel(labels);
  const merge = { start, span: end - start + 1 };
  if (smart) merge.text = smart;
  merges.push(merge);
  merges.sort((a, b) => a.start - b.start);
  state.labelStrip.merges[lane] = merges;
  ui.selectedCells = new Set([start]);
  touch(); renderLabels();
  status(`Merged cells ${start + 1}–${end + 1}${smart ? ` as “${smart}”` : ''} on ${lane} lane.`);
}
function splitCells() {
  const lane = ui.lane;
  const before = state.labelStrip.merges[lane].length;
  state.labelStrip.merges[lane] = state.labelStrip.merges[lane].filter((m) => {
    return ![...ui.selectedCells].some((i) => i >= m.start && i < m.start + m.span);
  });
  touch(); renderLabels();
  status(before === state.labelStrip.merges[lane].length ? 'No merged cells in selection.' : 'Split selection back to single cells.');
}

/* ---------------- Format / count change ---------------- */
function setFormat(format, count) {
  if (count === state.count && format === state.format) return;
  state.format = format;
  if (count > state.count) {
    for (let i = state.count; i < count; i++) state.columns.push(newColumn());
  } else if (count < state.count) {
    if (!confirm(`Reduce to ${count} points? The last ${state.count - count} columns will be removed.`)) { renderFormatButtons(); return; }
    state.columns = state.columns.slice(0, count);
    // trim merges
    ['top', 'bottom'].forEach((l) => {
      state.labelStrip.merges[l] = state.labelStrip.merges[l].filter((m) => m.start + m.span <= count);
    });
  }
  state.count = count;
  ui.selectedCells.clear();
  touch(); render();
  status(`Format set to ${count} · ${format}.`);
}

/* ---------------- Panel collapse / focus ---------------- */
function setPanelCollapsed(name, collapsed) {
  ui.collapsed[name] = collapsed;
  $(`#panel-${name}`).classList.toggle('collapsed', collapsed);
  if (!collapsed) render(); // rebuild body that was skipped while collapsed
}
function togglePanel(name) { setPanelCollapsed(name, !ui.collapsed[name]); }
function revealTable(id) {
  setPanelCollapsed('table', false);
  $('#panel-table').scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => focusRow(id), 120);
}

/* ---------------- Export ---------------- */
function rowsForExport() {
  const rows = [];
  state.columns.forEach((col, i) => {
    for (const lane of ['top', 'bottom']) {
      const j = col[lane];
      const cat = catById(j.category);
      rows.push({
        'Channel': i + 1,
        'Row': lane === 'top' ? 'Top' : 'Bottom',
        'Label': j.label,
        'Category': cat ? cat.name : '',
        'Color': jackColor(j),
        'Normalling': NORMALLING[col.norm].label,
        'Note': j.note,
      });
    }
  });
  return rows;
}
function download(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
// Single source of truth for the serialized project (used by export + autosave).
function snapshot() {
  const { app, version, ...rest } = state; // drop any echoed metadata fields
  return { app: 'PatchPlanerUltra', version: APP_VERSION, ...rest, name: ($('#bayName') ? $('#bayName').value : state.name) };
}
function exportJSON() {
  download(safeName() + '.json', new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' }));
  status('Exported JSON.');
}
function exportCSV() {
  const rows = rowsForExport();
  const headers = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\r\n');
  download(safeName() + '.csv', new Blob([csv], { type: 'text/csv' }));
  status('Exported CSV (Sheets).');
}
function exportXLSX() {
  if (typeof XLSX === 'undefined') { status('XLSX library not loaded — exporting CSV instead.'); exportCSV(); return; }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rowsForExport());
  ws['!cols'] = [{ wch: 8 }, { wch: 8 }, { wch: 22 }, { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Patchbay');
  // metadata sheet
  const meta = XLSX.utils.json_to_sheet([
    { Property: 'Name', Value: $('#bayName').value },
    { Property: 'Format', Value: state.format },
    { Property: 'Points', Value: state.count },
    { Property: 'Categories', Value: state.categories.map((c) => c.name).join(', ') },
  ]);
  XLSX.utils.book_append_sheet(wb, meta, 'Info');
  XLSX.writeFile(wb, safeName() + '.xlsx');
  status('Exported Excel (.xlsx).');
}
function safeName() { return ($('#bayName').value || 'patchbay').replace(/[^\w-]+/g, '_'); }

/* ---------------- Import ---------------- */
function importFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      if (file.name.toLowerCase().endsWith('.json')) loadJSON(reader.result);
      else loadCSV(reader.result);
    } catch (err) { status('Import failed: ' + err.message); alert('Could not load file: ' + err.message); }
  };
  reader.readAsText(file);
}
function loadJSON(text) {
  const data = JSON.parse(text);
  // Foreign patchbay schema (jacks + channels/meta) from other services
  if (Array.isArray(data.jacks) || Array.isArray(data.channels) || (data.meta && data.meta.totalJacks)) {
    importForeign(data);
    return;
  }
  if (!data.columns) throw new Error('Unrecognized file — no columns or jacks found.');
  state = Object.assign(freshState(data.format || 'TT', data.count || data.columns.length), data);
  state.count = data.columns.length;
  state.columns = data.columns.map((c) => migrateColumn(c));
  // Merge over fresh defaults so older / partial files still get every field.
  state.faceplate = Object.assign(defaultFaceplate(), state.faceplate || {});
  state.labelStrip = Object.assign(defaultLabelStrip(), state.labelStrip || {});
  const mg = state.labelStrip.merges;
  state.labelStrip.merges = { top: (mg && mg.top) || [], bottom: (mg && mg.bottom) || [] };
  ui.selectedCells.clear();
  $('#bayName').value = state.name || 'Untitled Patchbay';
  render();
  status(`Loaded “${state.name}” — ${state.count} channels.`);
}

/* Map another service's normalling codes to ours. */
const FOREIGN_NORM = {
  N: 'normalled', FN: 'normalled', NORM: 'normalled',
  HN: 'half', H: 'half', HALF: 'half',
  T: 'thru', THRU: 'thru', O: 'thru', NN: 'thru', OPEN: 'thru',
  P: 'parallel', PAR: 'parallel', M: 'parallel', MULT: 'parallel',
};
function mapForeignNorm(...codes) {
  for (const c of codes) {
    if (!c) continue;
    const m = FOREIGN_NORM[String(c).toUpperCase()];
    if (m) return m;
  }
  return 'half';
}
function mapForeignFont(f) {
  const k = (f || '').toLowerCase();
  if (k.includes('impact')) return 'Impact, sans-serif';
  if (k.includes('courier') || k.includes('mono')) return "'Courier New', monospace";
  if (k.includes('georgia') || k.includes('serif')) return 'Georgia, serif';
  if (k.includes('narrow')) return "'Arial Narrow', sans-serif";
  return "'Helvetica Neue', Arial, sans-serif";
}
function ensureCatByName(name) {
  if (!name) return '';
  let cat = state.categories.find((x) => x.name.toLowerCase() === String(name).toLowerCase());
  if (!cat) {
    cat = { id: 'c-' + uid(), name: String(name), color: DEFAULT_CAT_COLORS[state.categories.length % DEFAULT_CAT_COLORS.length] };
    state.categories.push(cat);
  }
  return cat.id;
}
function guessFormat(channelCount) {
  if (channelCount <= 16) return 'XLR';
  if (channelCount <= 48) return 'TRS';
  return 'TT';
}
function importForeign(data) {
  const jacks = data.jacks || [];
  // Determine channel indices/order
  let chIndices;
  if (Array.isArray(data.channels) && data.channels.length) {
    chIndices = data.channels.slice().sort((a, b) => a.index - b.index).map((c) => c.index);
  } else {
    chIndices = [...new Set(jacks.map((j) => j.channelIndex))].sort((a, b) => a - b);
  }
  const chNorm = {};
  (data.channels || []).forEach((c) => { chNorm[c.index] = c.normalMode; });

  state = freshState(guessFormat(chIndices.length), chIndices.length);
  state.name = (data.meta && data.meta.name) || 'Imported Patchbay';
  state.labelStrip.merges = { top: [], bottom: [] };
  let fontApplied = false;

  state.columns = chIndices.map((chIdx, pos) => {
    const col = newColumn();
    const topJack = jacks.find((j) => j.channelIndex === chIdx && j.position === 'top');
    const botJack = jacks.find((j) => j.channelIndex === chIdx && j.position === 'bottom');
    const fill = (jack, lane) => {
      if (!jack) return newJack();
      const j = newJack();
      j.label = jack.shortLabel || '';
      j.note = jack.notes || '';
      j.color = jack.color || '';
      j.category = ensureCatByName(jack.category);
      const pp = jack.printPrefs || {};
      if (pp.printLabel) j.printLabel = pp.printLabel;
      if (pp.mergeSpan && pp.mergeSpan > 1) state.labelStrip.merges[lane].push({ start: pos, span: pp.mergeSpan });
      // adopt first seen print typography as the global strip style
      if (!fontApplied && (pp.fontFamily || pp.fontSize)) {
        state.labelStrip.font = mapForeignFont(pp.fontFamily);
        if (pp.fontSize) state.labelStrip.fontSize = pp.fontSize;
        if (pp.fontColor) state.labelStrip.fg = pp.fontColor;
        state.labelStrip.useCat = true; // colored cells like the source
        fontApplied = true;
      }
      return j;
    };
    col.top = fill(topJack, 'top');
    col.bottom = fill(botJack, 'bottom');
    col.norm = mapForeignNorm(topJack && topJack.normalMode, chNorm[chIdx], botJack && botJack.normalMode);
    return col;
  });

  // clean overlapping merges (keep earliest per lane)
  ['top', 'bottom'].forEach((lane) => {
    const seen = [];
    state.labelStrip.merges[lane] = state.labelStrip.merges[lane]
      .sort((a, b) => a.start - b.start)
      .filter((m) => {
        if (seen.some((s) => m.start < s.start + s.span && s.start < m.start + m.span)) return false;
        seen.push(m); return true;
      });
  });

  ui.selectedCells.clear();
  $('#bayName').value = state.name;
  render();
  status(`Imported “${state.name}” — ${state.count} channels (${jacks.length} jacks) from external file.`);
}
function loadCSV(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error('Empty CSV');
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (...names) => head.findIndex((h) => names.some((n) => h.includes(n)));
  const body = rows.slice(1).filter((r) => r.some((c) => c !== ''));
  const normFrom = (v) => {
    const nv = (v || '').toLowerCase();
    return NORM_ORDER.find((n) => NORMALLING[n].label.toLowerCase() === nv) ||
      (nv.includes('half') ? 'half' : nv.includes('thru') || nv.includes('open') ? 'thru' : nv.includes('par') || nv.includes('mult') ? 'parallel' : nv.includes('norm') ? 'normalled' : 'half');
  };
  const fillJack = (j, label, cat, color, note) => {
    j.label = label || ''; j.color = color || ''; j.note = note || '';
    if (cat) j.category = ensureCatByName(cat);
  };

  const iRow = idx('row', 'position', 'pos');
  const iLabel = head.findIndex((h) => h === 'label' || h === 'shortlabel' || h === 'short label');
  const iCat = idx('categ'), iCol = idx('color'), iNorm = idx('normal'), iNote = idx('note');

  if (iRow >= 0 && iLabel >= 0) {
    // New per-jack format: one row per jack, grouped by Channel/Row
    const iCh = idx('channel', 'chan', 'ch', '#');
    const groups = new Map();
    body.forEach((r, n) => {
      const ch = iCh >= 0 ? (r[iCh] || String(Math.floor(n / 2) + 1)) : String(Math.floor(n / 2) + 1);
      if (!groups.has(ch)) groups.set(ch, {});
      const lane = (r[iRow] || '').toLowerCase().startsWith('b') ? 'bottom' : 'top';
      groups.get(ch)[lane] = r;
    });
    const keys = [...groups.keys()];
    state.count = keys.length;
    state.columns = keys.map((k) => {
      const g = groups.get(k);
      const col = newColumn();
      let norm = 'half';
      ['top', 'bottom'].forEach((lane) => {
        const r = g[lane]; if (!r) return;
        norm = normFrom(iNorm >= 0 ? r[iNorm] : '');
        fillJack(col[lane], r[iLabel], iCat >= 0 ? r[iCat] : '', iCol >= 0 ? r[iCol] : '', iNote >= 0 ? r[iNote] : '');
      });
      col.norm = norm;
      return col;
    });
  } else {
    // Legacy format: one row per channel with Top/Bottom Label columns
    const iTop = head.findIndex((h) => h.includes('top')), iBot = head.findIndex((h) => h.includes('bottom'));
    state.count = body.length;
    state.columns = body.map((r) => {
      const col = newColumn();
      col.top.label = iTop >= 0 ? r[iTop] : '';
      col.bottom.label = iBot >= 0 ? r[iBot] : '';
      const color = iCol >= 0 ? r[iCol] : '', note = iNote >= 0 ? r[iNote] : '';
      col.top.color = col.bottom.color = color;
      col.top.note = col.bottom.note = note;
      if (iCat >= 0 && r[iCat]) col.top.category = col.bottom.category = ensureCatByName(r[iCat]);
      if (iNorm >= 0) col.norm = normFrom(r[iNorm]);
      return col;
    });
  }
  state.labelStrip.merges = { top: [], bottom: [] };
  ui.selectedCells.clear();
  render();
  status(`Loaded CSV — ${state.count} channels.`);
}
function parseCSV(text) {
  const rows = []; let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; }
      else field += ch;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/* ---------------- Events / wiring ---------------- */
function wire() {
  // format buttons
  $('#formatGroup').addEventListener('click', (e) => {
    const b = e.target.closest('.fmt'); if (!b) return;
    setFormat(b.dataset.format, Number(b.dataset.count));
  });
  // custom point count
  $('#pointCount').addEventListener('change', (e) => {
    let n = parseInt(e.target.value, 10);
    if (!n || n < 1) n = 1;
    if (n > 128) n = 128;
    setFormat(state.format, n);
    e.target.value = state.count; // resync if clamped or cancelled
  });
  // panel collapse toggles
  $$('.panel-head .collapse').forEach((btn) => {
    btn.addEventListener('click', () => togglePanel(btn.closest('.panel').dataset.panel));
  });
  // whole-channel hover highlight (delegated on the persistent tbody, survives re-renders)
  const gridBody = $('#gridBody');
  let hoverIdx = null;
  const setChannelHover = (idx) => {
    gridBody.querySelectorAll('tr.hover-ch').forEach((t) => t.classList.remove('hover-ch'));
    if (idx != null) gridBody.querySelectorAll(`tr[data-idx="${idx}"]`).forEach((t) => t.classList.add('hover-ch'));
  };
  gridBody.addEventListener('mouseover', (e) => {
    const tr = e.target.closest('tr');
    const idx = tr ? tr.dataset.idx : null;
    if (idx !== hoverIdx) { hoverIdx = idx; setChannelHover(idx); }
  });
  gridBody.addEventListener('mouseleave', () => { hoverIdx = null; setChannelHover(null); });
  // bay name
  $('#bayName').addEventListener('change', (e) => { state.name = e.target.value; touch(); });
  // filter — class-toggle only, no rebuild
  $('#filter').addEventListener('input', (e) => { ui.filter = e.target.value; applyFilter(); });
  $('#clearFilter').addEventListener('click', () => { ui.filter = ''; $('#filter').value = ''; applyFilter(); });
  // categories
  $('#addCat').addEventListener('click', addCat);
  $('#catToggle').addEventListener('click', () => {
    ui.catsCollapsed = !ui.catsCollapsed;
    $('#catTools').classList.toggle('collapsed', ui.catsCollapsed);
  });
  // faceplate display controls
  $('#fp-lines').addEventListener('input', (e) => { state.faceplate.labelLines = Math.max(1, Math.min(4, parseInt(e.target.value, 10) || 1)); touch(); renderFaceplate(); });
  $('#fp-gap').addEventListener('input', (e) => { state.faceplate.gap = Math.max(0, parseInt(e.target.value, 10) || 0); touch(); renderFaceplate(); });
  // save menu
  const menu = $('#saveMenu');
  $('#saveBtn').addEventListener('click', (e) => { e.stopPropagation(); menu.classList.toggle('open'); });
  document.addEventListener('click', () => menu.classList.remove('open'));
  menu.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return;
    ({ json: exportJSON, csv: exportCSV, xlsx: exportXLSX })[t.dataset.export]();
    menu.classList.remove('open');
  });
  // new / load
  $('#newBtn').addEventListener('click', newBay);
  $('#loadBtn').addEventListener('click', () => $('#fileInput').click());
  $('#fileInput').addEventListener('change', (e) => { if (e.target.files[0]) importFile(e.target.files[0]); e.target.value = ''; });

  // label designer controls
  const ls = () => state.labelStrip;
  const bindNum = (id, key) => $(id).addEventListener('input', (e) => { ls()[key] = parseFloat(e.target.value) || 0; touch(); renderLabels(); });
  bindNum('#ls-cellw', 'cellW'); bindNum('#ls-height', 'height'); bindNum('#ls-fontsize', 'fontSize'); bindNum('#ls-bw', 'borderW');
  $('#ls-font').addEventListener('change', (e) => { ls().font = e.target.value; touch(); renderLabels(); });
  $('#ls-weight').addEventListener('change', (e) => { ls().weight = e.target.value; touch(); renderLabels(); });
  $('#ls-upper').addEventListener('change', (e) => { ls().upper = e.target.checked; touch(); renderLabels(); });
  $('#ls-bc').addEventListener('input', (e) => { ls().borderColor = e.target.value; touch(); renderLabels(); });
  $('#ls-bg').addEventListener('input', (e) => { ls().bg = e.target.value; touch(); renderLabels(); });
  $('#ls-fg').addEventListener('input', (e) => { ls().fg = e.target.value; touch(); renderLabels(); });
  $('#ls-usecat').addEventListener('change', (e) => { ls().useCat = e.target.checked; touch(); renderLabels(); });
  $$('.lane-btn').forEach((b) => b.addEventListener('click', () => { ui.lane = b.dataset.lane; ui.selectedCells.clear(); renderLabels(); }));
  $('#mergeBtn').addEventListener('click', mergeCells);
  $('#splitBtn').addEventListener('click', splitCells);
  $('#printLabels').addEventListener('click', () => window.print());

  // keyboard: cmd/ctrl+f focuses filter
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') { e.preventDefault(); $('#filter').focus(); }
  });
}

/* ---------------- Demo seed ---------------- */
function seedDemo() {
  const sample = [
    ['Mic 1', 'Pre 1', 'c-mic', 'normalled'], ['Mic 2', 'Pre 2', 'c-mic', 'normalled'],
    ['Comp L', 'Comp L', 'c-out', 'half'], ['Comp R', 'Comp R', 'c-out', 'half'],
    ['Mon L', 'Amp L', 'c-mon', 'thru'], ['Mon R', 'Amp R', 'c-mon', 'thru'],
  ];
  sample.forEach((s, i) => {
    const c = state.columns[i];
    c.top.label = s[0]; c.bottom.label = s[1];
    c.top.category = c.bottom.category = s[2]; c.norm = s[3];
  });
  // demo merge: L/R pair on top lane cells 3-4 (index 2-3) -> "Comp"
  const demoText = smartMergeLabel([state.columns[2].top.label, state.columns[3].top.label]);
  state.labelStrip.merges.top.push({ start: 2, span: 2, text: demoText });
}

/* ---------------- Init ---------------- */
wire();
renderLegend(); // static — build once
const appVer = $('#appVer'); if (appVer) appVer.textContent = 'v' + APP_VERSION;
const restored = restoreAutosave();
if (!restored) seedDemo();
Object.keys(ui.collapsed).forEach((name) => $(`#panel-${name}`).classList.toggle('collapsed', ui.collapsed[name]));
render();
setSaveState(restored ? 'saved' : '');
status(restored
  ? `Restored your last session — ${state.count} channels. Your work autosaves locally as you edit.`
  : `Welcome to PatchPlanerUltra v${APP_VERSION} — pick a format and start patching. Your work autosaves locally.`);
