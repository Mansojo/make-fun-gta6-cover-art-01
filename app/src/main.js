// Neon Shore editor: photos, layouts, grades, lettering, export, undo/redo.
// A `?shot=` query renders one fixed scene instead (see ./shots.js).
import { paintCover, slotsFor, SIZES, GRADES, LAYOUTS } from './cover.js';
import { runScene } from './shots.js';

const canvas = document.getElementById('coverCanvas');
const ctx = canvas.getContext('2d');
const tray = document.getElementById('tray');
const statusLine = document.getElementById('statusLine');
const slotLabel = document.getElementById('slotLabel');

const SAMPLES = [
  { id: 'boulevard', name: 'Boulevard', url: 'samples/boulevard.jpg' },
  { id: 'rooftop', name: 'Rooftop', url: 'samples/rooftop.jpg' },
  { id: 'neon', name: 'Neon street', url: 'samples/neon.jpg' },
  { id: 'pier', name: 'Pier', url: 'samples/pier.jpg' },
];

const photosById = new Map();
let uploadCount = 0;

function freshDraft() {
  return {
    layout: 'hero3',
    grade: 'sunset',
    size: 'square',
    title: 'Neon Shore',
    subtitle: 'Vice City nights',
    showSubtitle: true,
    titleScale: 1,
    titleY: 0.86,
    grain: true,
    vignette: true,
    photos: [],
    cells: [],
    active: 0,
  };
}

let draft = freshDraft();

// One cell per slot: which photo it shows, how far it is zoomed and panned.
function resetCells() {
  const n = slotsFor(draft.layout, 100, 100).length;
  draft.cells = Array.from({ length: n }, (_, i) => ({
    photo: draft.photos.length ? i % draft.photos.length : 0,
    zoom: 1.15,
    panX: 0,
    panY: 0,
  }));
  draft.active = 0;
}

// --- History ---------------------------------------------------------------
const past = [];
const future = [];
function snap() {
  return JSON.stringify({
    layout: draft.layout, grade: draft.grade, size: draft.size,
    title: draft.title, subtitle: draft.subtitle, showSubtitle: draft.showSubtitle,
    titleScale: draft.titleScale, titleY: draft.titleY,
    grain: draft.grain, vignette: draft.vignette,
    photos: draft.photos.map((p) => ({ id: p.id, name: p.name })),
    cells: draft.cells, active: draft.active,
  });
}
function applySnap(json) {
  const s = JSON.parse(json);
  Object.assign(draft, s);
  draft.photos = s.photos.map((p) => photosById.get(p.id)).filter(Boolean);
}
function commit() {
  past.push(snap());
  if (past.length > 50) past.shift();
  future.length = 0;
  syncHistoryButtons();
}
function undo() {
  if (!past.length) return;
  future.push(snap());
  applySnap(past.pop());
  syncControls();
  render();
  syncHistoryButtons();
}
function redo() {
  if (!future.length) return;
  past.push(snap());
  applySnap(future.pop());
  syncControls();
  render();
  syncHistoryButtons();
}
function syncHistoryButtons() {
  document.getElementById('undoBtn').disabled = !past.length;
  document.getElementById('redoBtn').disabled = !future.length;
}

