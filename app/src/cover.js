// Neon Shore cover engine: lays photos into slots, grades them with a
// luminance ramp, and letters the title on top. Pure canvas, no network.

export const SIZES = {
  square: { w: 1080, h: 1080 },
  story: { w: 1080, h: 1350 },
  wide: { w: 1920, h: 1080 },
};

// Each grade blends a five-stop luminance ramp back over the photo by its
// mix, so faces keep their skin while the shadows go Vice City.
export const GRADES = {
  sunset: { mix: 0.7, ramp: ['#160a2e', '#7b2d8b', '#e2503e', '#ff9e4f', '#ffe6a3'] },
  neon: { mix: 0.6, ramp: ['#101c33', '#4a2d7a', '#c94f7c', '#ff8a5c', '#ffe3c2'], shadowTeal: '#17b8a4' },
  golden: { mix: 0.65, ramp: ['#241a08', '#7a4d16', '#d98a2b', '#ffc65c', '#fff3c4'] },
  dusk: { mix: 0.65, ramp: ['#0d0b26', '#3b2a6b', '#7a4d9e', '#c96ba8', '#ffd9ec'] },
};

export const LAYOUTS = {
  hero3: { label: 'Hero + 3' },
  full: { label: 'Full bleed' },
  six: { label: 'Six panels' },
  nine: { label: 'Nine panels' },
};

// Slot rectangles for a layout, in pixels, with a thin dark gutter between
// them. The gutter scales with the canvas so small previews match exports.
export function slotsFor(layout, w, h) {
  const g = Math.max(2, Math.round(w * 0.005));
  const third = (n, total) => (total - g * (n - 1)) / n;
  if (layout === 'full') return [{ x: 0, y: 0, w, h }];
  if (layout === 'hero3') {
    const heroW = Math.round(w * 0.62);
    const sideX = heroW + g;
    const sideW = w - sideX;
    const rowH = third(3, h);
    return [
      { x: 0, y: 0, w: heroW, h },
      { x: sideX, y: 0, w: sideW, h: rowH },
      { x: sideX, y: rowH + g, w: sideW, h: rowH },
      { x: sideX, y: 2 * (rowH + g), w: sideW, h: rowH },
    ];
  }
  if (layout === 'six') {
    const cw = third(3, w);
    const rh = third(2, h);
    const out = [];
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        out.push({ x: c * (cw + g), y: r * (rh + g), w: cw, h: rh });
      }
    }
    return out;
  }
  // nine: 3 by 3.
  const cw = third(3, w);
  const rh = third(3, h);
  const out = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out.push({ x: c * (cw + g), y: r * (rh + g), w: cw, h: rh });
    }
  }
  return out;
}

function hexRgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

// A 256-entry lookup table from five ramp stops at 0, .25, .5, .75 and 1.
function rampTable(stops) {
  const pts = stops.map(hexRgb);
  const table = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const seg = Math.min(3, Math.floor(t * 4));
    const f = t * 4 - seg;
    for (let ch = 0; ch < 3; ch++) {
      table[i * 3 + ch] = Math.round(pts[seg][ch] + (pts[seg + 1][ch] - pts[seg][ch]) * f);
    }
  }
  return table;
}

const rampCache = new Map();
function rampFor(gradeName) {
  if (!rampCache.has(gradeName)) rampCache.set(gradeName, rampTable(GRADES[gradeName].ramp));
  return rampCache.get(gradeName);
}

// Returns a graded copy of a photo (cached per photo and grade). The grade
// is applied at a working size so the editor stays fast at any canvas size.
const gradedCache = new Map();
export function gradedPhoto(photo, gradeName) {
  const key = `${photo.id}:${gradeName}`;
  if (gradedCache.has(key)) return gradedCache.get(key);
  const grade = GRADES[gradeName];
  const table = rampFor(gradeName);
  const scale = Math.min(1, 1000 / Math.max(photo.img.naturalWidth, photo.img.naturalHeight));
  const cw = Math.max(2, Math.round(photo.img.naturalWidth * scale));
  const ch = Math.max(2, Math.round(photo.img.naturalHeight * scale));
  const cv = document.createElement('canvas');
  cv.width = cw;
  cv.height = ch;
  const c = cv.getContext('2d');
  c.drawImage(photo.img, 0, 0, cw, ch);
  const data = c.getImageData(0, 0, cw, ch);
  const px = data.data;
  const teal = grade.shadowTeal ? hexRgb(grade.shadowTeal) : null;
  const mix = grade.mix;
  const keep = 1 - mix;
  for (let i = 0; i < px.length; i += 4) {
    const lum = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
    const ti = lum * 3;
    let r = table[ti] * mix + px[i] * keep;
    let g = table[ti + 1] * mix + px[i + 1] * keep;
    let b = table[ti + 2] * mix + px[i + 2] * keep;
    if (teal && lum < 32) {
      // Teal lives only in the deepest shadows of the neon grade.
      const f = (1 - lum / 32) * 0.15;
      r = r * (1 - f) + teal[0] * f;
      g = g * (1 - f) + teal[1] * f;
      b = b * (1 - f) + teal[2] * f;
    }
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
  }
  c.putImageData(data, 0, 0);
  gradedCache.set(key, cv);
  return cv;
}

