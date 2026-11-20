// Neon Shore editor: wires the controls to the cover engine.
// Owns the state, the undo history, photo uploads, and PNG export.

(function () {
  'use strict';

  const SAMPLES = [
    { name: 'boulevard', src: 'samples/boulevard.jpg' },
    { name: 'pier', src: 'samples/pier.jpg' },
    { name: 'rooftop', src: 'samples/rooftop.jpg' },
    { name: 'neon', src: 'samples/neon.jpg' },
  ];
  const HISTORY_LIMIT = 50;

  const stage = document.getElementById('stage');
  const tray = document.getElementById('tray');
  const titleInput = document.getElementById('titleInput');
  const subtitleInput = document.getElementById('subtitleInput');
  const showSub = document.getElementById('showSub');
  const sizeRange = document.getElementById('sizeRange');
  const heightRange = document.getElementById('heightRange');
  const grainBox = document.getElementById('grainBox');
  const vignetteBox = document.getElementById('vignetteBox');
  const zoomRange = document.getElementById('zoomRange');
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  const uploadInput = document.getElementById('uploadInput');

  function freshState() {
    return {
      layout: 'hero3',
      grade: 'sunset',
      title: 'Neon Shore',
      subtitle: 'Vice City nights',
      showSub: true,
      titleSize: 1,
      titleHeight: 0.86,
      grain: true,
      vignette: true,
      selected: 0,
      photos: SAMPLES.map((sample) => ({ src: sample.src, px: 0, py: 0, zoom: 1 })),
    };
  }

  let state = freshState();
  let past = [];
  let future = [];
  const images = [null, null, null, null];

  function snapshot() {
    return JSON.stringify(state);
  }

  function restore(text) {
    state = JSON.parse(text);
    loadPhotos();
    syncInputs();
    render();
  }

  function commit() {
    past.push(snapshot());
    if (past.length > HISTORY_LIMIT) past.shift();
    future = [];
    updateHistoryButtons();
  }

  function undo() {
    if (!past.length) return;
    future.push(snapshot());
    restore(past.pop());
    updateHistoryButtons();
  }

  function redo() {
    if (!future.length) return;
    past.push(snapshot());
    restore(future.pop());
    updateHistoryButtons();
  }

  function updateHistoryButtons() {
    undoBtn.disabled = past.length === 0;
    redoBtn.disabled = future.length === 0;
  }

  function loadPhotos() {
    state.photos.forEach((photo, i) => {
      if (images[i] && images[i].dataset.src === photo.src) return;
      const img = new Image();
      img.dataset.src = photo.src;
      img.onload = () => render();
      img.src = photo.src;
      images[i] = img;
    });
  }

  function syncInputs() {
    titleInput.value = state.title;
    subtitleInput.value = state.subtitle;
    showSub.checked = state.showSub;
    sizeRange.value = String(state.titleSize);
    heightRange.value = String(state.titleHeight);
    grainBox.checked = state.grain;
    vignetteBox.checked = state.vignette;
    zoomRange.value = String(state.photos[state.selected].zoom);
    document.querySelectorAll('[data-layout]').forEach((button) => {
      button.classList.toggle('active', button.dataset.layout === state.layout);
    });
    document.querySelectorAll('[data-grade]').forEach((button) => {
      button.classList.toggle('active', button.dataset.grade === state.grade);
    });
    tray.querySelectorAll('img').forEach((thumb) => {
      thumb.classList.toggle('active', thumb.dataset.src === state.photos[state.selected].src);
    });
  }

  function render() {
    syncInputs();
    drawCover(stage, state, images);
  }

  function exportCover(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    drawCover(canvas, state, images);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'neon-shore-' + width + 'x' + height + '.png';
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 5000);
    }, 'image/png');
  }

  // Panel picking: map a pointer on the stage back to a panel rectangle.
  function panelAt(event) {
    const box = stage.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * stage.width;
    const y = ((event.clientY - box.top) / box.height) * stage.height;
    const rects = layoutRects(state.layout, stage.width, stage.height);
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        const slot = state.layout === 'full' && state.coverPhoto != null ? state.coverPhoto : r.photo;
        return { rect: r, slot, x, y };
      }
    }
    return null;
  }

  let drag = null;
  stage.addEventListener('pointerdown', (event) => {
    const hit = panelAt(event);
    if (!hit) return;
    state.selected = hit.slot;
    const pan = state.photos[hit.slot];
    drag = { slot: hit.slot, startX: event.clientX, startY: event.clientY, px: pan.px, py: pan.py, rect: hit.rect, moved: false };
    stage.setPointerCapture(event.pointerId);
    render();
  });
  stage.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const box = stage.getBoundingClientRect();
    const dx = (event.clientX - drag.startX) / box.width * stage.width;
    const dy = (event.clientY - drag.startY) / box.height * stage.height;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
    const pan = state.photos[drag.slot];
    pan.px = Math.min(0.5, Math.max(-0.5, drag.px + dx / drag.rect.w));
    pan.py = Math.min(0.5, Math.max(-0.5, drag.py + dy / drag.rect.h));
    render();
  });
  stage.addEventListener('pointerup', () => {
    if (drag && drag.moved) commit();
    drag = null;
  });
  stage.addEventListener('wheel', (event) => {
    event.preventDefault();
    const hit = panelAt(event);
    if (!hit) return;
    state.selected = hit.slot;
    const pan = state.photos[hit.slot];
    pan.zoom = Math.min(3, Math.max(1, pan.zoom * Math.exp(-event.deltaY * 0.0012)));
    render();
    clearTimeout(stage._wheelTimer);
    stage._wheelTimer = setTimeout(commit, 350);
  }, { passive: false });

  // Photo tray: click a sample to put it in the selected panel.
  SAMPLES.forEach((sample) => {
    const thumb = document.createElement('img');
    thumb.src = sample.src;
    thumb.alt = sample.name;
    thumb.dataset.src = sample.src;
    thumb.addEventListener('click', () => {
      state.photos[state.selected].src = sample.src;
      state.photos[state.selected].px = 0;
      state.photos[state.selected].py = 0;
      state.photos[state.selected].zoom = 1;
      loadPhotos();
      commit();
      render();
    });
    tray.appendChild(thumb);
  });

  uploadInput.addEventListener('change', () => {
    const file = uploadInput.files && uploadInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      state.photos[state.selected].src = String(reader.result);
      state.photos[state.selected].px = 0;
      state.photos[state.selected].py = 0;
      state.photos[state.selected].zoom = 1;
      loadPhotos();
      commit();
      render();
    };
    reader.readAsDataURL(file);
    uploadInput.value = '';
  });

  document.querySelectorAll('[data-layout]').forEach((button) => {
    button.addEventListener('click', () => {
      state.layout = button.dataset.layout;
      commit();
      render();
    });
  });
  document.querySelectorAll('[data-grade]').forEach((button) => {
    button.addEventListener('click', () => {
      state.grade = button.dataset.grade;
      commit();
      render();
    });
  });
  document.querySelectorAll('[data-export]').forEach((button) => {
    button.addEventListener('click', () => {
      const [w, h] = button.dataset.export.split('x').map(Number);
      exportCover(w, h);
    });
  });

  titleInput.addEventListener('input', () => { state.title = titleInput.value; render(); });
  titleInput.addEventListener('change', () => commit());
  subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; render(); });
  subtitleInput.addEventListener('change', () => commit());
  showSub.addEventListener('change', () => { state.showSub = showSub.checked; commit(); render(); });
  sizeRange.addEventListener('input', () => { state.titleSize = Number(sizeRange.value); render(); });
  sizeRange.addEventListener('change', () => commit());
  heightRange.addEventListener('input', () => { state.titleHeight = Number(heightRange.value); render(); });
  heightRange.addEventListener('change', () => commit());
  grainBox.addEventListener('change', () => { state.grain = grainBox.checked; commit(); render(); });
  vignetteBox.addEventListener('change', () => { state.vignette = vignetteBox.checked; commit(); render(); });
  zoomRange.addEventListener('input', () => {
    state.photos[state.selected].zoom = Number(zoomRange.value);
    render();
  });
  zoomRange.addEventListener('change', () => commit());

  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);
  document.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
    event.preventDefault();
    if (event.shiftKey) redo(); else undo();
  });

  // Shot scenes (?shot=cover|editor|nine|wide) preset the cover and,
  // for cover scenes, hide the editor chrome and fill the window.
  function applyShot() {
    const shot = shotFromUrl();
    state.layout = shot.layout;
    state.grade = shot.grade;
    state.title = shot.title;
    state.subtitle = shot.subtitle;
    state.showSub = shot.showSub;
    state.coverPhoto = shot.photo != null ? shot.photo : null;
    if (!shot.chrome) document.body.classList.add('no-chrome');
    if (shot.aspect === 'wide') {
      stage.width = 1920;
      stage.height = 1080;
    } else {
      stage.width = 1080;
      stage.height = 1080;
    }
    document.title = 'Neon Shore — ' + shot.title;
  }

  loadPhotos();
  applyShot();
  updateHistoryButtons();
  if (document.fonts && document.fonts.ready) {
    document.fonts.load('16px Anton').catch(() => {});
    document.fonts.load('16px Pacifico').catch(() => {});
    document.fonts.ready.then(() => render()).catch(() => {});
  }
  render();
})();
