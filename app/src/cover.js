// Neon Shore cover engine: colour grades, panel layouts, and the
// canvas painter. No DOM wiring lives here — main.js owns the page,
// this file only knows how to draw a cover from a plain state object.

const GRADES = {
  sunset: {
    mix: 0.7,
    stops: [[0, '#160a2e'], [0.25, '#7b2d8b'], [0.5, '#e2503e'], [0.75, '#ff9e4f'], [1, '#ffe6a3']],
  },
  neon: {
    mix: 0.6,
    stops: [[0, '#101c33'], [0.25, '#4a2d7a'], [0.5, '#c94f7c'], [0.75, '#ff8a5c'], [1, '#ffe3c2']],
  },
  golden: {
    mix: 0.65,
    stops: [[0, '#241a08'], [0.25, '#7a4d16'], [0.5, '#d98a2b'], [0.75, '#ffc65c'], [1, '#fff3c4']],
  },
  dusk: {
    mix: 0.65,
    stops: [[0, '#0d0b26'], [0.25, '#3b2a6b'], [0.5, '#7a4d9e'], [0.75, '#c96ba8'], [1, '#ffd9ec']],
  },
};

// Each layout lists its panels as fractions of the stage [x, y, w, h]
// plus which photo slot feeds each panel (four photos, cycled).
const LAYOUTS = {
  hero3: {
    panels: [[0, 0, 0.66, 1], [0.66, 0, 0.34, 1 / 3], [0.66, 1 / 3, 0.34, 1 / 3], [0.66, 2 / 3, 0.34, 1 / 3]],
    photos: [0, 1, 2, 3],
  },
  full: {
    panels: [[0, 0, 1, 1]],
    photos: [0],
  },
  six: {
    panels: [[0, 0, 1 / 3, 0.5], [1 / 3, 0, 1 / 3, 0.5], [2 / 3, 0, 1 / 3, 0.5], [0, 0.5, 1 / 3, 0.5], [1 / 3, 0.5, 1 / 3, 0.5], [2 / 3, 0.5, 1 / 3, 0.5]],
    photos: [0, 1, 2, 3, 0, 1],
  },
  nine: {
    panels: [
      [0, 0, 1 / 3, 1 / 3], [1 / 3, 0, 1 / 3, 1 / 3], [2 / 3, 0, 1 / 3, 1 / 3],
      [0, 1 / 3, 1 / 3, 1 / 3], [1 / 3, 1 / 3, 1 / 3, 1 / 3], [2 / 3, 1 / 3, 1 / 3, 1 / 3],
      [0, 2 / 3, 1 / 3, 1 / 3], [1 / 3, 2 / 3, 1 / 3, 1 / 3], [2 / 3, 2 / 3, 1 / 3, 1 / 3],
    ],
    photos: [0, 1, 2, 3, 0, 1, 2, 3, 0],
  },
};

// Panel rectangles in pixels, with a thin gutter between panels.
function layoutRects(layout, width, height) {
  const def = LAYOUTS[layout] || LAYOUTS.hero3;
  const gap = def.panels.length > 1 ? Math.max(2, Math.round(Math.min(width, height) * 0.006)) : 0;
  return def.panels.map(([fx, fy, fw, fh], i) => ({
    x: Math.round(fx * width + gap / 2),
    y: Math.round(fy * height + gap / 2),
    w: Math.max(1, Math.round(fw * width - gap)),
    h: Math.max(1, Math.round(fh * height - gap)),
    photo: def.photos[i],
  }));
}

// Cover-fit a photo into a panel at the slot's zoom, shifted by its pan.
function drawPhoto(ctx, img, rect, pan) {
  const zoom = Math.min(3, Math.max(1, pan.zoom || 1));
  const scale = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = rect.x + (rect.w - dw) / 2 + (pan.px || 0) * rect.w;
  const dy = rect.y + (rect.h - dh) / 2 + (pan.py || 0) * rect.h;
  ctx.drawImage(img, dx, dy, dw, dh);
}

