/** Темы отображения EPUB (перебивают стили Pandoc / inline color) */

export const EPUB_READER_THEME_IDS = ['dark', 'light', 'sepia', 'book'];

export const EPUB_READER_THEME_LABELS = {
  dark: 'Тёмная',
  light: 'Светлая',
  sepia: 'Сепия',
  book: 'Как в файле',
};

const SYNTAX = `
.sourceCode .kw { color: #c4b5fd !important; }
.sourceCode .fu { color: #7dd3fc !important; }
.sourceCode .st, .sourceCode .vs { color: #86efac !important; }
.sourceCode .dt { color: #fcd34d !important; }
.sourceCode .dv, .sourceCode .bn { color: #fda4af !important; }
.sourceCode .ch, .sourceCode .co { color: #94a3b8 !important; }
.sourceCode .op { color: #e2e8f0 !important; }
.sourceCode .ot { color: #67e8f9 !important; }
.sourceCode .cf, .sourceCode .pp { color: #a5b4fc !important; }
`;

const CSS = {
  dark: `
html, body {
  background: #0c0e14 !important;
  color: #e2e8f0 !important;
  line-height: 1.65 !important;
}
body *:not(img):not(svg):not(video) {
  color: #e2e8f0 !important;
  border-color: #334155 !important;
}
h1, h2, h3, h4, h5, h6 {
  color: #f8fafc !important;
}
a, a:visited, a * {
  color: #a5b4fc !important;
}
pre, code, kbd, samp, tt {
  background-color: #1e293b !important;
  color: #e2e8f0 !important;
}
pre *, code * {
  color: #cbd5e1 !important;
}
table, th, td {
  background-color: transparent !important;
}
blockquote {
  border-left-color: #6366f1 !important;
  color: #cbd5e1 !important;
}
${SYNTAX}
`,
  light: `
html, body {
  background: #f8fafc !important;
  color: #1e293b !important;
  line-height: 1.65 !important;
}
body *:not(img):not(svg):not(video) {
  color: #1e293b !important;
}
h1, h2, h3, h4, h5, h6 {
  color: #0f172a !important;
}
a, a:visited, a * {
  color: #4338ca !important;
}
pre, code, kbd, samp, tt {
  background-color: #e2e8f0 !important;
  color: #0f172a !important;
}
pre *, code * {
  color: #334155 !important;
}
`,
  sepia: `
html, body {
  background: #f4ecd8 !important;
  color: #3d3429 !important;
  line-height: 1.65 !important;
}
body *:not(img):not(svg):not(video) {
  color: #3d3429 !important;
}
h1, h2, h3, h4, h5, h6 {
  color: #292018 !important;
}
a, a:visited, a * {
  color: #7c3aed !important;
}
pre, code, kbd, samp, tt {
  background-color: #e8dcc8 !important;
  color: #292018 !important;
}
`,
  book: `
html, body {
  background: #ffffff !important;
  line-height: 1.65 !important;
}
p, li {
  margin-bottom: 0.75em !important;
}
`,
};

const IFRAME_BG = {
  dark: '#0c0e14',
  light: '#f8fafc',
  sepia: '#f4ecd8',
  book: '#ffffff',
};

let registeredOn = null;

/** Регистрирует все темы в rendition (один раз на экземпляр) */
export function ensureEpubThemesRegistered(rendition) {
  if (!rendition?.themes) return;
  if (registeredOn === rendition) return;
  registeredOn = rendition;

  for (const id of EPUB_READER_THEME_IDS) {
    rendition.themes.registerCss(id, CSS[id]);
  }
}

/** Применить тему к уже открытому rendition */
export function selectEpubReaderTheme(rendition, themeId) {
  const id = EPUB_READER_THEME_IDS.includes(themeId) ? themeId : 'dark';
  ensureEpubThemesRegistered(rendition);
  rendition.themes.select(id);
  return IFRAME_BG[id];
}

export function epubThemeIframeBackground(themeId) {
  return IFRAME_BG[EPUB_READER_THEME_IDS.includes(themeId) ? themeId : 'dark'];
}
