// Fixed scenes for screenshots: a `?shot=<name>` query loads one scene
// from shots.json and renders it, then raises window.__shotReady.
export async function runScene(name, params, api) {
  const res = await fetch('shots.json');
  const manifest = await res.json();
  const scene = manifest.scenes.find((s) => s.name === name);
  if (!scene) throw new Error(`unknown shot scene: ${name}`);
  const draft = api.getDraft();
  draft.photos = await api.loadSamples();
  draft.layout = scene.layout;
  draft.grade = scene.grade;
  draft.size = scene.size;
  draft.title = scene.title;
  draft.subtitle = scene.subtitle;
  draft.showSubtitle = true;
  draft.titleScale = 1;
  draft.titleY = scene.layout === 'nine' ? 0.9 : 0.86;
  api.rebuildCells();
  // Assign the scene's photos to the slots in order, cycling when the layout
  // has more slots than the scene has photos.
  draft.cells.forEach((cell, i) => {
    const id = scene.photos[i % scene.photos.length];
    cell.photo = draft.photos.findIndex((p) => p.id === id);
    cell.zoom = scene.layout === 'full' ? 1.05 : 1.15;
    cell.panX = 0;
    cell.panY = scene.pans ? (scene.pans[i] ?? 0) : 0;
  });
  draft.active = 0;
  if (scene.mode === 'cover') document.body.classList.add('cover-shot');
  api.syncControls();
  try {
    await Promise.all([document.fonts.load('40px Anton'), document.fonts.load('20px Pacifico')]);
  } catch { /* fall back to system fonts */ }
  api.render();
  await document.fonts.ready;
  api.render();
  api.ready();
}
