// Neon Shore shot scenes: the four ?shot= presets the screenshots use.
// A cover scene hides the editor chrome and fills the window; the
// editor scene keeps the whole page. Wide is a 16:9 full-bleed cover.

const SHOTS = {
  cover: {
    layout: 'hero3', grade: 'sunset',
    title: 'NEON SHORE', subtitle: 'Vice City nights', showSub: true,
    chrome: false, aspect: 'square',
  },
  editor: {
    layout: 'hero3', grade: 'sunset',
    title: 'Neon Shore', subtitle: 'Vice City nights', showSub: true,
    chrome: true, aspect: 'square',
  },
  nine: {
    layout: 'nine', grade: 'neon',
    title: 'NIGHT SHIFT', subtitle: 'Vice City nights', showSub: true,
    chrome: false, aspect: 'square',
  },
  wide: {
    layout: 'full', grade: 'golden',
    title: 'PIER PRESSURE', subtitle: 'golden hour', showSub: true,
    chrome: false, aspect: 'wide', photo: 3,
  },
};

function shotFromUrl() {
  const params = new URLSearchParams(location.search);
  const name = params.get('shot') || 'editor';
  const preset = SHOTS[name] || SHOTS.editor;
  return { name: SHOTS[name] ? name : 'editor', ...preset };
}