// --- Rendering ---------------------------------------------------------------
function render() {
  const size = SIZES[draft.size];
  if (document.body.classList.contains('cover-shot')) {
    canvas.width = size.w;
    canvas.height = size.h;
    paintCover(ctx, size.w, size.h, draft);
  } else {
    const longSide = 620;
    const k = longSide / Math.max(size.w, size.h);
    canvas.width = Math.round(size.w * k);
    canvas.height = Math.round(size.h * k);
    paintCover(ctx, canvas.width, canvas.height, draft);
  }
  slotLabel.textContent = `Slot ${draft.active + 1} of ${draft.cells.length}`;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function loadSamples() {
  const loaded = [];
  for (const s of SAMPLES) {
    const img = await loadImage(s.url);
    const photo = { id: s.id, name: s.name, img, url: s.url };
    photosById.set(s.id, photo);
    loaded.push(photo);
  }
  return loaded;
}

function renderTray() {
  tray.innerHTML = '';
  draft.photos.forEach((photo, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'thumb';
    b.title = photo.name;
    const img = document.createElement('img');
    img.src = photo.url || photo.img.src;
    img.alt = photo.name;
    b.appendChild(img);
    b.addEventListener('click', () => {
      commit();
      draft.cells[draft.active].photo = i;
      renderTray();
      render();
    });
    tray.appendChild(b);
  });
}

function syncControls() {
  document.getElementById('titleInput').value = draft.title;
  document.getElementById('subtitleInput').value = draft.subtitle;
  document.getElementById('showSub').checked = draft.showSubtitle;
  document.getElementById('sizeRange').value = draft.titleScale;
  document.getElementById('heightRange').value = draft.titleY;
  document.getElementById('grainBox').checked = draft.grain;
  document.getElementById('vignetteBox').checked = draft.vignette;
  for (const el of document.querySelectorAll('[data-layout]')) {
    el.classList.toggle('on', el.dataset.layout === draft.layout);
  }
  for (const el of document.querySelectorAll('[data-grade]')) {
    el.classList.toggle('on', el.dataset.grade === draft.grade);
  }
  for (const el of document.querySelectorAll('[data-size]')) {
    el.classList.toggle('on', el.dataset.size === draft.size);
  }
  document.getElementById('zoomRange').value = draft.cells[draft.active]?.zoom ?? 1.15;
  renderTray();
}

function pickLayout(id) {
  if (!LAYOUTS[id] || id === draft.layout) return;
  commit();
  const keep = new Map();
  draft.cells.forEach((c) => keep.set(c.photo, c));
  draft.layout = id;
  resetCells();
  draft.cells = draft.cells.map((c) => keep.get(c.photo) ?? c);
  draft.active = 0;
  syncControls();
  render();
}

function pickGrade(id) {
  if (!GRADES[id] || id === draft.grade) return;
  commit();
  draft.grade = id;
  syncControls();
  render();
}

function pickSize(id) {
  if (!SIZES[id] || id === draft.size) return;
  commit();
  draft.size = id;
  syncControls();
  render();
}

// Exports the cover at an exact post size and downloads it as a PNG.
function exportPng(sizeId) {
  const size = SIZES[sizeId];
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  paintCover(off.getContext('2d'), size.w, size.h, draft);
  off.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `neon-shore-${size.w}x${size.h}.png`;
    a.click();
    statusLine.textContent = `Saved neon-shore-${size.w}x${size.h}.png`;
  }, 'image/png');
}

// --- Controls ---------------------------------------------------------------
// Text fields: remember the pre-edit draft on focus, commit it to history on
// the first keystroke — not on 'change', which fires on blur and would run
// after (and swallow) an Undo click made while the field is focused.
let pendingSnap = null;
function armSnap() { pendingSnap = snap(); }
function commitSnap() {
  if (!pendingSnap) return;
  past.push(pendingSnap);
  pendingSnap = null;
  if (past.length > 50) past.shift();
  future.length = 0;
  syncHistoryButtons();
}
for (const id of ['titleInput', 'subtitleInput']) {
  const el = document.getElementById(id);
  el.addEventListener('focus', armSnap);
  el.addEventListener('blur', () => { pendingSnap = null; });
}
document.getElementById('titleInput').addEventListener('input', (e) => {
  commitSnap();
  draft.title = e.target.value;
  render();
});
document.getElementById('subtitleInput').addEventListener('input', (e) => {
  commitSnap();
  draft.subtitle = e.target.value;
  render();
});
document.getElementById('showSub').addEventListener('change', (e) => {
  commit();
  draft.showSubtitle = e.target.checked;
  render();
});
document.getElementById('sizeRange').addEventListener('input', (e) => {
  draft.titleScale = Number(e.target.value);
  render();
});
document.getElementById('sizeRange').addEventListener('change', commit);
document.getElementById('heightRange').addEventListener('input', (e) => {
  draft.titleY = Number(e.target.value);
  render();
});
document.getElementById('heightRange').addEventListener('change', commit);
document.getElementById('grainBox').addEventListener('change', (e) => {
  commit();
  draft.grain = e.target.checked;
  render();
});
document.getElementById('vignetteBox').addEventListener('change', (e) => {
  commit();
  draft.vignette = e.target.checked;
  render();
});
for (const el of document.querySelectorAll('[data-layout]')) {
  el.addEventListener('click', () => pickLayout(el.dataset.layout));
}
for (const el of document.querySelectorAll('[data-grade]')) {
  el.addEventListener('click', () => pickGrade(el.dataset.grade));
}
for (const el of document.querySelectorAll('[data-size]')) {
  el.addEventListener('click', () => pickSize(el.dataset.size));
}
for (const el of document.querySelectorAll('[data-export]')) {
  el.addEventListener('click', () => exportPng(el.dataset.export));
}
document.getElementById('undoBtn').addEventListener('click', undo);
document.getElementById('redoBtn').addEventListener('click', redo);
document.getElementById('zoomRange').addEventListener('input', (e) => {
  draft.cells[draft.active].zoom = Number(e.target.value);
  render();
});
document.getElementById('zoomRange').addEventListener('change', commit);

