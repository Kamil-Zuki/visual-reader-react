/** Все id разделов текущего оглавления книги */
export function collectBookSectionIds(book) {
  const ids = [];
  if (!book?.chapters?.length) return ids;
  for (const ch of book.chapters) {
    for (const sec of ch.sections || []) {
      if (sec?.id) ids.push(sec.id);
    }
  }
  return ids;
}

/** Прочитанные id, которые ещё есть в оглавлении (без «висячих» записей) */
export function getEffectiveReadSectionIds(book, readSections, bookId) {
  const valid = new Set(collectBookSectionIds(book));
  if (valid.size === 0) return [];
  return (readSections[bookId] || []).filter((id) => valid.has(id));
}

export function countEffectiveReadSections(book, readSections, bookId) {
  return getEffectiveReadSectionIds(book, readSections, bookId).length;
}

/** Процент прочитанных разделов книги */
export function calcBookProgressPercent(book, readSections, bookId) {
  const ids = collectBookSectionIds(book);
  if (ids.length === 0) return 0;
  const read = new Set(getEffectiveReadSectionIds(book, readSections, bookId));
  const done = ids.filter((id) => read.has(id)).length;
  return Math.round((done / ids.length) * 100);
}

/** Убрать из прогресса id, которых больше нет в оглавлении (после обновления EPUB) */
export function pruneReadSectionsForBook(book, readSections) {
  if (!book?.id) return { readSections, changed: false };
  const kept = getEffectiveReadSectionIds(book, readSections, book.id);
  const prev = readSections[book.id] || [];
  if (kept.length === prev.length && kept.every((id, i) => id === prev[i])) {
    return { readSections, changed: false };
  }
  return {
    readSections: { ...readSections, [book.id]: kept },
    changed: true,
  };
}

export function countBookSections(book) {
  if (!book?.chapters) return 0;
  return book.chapters.reduce((n, ch) => n + (ch.sections?.length || 0), 0);
}
