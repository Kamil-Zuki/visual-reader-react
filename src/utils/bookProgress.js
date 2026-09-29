/** Процент прочитанных разделов книги */
export function calcBookProgressPercent(book, readSections, bookId) {
  if (!book?.chapters?.length) return 0;
  const ids = [];
  for (const ch of book.chapters) {
    for (const sec of ch.sections || []) {
      if (sec?.id) ids.push(sec.id);
    }
  }
  if (ids.length === 0) return 0;
  const read = new Set(readSections[bookId] || []);
  const done = ids.filter((id) => read.has(id)).length;
  return Math.round((done / ids.length) * 100);
}

export function countBookSections(book) {
  if (!book?.chapters) return 0;
  return book.chapters.reduce((n, ch) => n + (ch.sections?.length || 0), 0);
}
