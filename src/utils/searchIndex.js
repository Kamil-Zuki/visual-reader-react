/**
 * searchIndex.js
 * In-memory plaintext extraction and full-text search across book chapters and sections.
 */

// Cache map: bookId -> array of indexed sections
const searchCache = new Map();

/**
 * Strips HTML tags and decodes common HTML entities for clean plaintext search
 */
export function stripHtml(html) {
  if (!html) return '';
  // Fast regex-based tag stripping
  let text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}

/**
 * Indexes a book's chapters and sections into searchable plaintext records.
 */
export function indexBook(book, bookId = 'default') {
  if (!book) return [];

  const chapters = book.chapters || book.structure || [];
  const records = [];

  chapters.forEach((chapter, cIdx) => {
    const chapterTitle = chapter.title || `Глава ${cIdx + 1}`;
    const sections = chapter.sections || [];

    sections.forEach((sec, sIdx) => {
      const sectionTitle = sec.title || `Раздел ${sIdx + 1}`;
      const rawHtml = sec.html || sec.content || '';
      const plainText = stripHtml(rawHtml);

      records.push({
        chapterIdx: cIdx,
        sectionIdx: sIdx,
        chapterTitle,
        sectionTitle,
        sectionId: sec.id || `${cIdx}_${sIdx}`,
        plainText,
        plainTextLower: plainText.toLowerCase(),
        titleLower: `${chapterTitle} ${sectionTitle}`.toLowerCase()
      });
    });
  });

  searchCache.set(bookId, records);
  return records;
}

/**
 * Searches across the indexed book content.
 * Returns grouped or flat list of matching sections with snippets.
 */
export function searchInBook(book, bookId, query, maxResults = 50) {
  if (!query || query.trim().length < 2) return [];

  const trimmedQuery = query.trim();
  const qLower = trimmedQuery.toLowerCase();

  let records = searchCache.get(bookId);
  if (!records || records.length === 0) {
    records = indexBook(book, bookId);
  }

  const results = [];

  for (const record of records) {
    const titleMatch = record.titleLower.includes(qLower);
    const textIndex = record.plainTextLower.indexOf(qLower);

    if (titleMatch || textIndex !== -1) {
      // Find all match occurrences in text (up to 3 snippets per section)
      const snippets = [];
      let cursor = 0;
      let occurrenceCount = 0;

      while (cursor < record.plainTextLower.length) {
        const matchIdx = record.plainTextLower.indexOf(qLower, cursor);
        if (matchIdx === -1) break;
        occurrenceCount++;

        if (snippets.length < 3) {
          const start = Math.max(0, matchIdx - 55);
          const end = Math.min(record.plainText.length, matchIdx + trimmedQuery.length + 55);

          const before = (start > 0 ? '…' : '') + record.plainText.slice(start, matchIdx);
          const match = record.plainText.slice(matchIdx, matchIdx + trimmedQuery.length);
          const after = record.plainText.slice(matchIdx + trimmedQuery.length, end) + (end < record.plainText.length ? '…' : '');

          snippets.push({
            before,
            match,
            after,
            charIndex: matchIdx
          });
        }

        cursor = matchIdx + Math.max(1, trimmedQuery.length);
      }

      // If matched only in title
      if (snippets.length === 0 && titleMatch) {
        const previewEnd = Math.min(record.plainText.length, 120);
        snippets.push({
          before: '',
          match: '',
          after: record.plainText.slice(0, previewEnd) + (record.plainText.length > 120 ? '…' : ''),
          charIndex: 0
        });
      }

      results.push({
        chapterIdx: record.chapterIdx,
        sectionIdx: record.sectionIdx,
        chapterTitle: record.chapterTitle,
        sectionTitle: record.sectionTitle,
        sectionId: record.sectionId,
        matchCount: occurrenceCount || (titleMatch ? 1 : 0),
        snippets
      });

      if (results.length >= maxResults) break;
    }
  }

  return results;
}