// Upload: adds a photo (up to 4) or swaps the active slot's photo when full.
document.getElementById('uploadInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const img = await loadImage(URL.createObjectURL(file));
  const photo = { id: `upload-${++uploadCount}`, name: file.name, img, url: img.src };
  photosById.set(photo.id, photo);
  commit();
  if (draft.photos.length < 4) {
    draft.photos.push(photo);
    draft.cells[draft.active].photo = draft.photos.length - 1;
  } else {
    const idx = draft.cells[draft.active].photo;
    draft.photos[idx] = photo;
  }
  renderTray();
  render();
  statusLine.textContent = `Loaded ${file.name}`;
  e.target.value = '';
});

// --- Canvas: click to pick a slot, drag to pan it, wheel to zoom it. -------
let drag = null;
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * canvas.width,
    y: ((e.clientY - r.top) / r.height) * canvas.height,
  };
}
canvas.addEventListener('pointerdown', (e) => {
  const pt = canvasPoint(e);
  const slots = slotsFor(draft.layout, canvas.width, canvas.height);
  const i = slots.findIndex((s) => pt.x >= s.x && pt.x <= s.x + s.w && pt.y >= s.y && pt.y <= s.y + s.h);
  if (i < 0) return;
  draft.active = i;
  syncControls();
  render();
  const cell = draft.cells[i];
  drag = { x: pt.x, y: pt.y, panX: cell.panX, panY: cell.panY, moved: false };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const pt = canvasPoint(e);
  const slot = slotsFor(draft.layout, canvas.width, canvas.height)[draft.active];
  const cell = draft.cells[draft.active];
  cell.panX = drag.panX + (pt.x - drag.x) / slot.w;
  cell.panY = drag.panY + (pt.y - drag.y) / slot.h;
  cell.panX = Math.max(-0.6, Math.min(0.6, cell.panX));
  cell.panY = Math.max(-0.6, Math.min(0.6, cell.panY));
  if (Math.abs(pt.x - drag.x) + Math.abs(pt.y - drag.y) > 4) drag.moved = true;
  render();
});
canvas.addEventListener('pointerup', () => {
  if (drag?.moved) commit();
  drag = null;
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const cell = draft.cells[draft.active];
  cell.zoom = Math.max(1, Math.min(3, cell.zoom * (e.deltaY < 0 ? 1.1 : 0.91)));
  document.getElementById('zoomRange').value = cell.zoom;
  render();
}, { passive: false });

// --- Boot --------------------------------------------------------------------
async function boot() {
  draft.photos = await loadSamples();
  resetCells();
  syncControls();
  syncHistoryButtons();
  try {
    await Promise.all([document.fonts.load('40px Anton'), document.fonts.load('20px Pacifico')]);
  } catch { /* fall back to system fonts */ }
  render();
  await document.fonts.ready;
  render();
}

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runScene(shot, new URLSearchParams(location.search), {
    loadSamples,
    getDraft: () => draft,
    setDraft(next) { Object.assign(draft, next); },
    rebuildCells() { resetCells(); draft.active = 0; },
    render,
    syncControls,
    ready() { window.__shotReady = true; },
  });
} else {
  boot();
}
