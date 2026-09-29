/**
 * Индекс полнотекстового поиска для EPUB (загрузка spine через epub.js).
 * Кэш: память + файл books/{id}.search.json в AppData (Tauri).
 */
import ePub from 'epubjs';
import { resolveEpubUrl } from './epubImport';
import { isTauriEnv } from './db';

const epubSearchCache = new Map();
const INDEX_VERSION = 1;

function normalizeHref(href) {
  if (!href) return '';
  return href.split('#')[0].replace(/^\//, '').trim();
}

function resolveSectionForSpineHref(spineHref, chapters) {
  const base = normalizeHref(spineHref);
  let fallback = { chapterIdx: 0, sectionIdx: 0, chapterTitle: '', sectionTitle: '' };

  for (let cIdx = 0; cIdx < chapters.length; cIdx++) {
    const chapter = chapters[cIdx];
    const chapterTitle = chapter.title || `Глава ${cIdx + 1}`;
    const sections = chapter.sections || [];
    for (let sIdx = 0; sIdx < sections.length; sIdx++) {
      const sec = sections[sIdx];
      const secBase = normalizeHref(sec.epubHref);
      if (!secBase) continue;
      if (secBase === base) {
        return {
          chapterIdx: cIdx,
          sectionIdx: sIdx,
          chapterTitle,
          sectionTitle: sec.title || chapterTitle,
          sectionId: sec.id || `${cIdx}_${sIdx}`,
        };
      }
      if (!fallback.sectionTitle && (base.endsWith(secBase) || secBase.endsWith(base))) {
        fallback = {
          chapterIdx: cIdx,
          sectionIdx: sIdx,
          chapterTitle,
          sectionTitle: sec.title || chapterTitle,
          sectionId: sec.id || `${cIdx}_${sIdx}`,
        };
      }
    }
  }
  return fallback;
}

function extractPlainTextFromSectionDocument(document) {
  if (!document) return '';
  const body = document.getElementsByTagName?.('body')?.[0] || document.documentElement;
  return (body?.textContent || '').replace(/\s+/g, ' ').trim();
}

function hydrateRecords(records) {
  return records.map((r) => ({
    ...r,
    plainTextLower: r.plainTextLower || (r.plainText || '').toLowerCase(),
    titleLower: r.titleLower || `${r.chapterTitle || ''} ${r.sectionTitle || ''}`.toLowerCase(),
  }));
}

async function loadIndexFromDisk(bookId) {
  if (!isTauriEnv()) return null;
  const { readTextFile, exists, BaseDirectory } = await import('@tauri-apps/plugin-fs');
  const rel = `books/${bookId}.search.json`;
  try {
    if (!(await exists(rel, { baseDir: BaseDirectory.AppData }))) return null;
    const raw = await readTextFile(rel, { baseDir: BaseDirectory.AppData });
    const parsed = JSON.parse(raw);
    if (parsed.v !== INDEX_VERSION || !Array.isArray(parsed.records)) return null;
    return hydrateRecords(parsed.records);
  } catch {
    return null;
  }
}

async function saveIndexToDisk(bookId, records) {
  if (!isTauriEnv()) return;
  const { mkdir, writeFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
  await mkdir('books', { baseDir: BaseDirectory.AppData, recursive: true });
  const payload = JSON.stringify({ v: INDEX_VERSION, builtAt: Date.now(), records });
  await writeFile(`books/${bookId}.search.json`, payload, { baseDir: BaseDirectory.AppData });
}

/** Удаляет файл индекса поиска на диске */
export async function deleteEpubSearchIndexFile(bookId) {
  if (!isTauriEnv() || !bookId) return;
  try {
    const { remove, BaseDirectory } = await import('@tauri-apps/plugin-fs');
    await remove(`books/${bookId}.search.json`, { baseDir: BaseDirectory.AppData });
  } catch {
    /* ignore */
  }
}

/**
 * @returns {Promise<Array>} записи в формате, совместимом с searchRecords()
 */
export async function buildEpubSearchRecords(book, bookId) {
  if (!book || book.format !== 'epub') return [];
  if (epubSearchCache.has(bookId)) return epubSearchCache.get(bookId);

  const fromDisk = await loadIndexFromDisk(bookId);
  if (fromDisk?.length) {
    epubSearchCache.set(bookId, fromDisk);
    return fromDisk;
  }

  const chapters = book.chapters || [];
  const url = await resolveEpubUrl(book);
  const epub = ePub(url);

  try {
    await epub.ready;
    const records = [];
    const spineItems = epub.spine?.spineItems || [];

    for (const section of spineItems) {
      // epub.js: linear — boolean (item.linear === "yes")
      if (!section.linear) continue;
      try {
        await section.load(epub.load.bind(epub));
        const plainText = extractPlainTextFromSectionDocument(section.document);
        section.unload();
        const loc = resolveSectionForSpineHref(section.href, chapters);
        const titleLower = `${loc.chapterTitle} ${loc.sectionTitle}`.toLowerCase();
        records.push({
          chapterIdx: loc.chapterIdx,
          sectionIdx: loc.sectionIdx,
          chapterTitle: loc.chapterTitle,
          sectionTitle: loc.sectionTitle,
          sectionId: loc.sectionId,
          plainText,
          plainTextLower: plainText.toLowerCase(),
          titleLower,
        });
      } catch (e) {
        console.warn('[epubSearch] spine section skip:', section.href, e);
      }
    }

    epubSearchCache.set(bookId, records);
    await saveIndexToDisk(bookId, records);
    return records;
  } finally {
    epub.destroy?.();
  }
}

export function clearEpubSearchCache(bookId) {
  if (bookId) {
    epubSearchCache.delete(bookId);
    deleteEpubSearchIndexFile(bookId);
  } else {
    epubSearchCache.clear();
  }
}