// Duotone grade: a top-to-bottom gradient blended over the photos.
// An overlay pass lifts the contrast, then a colour pass shifts the
// hue, so a neon grade reads as neon pink and teal instead of a faint tint.
function paintGrade(ctx, width, height, gradeName) {
  const grade = GRADES[gradeName] || GRADES.sunset;
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  for (const [stop, color] of grade.stops) gradient.addColorStop(stop, color);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = grade.mix;
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'color';
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

// Deterministic film grain: the same seed every run, so exports repeat.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function paintGrain(ctx, width, height) {
  const rand = mulberry32(20261120);
  const count = Math.floor((width * height) / 1400);
  ctx.save();
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = 0.05 + rand() * 0.08;
    ctx.fillStyle = rand() > 0.5 ? '#ffffff' : '#000000';
    ctx.fillRect(rand() * width, rand() * height, 1.4, 1.4);
  }
  ctx.restore();
}

function paintVignette(ctx, width, height) {
  const radius = Math.hypot(width, height) / 2;
  const gradient = ctx.createRadialGradient(width / 2, height / 2, radius * 0.45, width / 2, height / 2, radius);
  gradient.addColorStop(0, 'rgba(8, 3, 20, 0)');
  gradient.addColorStop(1, 'rgba(8, 3, 20, 0.45)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

// Bold Anton title with a dark outline, Pacifico subtitle beneath it.
function paintCaption(ctx, width, height, state) {
  const title = (state.title || '').toUpperCase();
  if (!title) return;
  const base = width * 0.115 * (state.titleSize || 1);
  let size = Math.round(base);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.font = size + 'px Anton, sans-serif';
  while (size > 12 && ctx.measureText(title).width > width * 0.92) {
    size = Math.round(size * 0.94);
    ctx.font = size + 'px Anton, sans-serif';
  }
  const baseline = Math.round(height * (state.titleHeight == null ? 0.86 : state.titleHeight));
  ctx.strokeStyle = '#170a2b';
  ctx.lineWidth = Math.max(2, size * 0.07);
  ctx.strokeText(title, width / 2, baseline);
  ctx.fillStyle = '#fff6e0';
  ctx.fillText(title, width / 2, baseline);
  if (state.showSub && state.subtitle) {
    const subSize = Math.round(size * 0.34);
    const subY = baseline + Math.round(subSize * 1.2);
    ctx.font = subSize + 'px Pacifico, cursive';
    ctx.lineWidth = Math.max(2, subSize * 0.08);
    ctx.strokeStyle = '#a3124d';
    ctx.strokeText(state.subtitle, width / 2, subY);
    ctx.fillStyle = '#ff5da2';
    ctx.fillText(state.subtitle, width / 2, subY);
  }
  ctx.restore();
}

// Paint the whole cover onto a canvas from a state object and the
// loaded photo elements (one per slot, null while it still loads).
function drawCover(canvas, state, images) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#160a24';
  ctx.fillRect(0, 0, width, height);
  const rects = layoutRects(state.layout, width, height);
  const coverPhoto = state.layout === 'full' && state.coverPhoto != null ? state.coverPhoto : null;
  for (const rect of rects) {
    const slot = coverPhoto != null ? coverPhoto : rect.photo;
    const img = images[slot];
    const pan = state.photos[slot] || { px: 0, py: 0, zoom: 1 };
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    if (img && img.complete && img.naturalWidth > 0) {
      drawPhoto(ctx, img, rect, pan);
    } else {
      ctx.fillStyle = '#2a1840';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    ctx.restore();
  }
  paintGrade(ctx, width, height, state.grade);
  if (state.grain) paintGrain(ctx, width, height);
  if (state.vignette) paintVignette(ctx, width, height);
  paintCaption(ctx, width, height, state);
  return rects;
}
