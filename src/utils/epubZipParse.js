/**
 * Быстрый разбор EPUB (ZIP + nav/OPF) без epub.js — для импорта в библиотеку.
 */
import JSZip from 'jszip';

function slugFromHref(href) {
  return (href || 'section')
    .replace(/[#?].*$/, '')
    .replace(/[^\w.-]+/g, '_')
    .slice(0, 120) || 'section';
}

function textContent(el) {
  return (el?.textContent || '').replace(/\s+/g, ' ').trim();
}

/** Путь внутри EPUB для epub.js (как в manifest/nav, без префикса ZIP-папки) */
function normalizeEpubHref(href) {
  if (!href) return '';
  return href.trim().replace(/\\/g, '/');
}

function zipPathFromOpf(opfDir, href) {
  const rel = normalizeEpubHref(href);
  const base = opfDir.endsWith('/') ? opfDir : `${opfDir}/`;
  return (base + rel.replace(/^\//, '')).replace(/\/+/g, '/').replace(/^\//, '');
}

/** Один уровень ol → пункты TOC в формате, близком к epub.js */
function walkNavList(ol) {
  if (!ol) return [];
  const items = [];
  for (const li of ol.children) {
    if (li.tagName?.toLowerCase() !== 'li') continue;
    const link = li.querySelector(':scope > a[href]');
    if (!link) continue;
    const label = textContent(link);
    const href = normalizeEpubHref(link.getAttribute('href'));
    const subOl = li.querySelector(':scope > ol');
    const subitems = subOl ? walkNavList(subOl) : [];
    items.push({
      label,
      href,
      subitems: subitems.length ? subitems : undefined,
    });
  }
  return items;
}

/** TOC epub.js → chapters/sections для Sidebar */
export function tocItemsToChapters(tocItems) {
  if (!tocItems?.length) return [];
  return tocItems.map((item, idx) => {
    const label = (item.label || `Раздел ${idx + 1}`).trim();
    const href = item.href;
    if (item.subitems?.length) {
      return {
        id: slugFromHref(href) || `ch_${idx}`,
        title: label,
        sections: item.subitems.map((sub, sIdx) => ({
          id: slugFromHref(sub.href) || `sec_${idx}_${sIdx}`,
          title: (sub.label || `§ ${sIdx + 1}`).trim(),
          epubHref: sub.href,
        })),
      };
    }
    return {
      id: slugFromHref(href) || `ch_${idx}`,
      title: label,
      sections: [
        {
          id: slugFromHref(href) || `sec_${idx}_0`,
          title: label,
          epubHref: href,
        },
      ],
    };
  });
}

function spineToChapters(spineHrefs) {
  return spineHrefs.map((href, idx) => ({
    id: slugFromHref(href) || `spine_${idx}`,
    title: `Документ ${idx + 1}`,
    sections: [
      {
        id: slugFromHref(href) || `spine_${idx}`,
        title: `Документ ${idx + 1}`,
        epubHref: href,
      },
    ],
  }));
}

function parseOpfMetadata(opfDoc) {
  const title =
    textContent(opfDoc.querySelector('metadata dc\\:title, metadata title')) || '';
  const author =
    textContent(opfDoc.querySelector('metadata dc\\:creator, metadata creator')) || '';
  const identifier =
    textContent(opfDoc.querySelector('metadata dc\\:identifier, metadata identifier')) || '';
  return { title, author, identifier };
}

function parseSpine(opfDoc, manifestMap) {
  const refs = opfDoc.querySelectorAll('spine itemref');
  const hrefs = [];
  refs.forEach((ref) => {
    const idref = ref.getAttribute('idref');
    const href = manifestMap.get(idref);
    if (href) hrefs.push(normalizeEpubHref(href));
  });
  return hrefs;
}

function buildManifestMap(opfDoc) {
  const map = new Map();
  opfDoc.querySelectorAll('manifest item').forEach((item) => {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    if (id && href) map.set(id, href);
  });
  return map;
}

/**
 * @returns {Promise<{ title, author, identifier, chapters }>}
 */
export async function parseEpubFromZip(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer);

  const containerXml = await zip.file('META-INF/container.xml')?.async('string');
  if (!containerXml) throw new Error('EPUB: нет META-INF/container.xml');

  const opfMatch = containerXml.match(/full-path="([^"]+)"/i);
  if (!opfMatch) throw new Error('EPUB: не найден путь к content.opf');
  const opfPath = opfMatch[1].replace(/\\/g, '/');
  const opfDir = opfPath.includes('/') ? opfPath.replace(/\/[^/]+$/, '/') : '';

  const opfXml = await zip.file(opfPath)?.async('string');
  if (!opfXml) throw new Error('EPUB: content.opf не читается');

  const parser = new DOMParser();
  const opfDoc = parser.parseFromString(opfXml, 'application/xml');
  const { title, author, identifier } = parseOpfMetadata(opfDoc);
  const manifestMap = buildManifestMap(opfDoc);

  let chapters = [];
  let navRel = null;
  opfDoc.querySelectorAll('manifest item').forEach((item) => {
    const props = item.getAttribute('properties') || '';
    const href = item.getAttribute('href');
    if (props.split(/\s+/).includes('nav') && href) navRel = href;
  });
  if (!navRel) {
    for (const [, href] of manifestMap) {
      if (href?.endsWith('nav.xhtml')) {
        navRel = href;
        break;
      }
    }
  }

  const navZipPath = navRel ? zipPathFromOpf(opfDir, navRel) : null;
  const navXhtml = navZipPath ? await zip.file(navZipPath)?.async('string') : null;

  if (navXhtml) {
    const navDoc = parser.parseFromString(navXhtml, 'application/xhtml+xml');
    const navEl =
      navDoc.querySelector('nav[epub\\:type="toc"]') ||
      navDoc.querySelector('nav#toc') ||
      navDoc.querySelector('nav');
    const rootOl = navEl?.querySelector(':scope > ol') || navEl?.querySelector('ol');
    const tocItems = walkNavList(rootOl);
    chapters = tocItemsToChapters(tocItems);
  }

  if (chapters.length === 0) {
    const spineHrefs = parseSpine(opfDoc, manifestMap);
    chapters = spineToChapters(spineHrefs);
  }

  return {
    title,
    author,
    identifier,
    chapters,
  };
}
