/**

 * Импорт EPUB: быстрый ZIP-разбор, сохранение в AppData (Tauri).

 */

import ePub from 'epubjs';

import { isTauriEnv, setStoreValue } from './db';
import { pruneReadSectionsForBook } from './bookProgress';
import { useStore } from '../store/useStore';

import { parseEpubFromZip, tocItemsToChapters } from './epubZipParse';



const EPUB_OPEN_TIMEOUT_MS = 60_000;



function withTimeout(promise, ms, message) {

  return Promise.race([

    promise,

    new Promise((_, reject) => {

      setTimeout(() => reject(new Error(message)), ms);

    }),

  ]);

}



/** @deprecated используйте tocItemsToChapters — оставлено для совместимости */

export function navigationToChapters(tocItems) {

  return tocItemsToChapters(tocItems);

}



function formatTauriError(err) {
  if (!err) return 'неизвестная ошибка';
  if (typeof err === 'string') return err;
  if (err.message) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

async function persistEpubBytes(bookId, arrayBuffer) {
  if (!isTauriEnv()) return null;

  const { mkdir, writeFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
  const { join, appDataDir } = await import('@tauri-apps/api/path');

  try {
    await mkdir('books', { baseDir: BaseDirectory.AppData, recursive: true });
    const relPath = `books/${bookId}.epub`;
    await writeFile(relPath, new Uint8Array(arrayBuffer), { baseDir: BaseDirectory.AppData });
    return join(await appDataDir(), 'books', `${bookId}.epub`);
  } catch (err) {
    throw new Error(`Не удалось сохранить EPUB в библиотеку: ${formatTauriError(err)}`);
  }
}



/** Быстрый id без полного SHA всего файла (на больших EPUB digest мог тормозить UI) */

async function deriveEpubBookId(arrayBuffer, identifierHint) {

  const fromMeta = (identifierHint || '').trim();

  if (fromMeta) {

    const safe = fromMeta.replace(/[^\w.-]+/g, '_').slice(0, 96);

    if (safe) return `epub_${safe}`;

  }

  const view = new Uint8Array(arrayBuffer);

  const head = view.subarray(0, Math.min(view.length, 256 * 1024));

  const digest = await crypto.subtle.digest('SHA-256', head);

  const hex = Array.from(new Uint8Array(digest))

    .map((b) => b.toString(16).padStart(2, '0'))

    .join('');

  return `epub_${hex.slice(0, 20)}_${arrayBuffer.byteLength}`;

}



/** Fallback: epub.js если ZIP-разбор не удался */

async function parseViaEpubJs(openUrl) {

  const epub = ePub(openUrl);

  try {

    await withTimeout(epub.ready, EPUB_OPEN_TIMEOUT_MS, 'Таймаут epub.js при разборе EPUB');

    const metadata = await epub.loaded.metadata;

    const navigation = await epub.loaded.navigation;

    let chapters = tocItemsToChapters(navigation?.toc);

    if (chapters.length === 0) {

      const spine = await epub.loaded.spine;

      chapters = (spine?.spineItems || []).map((item, idx) => ({

        id: `spine_${idx}`,

        title: item.id || `Документ ${idx + 1}`,

        sections: [{ id: `spine_${idx}`, title: item.id || `Документ ${idx + 1}`, epubHref: item.href }],

      }));

    }

    const creator = metadata?.creator;

    const author =

      (typeof creator === 'string' ? creator : Array.isArray(creator) ? creator[0] : '')?.trim?.() || '';

    return {

      title: metadata?.title?.trim() || '',

      author,

      identifier: metadata?.identifier,

      chapters,

    };

  } finally {

    epub.destroy?.();

  }

}



export async function deleteEpubFile(bookId) {

  if (!isTauriEnv() || !bookId) return;

  try {

    const { remove, BaseDirectory } = await import('@tauri-apps/plugin-fs');

    await remove(`books/${bookId}.epub`, { baseDir: BaseDirectory.AppData });

  } catch {

    /* ignore */

  }

  const { deleteEpubSearchIndexFile } = await import('./epubSearchIndex');

  await deleteEpubSearchIndexFile(bookId);

}



/**

 * @param {File} file

 * @param {(stage: string) => void} [onProgress]

 */

export async function importEpubFile(file, onProgress) {

  onProgress?.('read');

  const arrayBuffer = await file.arrayBuffer();



  onProgress?.('parse');

  let parsed;

  try {

    parsed = await parseEpubFromZip(arrayBuffer);

  } catch (zipErr) {

    console.warn('[epubImport] ZIP parse failed, fallback epub.js:', zipErr);

    const blobUrl = URL.createObjectURL(new Blob([arrayBuffer], { type: 'application/epub+zip' }));

    try {

      parsed = await parseViaEpubJs(blobUrl);

    } finally {

      URL.revokeObjectURL(blobUrl);

    }

  }



  if (!parsed.chapters?.length) {

    throw new Error('Не удалось извлечь оглавление из EPUB');

  }



  onProgress?.('id');

  const bookId = await deriveEpubBookId(arrayBuffer, parsed.identifier);



  onProgress?.('save');

  const filePath = await persistEpubBytes(bookId, arrayBuffer);



  const title =

    parsed.title?.trim() || file.name.replace(/\.epub$/i, '') || 'EPUB';



  onProgress?.('done');



  return {

    id: bookId,

    title,

    author: parsed.author || '',

    format: 'epub',

    filePath: filePath || undefined,

    epubBlobUrl: filePath ? undefined : URL.createObjectURL(new Blob([arrayBuffer], { type: 'application/epub+zip' })),

    chapters: parsed.chapters,

    createdAt: Date.now(),

  };

}



/** EPUB перед чтением: оглавление с диска и сохранение в БД при изменении id */
export async function prepareEpubBookForReading(book, saveBookToDB) {
  if (!book || book.format !== 'epub') return book;
  const refreshed = await refreshEpubTocFromDisk(book);
  if (saveBookToDB && JSON.stringify(refreshed.chapters) !== JSON.stringify(book.chapters)) {
    await saveBookToDB(refreshed);
  }
  const pruned = pruneReadSectionsForBook(refreshed, useStore.getState().readSections);
  if (pruned.changed) {
    setStoreValue('ddia_read_sections', pruned.readSections);
    useStore.setState({ readSections: pruned.readSections });
  }
  return refreshed;
}

/** Перечитать оглавление с диска (актуальные id разделов с #якорями) */
export async function refreshEpubTocFromDisk(book) {
  if (!book || book.format !== 'epub') return book;
  try {
    let bytes;
    if (isTauriEnv() && book.id) {
      const { readFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
      bytes = await readFile(`books/${book.id}.epub`, { baseDir: BaseDirectory.AppData });
    } else if (book.epubBlobUrl) {
      const res = await fetch(book.epubBlobUrl);
      bytes = new Uint8Array(await res.arrayBuffer());
    } else {
      return book;
    }
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const parsed = await parseEpubFromZip(buf);
    if (!parsed.chapters?.length) return book;
    return { ...book, chapters: parsed.chapters };
  } catch (err) {
    console.warn('[epubImport] refreshEpubTocFromDisk:', err);
    return book;
  }
}

export async function resolveEpubUrl(book) {

  if (book.filePath && isTauriEnv()) {

    const { convertFileSrc } = await import('@tauri-apps/api/core');

    return convertFileSrc(book.filePath);

  }

  if (book.epubBlobUrl) return book.epubBlobUrl;

  throw new Error('EPUB файл не найден — импортируйте книгу заново');

}


