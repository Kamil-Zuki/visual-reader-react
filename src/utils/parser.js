/**
 * parser.js - In-browser parser for HTML / text books
 */

function parseHtmlBook(htmlString, fileName = 'Новая книга') {
  // Extract body content or use full text
  let bodyContent = htmlString;
  const bodyMatch = htmlString.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) {
    bodyContent = bodyMatch[1];
  }

  // Try to find title
  let title = fileName.replace(/\.[^/.]+$/, '');
  const titleMatch = htmlString.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || htmlString.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (titleMatch) {
    title = cleanText(titleMatch[1]);
  }

  // Regex for h1 and h2
  const h1Regex = /<h1\s+(?:class="[^"]*"|id="([^"]*)")?[^>]*>([\s\S]*?)<\/h1>/gi;
  const h2Regex = /<h2\s+(?:id="([^"]*)")?[^>]*>([\s\S]*?)<\/h2>/gi;

  const h1Positions = [];
  let match;
  while ((match = h1Regex.exec(bodyContent)) !== null) {
    h1Positions.push({
      index: match.index,
      endIndex: match.index + match[0].length,
      id: match[1] || 'h1_' + h1Positions.length,
      title: cleanText(match[2]),
      fullMatch: match[0]
    });
  }

  const book = {
    id: 'book_' + Date.now(),
    title: title,
    createdAt: Date.now(),
    chapters: []
  };

  // If no h1 found, create single chapter with h2 or chunks
  if (h1Positions.length === 0) {
    book.chapters.push({
      id: 'chapter_main',
      title: title,
      sections: [{
        id: 'sec_main',
        title: 'Текст',
        html: cleanHtml(bodyContent)
      }]
    });
    return book;
  }

  // Split content between h1s
  for (let i = 0; i < h1Positions.length; i++) {
    const start = h1Positions[i].endIndex;
    const end = i + 1 < h1Positions.length ? h1Positions[i + 1].index : bodyContent.length;
    const chapterContent = bodyContent.substring(start, end).trim();

    // Skip TOC container
    if (chapterContent.includes('role="doc-toc"') && chapterContent.length < 5000) {
      continue;
    }

    const chapter = {
      id: h1Positions[i].id,
      title: h1Positions[i].title,
      sections: []
    };

    // Find h2 inside this chapter
    const h2Positions = [];
    let h2Match;
    while ((h2Match = h2Regex.exec(chapterContent)) !== null) {
      h2Positions.push({
        index: h2Match.index,
        endIndex: h2Match.index + h2Match[0].length,
        id: h2Match[1] || 'h2_' + h2Positions.length,
        title: cleanText(h2Match[2])
      });
    }

    if (h2Positions.length === 0) {
      chapter.sections.push({
        id: chapter.id + '_content',
        title: chapter.title,
        html: cleanHtml(chapterContent)
      });
    } else {
      // Intro part before first h2
      const intro = chapterContent.substring(0, h2Positions[0].index).trim();
      if (intro.length > 50) {
        chapter.sections.push({
          id: chapter.id + '_intro',
          title: 'Введение',
          html: cleanHtml(intro)
        });
      }

      for (let j = 0; j < h2Positions.length; j++) {
        const sStart = h2Positions[j].endIndex;
        const sEnd = j + 1 < h2Positions.length ? h2Positions[j + 1].index : chapterContent.length;
        chapter.sections.push({
          id: h2Positions[j].id,
          title: h2Positions[j].title,
          html: cleanHtml(chapterContent.substring(sStart, sEnd).trim())
        });
      }
    }

    book.chapters.push(chapter);
  }

  return book;
}

function cleanText(str) {
  return str.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function cleanHtml(html) {
  return html.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

export { parseHtmlBook };
