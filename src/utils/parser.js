/**
 * parser.js - In-browser parser for HTML / text books
 */

const HEADING_RE = {
  // Только h1 с id — не title-block pandoc (<h1 class="title">)
  h1: /<h1\b[^>]*\sid="([^"]+)"[^>]*>([\s\S]*?)<\/h1>/gi,
  h2: /<h2\b([^>]*)>([\s\S]*?)<\/h2>/gi,
  h3: /<h3\b([^>]*)>([\s\S]*?)<\/h3>/gi,
};

/** Убирает шапку и встроенное оглавление pandoc */
function stripBookChrome(html) {
  return html
    .replace(/<header\b[\s\S]*?<\/header>/i, '')
    .replace(/<nav\b[^>]*role="doc-toc"[\s\S]*?<\/nav>/i, '')
    .replace(/<nav\b[^>]*\bid="TOC"[\s\S]*?<\/nav>/i, '')
    .trim();
}

function parseHtmlBook(htmlString, fileName = 'Новая книга') {
  let bodyContent = htmlString;
  const bodyMatch = htmlString.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) {
    bodyContent = bodyMatch[1];
  }
  bodyContent = stripBookChrome(bodyContent);

  let title = fileName.replace(/\.[^/.]+$/, '');
  const titleMatch = htmlString.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || htmlString.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (titleMatch) {
    title = cleanText(titleMatch[1]);
  }

  const h1Positions = findHeadings(bodyContent, 'h1');

  const book = {
    id: 'book_' + Date.now(),
    title: title,
    createdAt: Date.now(),
    chapters: [],
  };

  if (h1Positions.length === 0) {
    book.chapters.push({
      id: 'chapter_main',
      title: title,
      sections: buildSectionsFromContent(bodyContent, 'chapter_main'),
    });
    return book;
  }

  for (let i = 0; i < h1Positions.length; i++) {
    const start = h1Positions[i].endIndex;
    const end = i + 1 < h1Positions.length ? h1Positions[i + 1].index : bodyContent.length;
    const chapterContent = bodyContent.substring(start, end).trim();

    if (chapterContent.includes('role="doc-toc"') && chapterContent.length < 5000) {
      continue;
    }

    book.chapters.push({
      id: h1Positions[i].id,
      title: h1Positions[i].title,
      sections: buildSectionsFromContent(chapterContent, h1Positions[i].id),
    });
  }

  return book;
}

/**
 * Строит секции: h2 → при наличии h3 внутри блока дробит на подразделы.
 */
function buildSectionsFromContent(content, chapterId) {
  const h2Positions = findHeadings(content, 'h2');
  const sections = [];

  if (h2Positions.length === 0) {
    const h3Only = findHeadings(content, 'h3');
    if (h3Only.length === 0) {
      if (content.trim().length > 0) {
        sections.push({
          id: chapterId + '_content',
          title: 'Текст',
          html: normalizeHtml(content),
        });
      }
      return sections;
    }
    return sectionsFromHeadingBlocks(content, h3Only, chapterId + '_h3');
  }

  const intro = content.substring(0, h2Positions[0].index).trim();
  if (intro.length > 50) {
    sections.push({
      id: chapterId + '_intro',
      title: 'Введение',
      html: normalizeHtml(intro),
    });
  }

  for (let j = 0; j < h2Positions.length; j++) {
    const blockStart = h2Positions[j].endIndex;
    const blockEnd = j + 1 < h2Positions.length ? h2Positions[j + 1].index : content.length;
    const blockHtml = content.substring(blockStart, blockEnd).trim();
    const h3InBlock = findHeadings(blockHtml, 'h3');

    if (h3InBlock.length === 0) {
      sections.push({
        id: h2Positions[j].id,
        title: h2Positions[j].title,
        html: normalizeHtml(blockHtml),
      });
      continue;
    }

    const beforeFirstH3 = blockHtml.substring(0, h3InBlock[0].index).trim();
    if (beforeFirstH3.length > 0) {
      sections.push({
        id: h2Positions[j].id,
        title: h2Positions[j].title,
        html: normalizeHtml(beforeFirstH3),
      });
    }

    sections.push(...sectionsFromHeadingBlocks(blockHtml, h3InBlock, h2Positions[j].id));
  }

  return sections;
}

function sectionsFromHeadingBlocks(content, headingPositions, idPrefix) {
  const sections = [];
  for (let k = 0; k < headingPositions.length; k++) {
    const start = headingPositions[k].endIndex;
    const end = k + 1 < headingPositions.length ? headingPositions[k + 1].index : content.length;
    sections.push({
      id: headingPositions[k].id,
      title: headingPositions[k].title,
      html: normalizeHtml(content.substring(start, end).trim()),
    });
  }
  return sections;
}

function findHeadings(content, level) {
  const re = HEADING_RE[level];
  if (!re) return [];
  const positions = [];
  const regex = new RegExp(re.source, re.flags);
  let m;
  while ((m = regex.exec(content)) !== null) {
    let id;
    let titleHtml;
    if (level === 'h1') {
      id = m[1];
      titleHtml = m[2];
    } else {
      const attrPart = m[1] || '';
      const idMatch = attrPart.match(/\bid="([^"]*)"/i);
      id = idMatch?.[1] || `${level}_${positions.length}`;
      titleHtml = m[2];
    }
    positions.push({
      index: m.index,
      endIndex: m.index + m[0].length,
      id,
      title: cleanText(titleHtml),
    });
  }
  return positions;
}

function cleanText(str) {
  return str.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeHtml(html) {
  let out = html.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Мягкие переносы и unicode-дефисы из PDF/pandoc
  out = out.replace(/\u00AD/g, '');
  out = out.replace(/\u2010/g, '-');

  // Склейка переноса слова: "replica-\ntion" → "replication"
  out = out.replace(/([A-Za-z])-\n([a-z])/g, '$1$2');

  out = convertBulletParagraphsToLists(out);

  return out.trim();
}

/** Серии <p>• …</p> → один <ul> */
function convertBulletParagraphsToLists(html) {
  return html.replace(/(?:<p>\s*•\s*([\s\S]*?)<\/p>\s*)+/gi, (block) => {
    const items = [...block.matchAll(/<p>\s*•\s*([\s\S]*?)<\/p>/gi)];
    if (items.length === 0) return block;
    const lis = items.map((m) => `<li>${m[1].trim()}</li>`).join('\n');
    return `<ul>\n${lis}\n</ul>\n`;
  });
}

export { parseHtmlBook, normalizeHtml };