// Draws one photo cover-fit inside a slot, honouring zoom and pan.
function paintSlot(ctx, slot, img, cell) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(slot.x, slot.y, slot.w, slot.h);
  ctx.clip();
  const base = Math.max(slot.w / img.width, slot.h / img.height) * cell.zoom;
  const dw = img.width * base;
  const dh = img.height * base;
  // Clamp the pan so the photo always covers the slot: no dark gaps at the
  // edges, however far a drag or a scene pushes it.
  const maxPanX = Math.max(0, (dw - slot.w) / 2 / slot.w);
  const maxPanY = Math.max(0, (dh - slot.h) / 2 / slot.h);
  const px = Math.max(-maxPanX, Math.min(maxPanX, cell.panX));
  const py = Math.max(-maxPanY, Math.min(maxPanY, cell.panY));
  const dx = slot.x + (slot.w - dw) / 2 + px * slot.w;
  const dy = slot.y + (slot.h - dh) / 2 + py * slot.h;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

let noiseTile = null;
function grainTile() {
  if (noiseTile) return noiseTile;
  noiseTile = document.createElement('canvas');
  noiseTile.width = 140;
  noiseTile.height = 140;
  const c = noiseTile.getContext('2d');
  const data = c.createImageData(140, 140);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = 96 + Math.floor(Math.random() * 64);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  c.putImageData(data, 0, 0);
  return noiseTile;
}

// Fits the title to the width, then letters it with a warm gradient fill
// and a dark outline, with the neon script subtitle tucked underneath.
function paintLettering(ctx, w, h, draft) {
  const text = (draft.title || '').toUpperCase();
  if (!text) return;
  const top = h * 0.6;
  const scrim = ctx.createLinearGradient(0, top, 0, h);
  scrim.addColorStop(0, 'rgba(8,2,18,0)');
  scrim.addColorStop(1, 'rgba(8,2,18,0.5)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, top, w, h - top);

  let size = w * 0.155 * draft.titleScale;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const setFont = (s) => { ctx.font = `${s}px Anton, 'Arial Black', sans-serif`; };
  setFont(size);
  const maxW = w * 0.88;
  while (size > 24 && ctx.measureText(text).width > maxW) {
    size *= 0.94;
    setFont(size);
  }
  const baseline = h * draft.titleY;
  const fill = ctx.createLinearGradient(0, baseline - size, 0, baseline + size * 0.12);
  fill.addColorStop(0, '#fff6dd');
  fill.addColorStop(1, '#ffcf7d');
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#160a24';
  ctx.lineWidth = Math.max(3, size * 0.05);
  ctx.shadowColor = 'rgba(20,5,40,0.55)';
  ctx.shadowBlur = size * 0.08;
  ctx.shadowOffsetY = size * 0.02;
  ctx.strokeText(text, w / 2, baseline);
  ctx.fillStyle = fill;
  ctx.fillText(text, w / 2, baseline);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  if (draft.showSubtitle && draft.subtitle) {
    const subSize = size * 0.34;
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.fillStyle = '#ff6fb1';
    ctx.shadowColor = '#ff4d9d';
    ctx.shadowBlur = subSize * 0.55;
    // Keep the script's descenders inside the canvas on wide covers.
    const subBase = Math.min(baseline + size * 0.32, h - subSize * 0.45);
    ctx.fillText(draft.subtitle, w / 2, subBase);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }
}

// Paints the whole cover for a draft onto ctx at the given pixel size.
export function paintCover(ctx, w, h, draft) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#12081f';
  ctx.fillRect(0, 0, w, h);
  const slots = slotsFor(draft.layout, w, h);
  draft.cells.forEach((cell, i) => {
    const slot = slots[i];
    if (!slot) return;
    const photo = draft.photos[cell.photo];
    if (!photo || !photo.img) return;
    paintSlot(ctx, slot, gradedPhoto(photo, draft.grade), cell);
  });
  paintLettering(ctx, w, h, draft);
  if (draft.grain) {
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.globalCompositeOperation = 'overlay';
    const tile = grainTile();
    for (let y = 0; y < h; y += tile.height) {
      for (let x = 0; x < w; x += tile.width) ctx.drawImage(tile, x, y);
    }
    ctx.restore();
  }
  if (draft.vignette) {
    const vg = ctx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.42,
      w / 2, h / 2, Math.max(w, h) * 0.75,
    );
    vg.addColorStop(0, 'rgba(5,0,12,0)');
    vg.addColorStop(1, 'rgba(5,0,12,0.38)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }
}
