import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Parses a PDF file, extracting metadata, outline bookmarks, and page text.
 * @param {File} file 
 * @param {Function} onProgress ({ current, total, percentage }) => void
 * @returns {Promise<Object>} book data object compatible with reader
 */
export async function parsePdfBook(file, onProgress = () => {}) {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;

  const numPages = pdfDoc.numPages;
  let bookTitle = file.name.replace(/\.[^/.]+$/, "");
  let bookAuthor = '';

  // 1. Try to read document metadata
  try {
    const meta = await pdfDoc.getMetadata();
    if (meta?.info?.Title && meta.info.Title.trim().length > 2) {
      bookTitle = meta.info.Title.trim();
    }
    if (meta?.info?.Author) {
      bookAuthor = meta.info.Author.trim();
    }
  } catch (err) {
    console.warn('Could not read PDF metadata:', err);
  }

  // 2. Try to get outline / bookmarks
  let outline = null;
  try {
    outline = await pdfDoc.getOutline();
  } catch (err) {
    console.warn('Could not read PDF outline:', err);
  }

  // 3. Read text from all pages with progress tracking
  const pagesText = [];
  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    
    // Group text items by line roughly
    let lastY = null;
    let pageLines = [];
    let currentLine = '';

    for (const item of content.items) {
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
        if (currentLine.trim()) {
          pageLines.push(currentLine.trim());
        }
        currentLine = item.str;
      } else {
        currentLine += (currentLine ? ' ' : '') + item.str;
      }
      lastY = item.transform[5];
    }
    if (currentLine.trim()) {
      pageLines.push(currentLine.trim());
    }

    pagesText.push({
      pageNum: i,
      text: pageLines.join('\n'),
      lines: pageLines
    });

    onProgress({
      current: i,
      total: numPages,
      percentage: Math.round((i / numPages) * 100)
    });
  }

  // 4. Build chapters
  let chapters = [];

  // Strategy A: If outline exists, map bookmarks to page ranges
  if (outline && outline.length > 0) {
    const bookmarkItems = [];
    
    for (const item of outline) {
      try {
        let dest = item.dest;
        if (typeof dest === 'string') {
          dest = await pdfDoc.getDestination(dest);
        }
        if (Array.isArray(dest) && dest[0]) {
          const pageIndex = await pdfDoc.getPageIndex(dest[0]);
          bookmarkItems.push({
            title: item.title?.trim() || `Section`,
            pageNum: pageIndex + 1
          });
        }
      } catch (e) {
        // Destination resolution failed, skip bookmark
      }
    }

    // Sort bookmarks by page number
    bookmarkItems.sort((a, b) => a.pageNum - b.pageNum);

    if (bookmarkItems.length > 0) {
      for (let bIdx = 0; bIdx < bookmarkItems.length; bIdx++) {
        const currentB = bookmarkItems[bIdx];
        const nextB = bookmarkItems[bIdx + 1];
        const startPage = currentB.pageNum;
        const endPage = nextB ? nextB.pageNum - 1 : numPages;

        const sectionPages = pagesText.slice(startPage - 1, endPage);
        const sectionHtml = formatTextToHtml(sectionPages);

        chapters.push({
          title: currentB.title,
          sections: [
            {
              id: `pdf_sec_${bIdx + 1}`,
              title: currentB.title,
              html: sectionHtml
            }
          ]
        });
      }
    }
  }

  // Strategy B: If no outline or outline parsing produced nothing, split by chapters or chunks
  if (chapters.length === 0) {
    // Look for headings like "Chapter 1", "Глава 1", etc.
    const chapterMatches = [];
    const chapterRegex = /^(?:chapter|глава|part|часть)\s+([0-9ivxlcdm]+)[:.\s]*(.*)/i;

    for (let p = 0; p < pagesText.length; p++) {
      const page = pagesText[p];
      for (let l = 0; l < Math.min(page.lines.length, 5); l++) {
        const line = page.lines[l];
        if (chapterRegex.test(line)) {
          chapterMatches.push({
            title: line,
            pageNum: page.pageNum
          });
          break;
        }
      }
    }

    if (chapterMatches.length > 1) {
      for (let cIdx = 0; cIdx < chapterMatches.length; cIdx++) {
        const cur = chapterMatches[cIdx];
        const next = chapterMatches[cIdx + 1];
        const start = cur.pageNum;
        const end = next ? next.pageNum - 1 : numPages;
        const secPages = pagesText.slice(start - 1, end);
        
        chapters.push({
          title: cur.title,
          sections: [
            {
              id: `pdf_sec_${cIdx + 1}`,
              title: cur.title,
              html: formatTextToHtml(secPages)
            }
          ]
        });
      }
    } else {
      // Fallback Strategy C: Chunk by 10-15 pages per chapter
      const pagesPerChapter = Math.max(5, Math.min(20, Math.ceil(numPages / 15)));
      let chapCount = 1;

      for (let i = 0; i < pagesText.length; i += pagesPerChapter) {
        const slice = pagesText.slice(i, i + pagesPerChapter);
        const startP = slice[0].pageNum;
        const endP = slice[slice.length - 1].pageNum;
        const title = `Страницы ${startP}–${endP}`;

        chapters.push({
          title,
          sections: [
            {
              id: `pdf_chunk_${chapCount}`,
              title,
              html: formatTextToHtml(slice)
            }
          ]
        });
        chapCount++;
      }
    }
  }

  return {
    id: 'pdf_' + Date.now(),
    title: bookTitle,
    author: bookAuthor,
    format: 'pdf',
    totalPages: numPages,
    createdAt: Date.now(),
    chapters
  };
}

function formatTextToHtml(pages) {
  let html = '';
  for (const p of pages) {
    html += `<div class="pdf-page-marker" style="margin: 24px 0 12px; font-size: 0.75rem; color: #6b7280; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 4px;">— Страница ${p.pageNum} —</div>`;
    
    // Split into paragraphs by blank lines or line breaks
    const rawLines = p.lines;
    let currentParagraph = '';

    for (const line of rawLines) {
      if (line.trim().length === 0) {
        if (currentParagraph.trim()) {
          html += `<p style="margin-bottom: 14px; line-height: 1.7;">${escapeHtml(currentParagraph.trim())}</p>`;
          currentParagraph = '';
        }
      } else {
        currentParagraph += (currentParagraph ? ' ' : '') + line.trim();
      }
    }
    if (currentParagraph.trim()) {
      html += `<p style="margin-bottom: 14px; line-height: 1.7;">${escapeHtml(currentParagraph.trim())}</p>`;
    }
  }
  return html;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
