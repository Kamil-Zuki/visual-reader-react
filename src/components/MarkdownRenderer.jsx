import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import ImageZoomModal from './ImageZoomModal';

const INLINE_TOKEN_REGEX = new RegExp(
  '(!\\[[^\\]]*?\\]\\([^)]*?\\)|`[^`]+`|\\*\\*\\*[^*]+?\\*\\*\\*|___[^_]+?___|\\*\\*[^*]+?\\*\\*|__[^_]+?__|\\*[^*]+?\\*|_[^_]+?_|~~[^~]+?~~|\\[[^\\]]*?\\]\\([^)]*?\\))',
  'g'
);

const HR_REGEX = new RegExp('^(\\*\\*\\*+|---+|___+)$');
const HEADING_REGEX = new RegExp('^(#{1,6})\\s+(.*)$');
const UNORDERED_REGEX = new RegExp('^[-*+]\\s+(.*)$');
const ORDERED_REGEX = new RegExp('^(\\d+)\\.\\s+(.*)$');

function isTableSeparatorLine(str) {
  if (!str.startsWith('|') || !str.endsWith('|')) return false;
  const parts = str.slice(1, -1).split('|');
  return parts.length > 0 && parts.every((p) => {
    const t = p.trim();
    return t.length > 0 && /^:?-+:?$/.test(t);
  });
}

/**
 * Парсит инлайн-разметку Markdown:
 * - `code`
 * - ***bold italic*** / ___bold italic___
 * - **bold** / __bold__
 * - *italic* / _italic_
 * - ~~strikethrough~~
 * - [link text](url)
 */
export function renderInlineMarkdown(text, onImageClick) {
  if (!text) return null;

  const parts = text.split(INLINE_TOKEN_REGEX);

  return parts.map((part, index) => {
    if (!part) return null;

    // Inline code: `code`
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={index}
          className="px-1.5 py-0.5 rounded bg-white/10 text-primaryGlow font-mono text-[11px] select-text"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Bold + Italic: ***text*** or ___text___
    if (
      (part.startsWith('***') && part.endsWith('***') && part.length >= 6) ||
      (part.startsWith('___') && part.endsWith('___') && part.length >= 6)
    ) {
      return (
        <strong key={index} className="font-bold italic text-white">
          {renderInlineMarkdown(part.slice(3, -3), onImageClick)}
        </strong>
      );
    }

    // Bold: **text** or __text__
    if (
      (part.startsWith('**') && part.endsWith('**') && part.length >= 4) ||
      (part.startsWith('__') && part.endsWith('__') && part.length >= 4)
    ) {
      return (
        <strong key={index} className="font-semibold text-white">
          {renderInlineMarkdown(part.slice(2, -2), onImageClick)}
        </strong>
      );
    }

    // Italic: *text* or _text_
    if (
      (part.startsWith('*') && part.endsWith('*') && part.length >= 2) ||
      (part.startsWith('_') && part.endsWith('_') && part.length >= 2)
    ) {
      return (
        <em key={index} className="italic text-textMain/90">
          {renderInlineMarkdown(part.slice(1, -1), onImageClick)}
        </em>
      );
    }

    // Strikethrough: ~~text~~
    if (part.startsWith('~~') && part.endsWith('~~') && part.length >= 4) {
      return (
        <del key={index} className="line-through text-textDim">
          {renderInlineMarkdown(part.slice(2, -2), onImageClick)}
        </del>
      );
    }

    // Image: ![alt](url)
    const imgMatch = part.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imgMatch) {
      return (
        <img
          key={index}
          src={imgMatch[2]}
          alt={imgMatch[1] || ''}
          onClick={() => onImageClick?.({ src: imgMatch[2], alt: imgMatch[1] || '' })}
          className="my-2 max-h-72 max-w-full rounded-lg border border-white/10 object-contain cursor-zoom-in hover:opacity-90 transition-opacity inline-block"
        />
      );
    }

    // Link: [text](url)
    const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
    if (linkMatch) {
      return (
        <a
          key={index}
          href={linkMatch[2]}
          target="_blank"
          rel="noreferrer"
          className="text-primaryGlow underline hover:text-white transition-colors"
        >
          {linkMatch[1]}
        </a>
      );
    }

    return part;
  });
}

function CodeBlock({ code, lang }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2.5 rounded-lg bg-black/70 border border-white/10 overflow-hidden shadow-inner">
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/10 text-[11px] text-textDim font-mono">
        <span className="text-primaryGlow font-medium">{lang || 'code'}</span>
        <button
          onClick={handleCopy}
          type="button"
          className="hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
          title="Скопировать код"
        >
          {copied ? (
            <>
              <Check size={12} className="text-accentEmerald" />
              <span className="text-accentEmerald">Скопировано</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Копировать</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 text-[11px] font-mono text-slate-200 overflow-x-auto custom-scrollbar leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * Разбивает markdown текст на структурированные блоки:
 * - code_block
 * - heading (h1-h6)
 * - hr
 * - blockquote
 * - list (unordered / ordered)
 * - table
 * - paragraph
 */
function parseMarkdownBlocks(text) {
  if (!text) return [];

  const rawBlocks = [];
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      rawBlocks.push({
        type: 'text_chunk',
        content: text.slice(lastIndex, match.index),
      });
    }
    rawBlocks.push({
      type: 'code',
      lang: match[1] || '',
      code: match[2].trimEnd(),
    });
    lastIndex = codeBlockRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    rawBlocks.push({
      type: 'text_chunk',
      content: text.slice(lastIndex),
    });
  }

  const finalBlocks = [];

  for (const block of rawBlocks) {
    if (block.type === 'code') {
      finalBlocks.push(block);
      continue;
    }

    // Обработка текстового фрагмента построчно
    const lines = block.content.split(/\r?\n/);
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // Пустые строки пропускаем
      if (!trimmed) {
        i++;
        continue;
      }

      // 1. Horizontal Rule: ---, ***, ___
      if (HR_REGEX.test(trimmed)) {
        finalBlocks.push({ type: 'hr' });
        i++;
        continue;
      }

      // 2. Headings: # to ######
      const headingMatch = trimmed.match(HEADING_REGEX);
      if (headingMatch) {
        finalBlocks.push({
          type: 'heading',
          level: headingMatch[1].length,
          text: headingMatch[2].trim(),
        });
        i++;
        continue;
      }

      // 3. Blockquotes: > line
      if (trimmed.startsWith('>')) {
        const quoteLines = [];
        while (i < lines.length && lines[i].trim().startsWith('>')) {
          quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
          i++;
        }
        finalBlocks.push({
          type: 'blockquote',
          text: quoteLines.join('\n'),
        });
        continue;
      }

      // 4. Lists (Unordered: -, *, + or Ordered: 1., 2.)
      const isUnordered = UNORDERED_REGEX.test(trimmed);
      const isOrdered = ORDERED_REGEX.test(trimmed);

      if (isUnordered || isOrdered) {
        const listType = isOrdered ? 'ol' : 'ul';
        const items = [];

        while (i < lines.length) {
          const currLine = lines[i];
          const currTrimmed = currLine.trim();
          if (!currTrimmed) break;

          const itemMatch = isOrdered
            ? currTrimmed.match(ORDERED_REGEX)
            : currTrimmed.match(UNORDERED_REGEX);

          if (itemMatch) {
            const itemText = isOrdered ? itemMatch[2] : itemMatch[1];
            items.push(itemText);
            i++;
          } else if (items.length > 0 && (currLine.startsWith('  ') || currLine.startsWith('\t'))) {
            // Продолжение предыдущего пункта списка
            items[items.length - 1] += '\n' + currTrimmed;
            i++;
          } else {
            break;
          }
        }

        finalBlocks.push({
          type: 'list',
          listType,
          items,
        });
        continue;
      }

      // 5. Tables: | col1 | col2 |
      if (trimmed.startsWith('|') && trimmed.endsWith('|') && i + 1 < lines.length && isTableSeparatorLine(lines[i + 1].trim())) {
        const headers = trimmed.slice(1, -1).split('|').map((h) => h.trim());
        i += 2; // пропускаем заголовок и разделитель |---|---|
        const rows = [];
        while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
          const cells = lines[i].trim().slice(1, -1).split('|').map((c) => c.trim());
          rows.push(cells);
          i++;
        }
        finalBlocks.push({
          type: 'table',
          headers,
          rows,
        });
        continue;
      }

      // 6. Regular Paragraph
      const paraLines = [trimmed];
      i++;
      while (i < lines.length) {
        const nextLine = lines[i];
        const nextTrimmed = nextLine.trim();
        if (!nextTrimmed) break;

        // Если следующая строка — спец-блок, прерываем параграф
        if (
          HEADING_REGEX.test(nextTrimmed) ||
          UNORDERED_REGEX.test(nextTrimmed) ||
          ORDERED_REGEX.test(nextTrimmed) ||
          nextTrimmed.startsWith('>') ||
          HR_REGEX.test(nextTrimmed) ||
          (nextTrimmed.startsWith('|') && nextTrimmed.endsWith('|'))
        ) {
          break;
        }

        paraLines.push(nextTrimmed);
        i++;
      }

      finalBlocks.push({
        type: 'paragraph',
        text: paraLines.join('\n'),
      });
    }
  }

  return finalBlocks;
}

export default function MarkdownRenderer({ content, className = '' }) {
  const [zoomedImage, setZoomedImage] = useState(null);

  if (!content) return null;

  const blocks = parseMarkdownBlocks(content);
  const handleImageClick = (img) => setZoomedImage(img);

  return (
    <div className={`text-xs leading-relaxed space-y-2 break-words text-textMain ${className}`}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'code':
            return <CodeBlock key={idx} code={block.code} lang={block.lang} />;

          case 'heading': {
            if (block.level === 1) {
              return (
                <h2 key={idx} className="font-bold text-primaryGlow text-sm pt-2 pb-0.5 border-b border-white/10">
                  {renderInlineMarkdown(block.text, handleImageClick)}
                </h2>
              );
            }
            if (block.level === 2) {
              return (
                <h3 key={idx} className="font-bold text-white text-xs pt-2 pb-0.5">
                  {renderInlineMarkdown(block.text, handleImageClick)}
                </h3>
              );
            }
            if (block.level === 3) {
              return (
                <h4 key={idx} className="font-semibold text-white text-xs pt-1.5 pb-0.5">
                  {renderInlineMarkdown(block.text, handleImageClick)}
                </h4>
              );
            }
            return (
              <h5 key={idx} className="font-medium text-primaryGlow/90 text-xs pt-1 pb-0.5">
                {renderInlineMarkdown(block.text, handleImageClick)}
              </h5>
            );
          }

          case 'hr':
            return <hr key={idx} className="border-white/10 my-2.5" />;

          case 'blockquote':
            return (
              <blockquote
                key={idx}
                className="border-l-2 border-primary/70 bg-white/[0.03] px-3 py-1.5 my-1.5 rounded-r text-textMuted italic text-xs space-y-1"
              >
                {block.text.split('\n').map((line, lIdx) => (
                  <p key={lIdx}>{renderInlineMarkdown(line, handleImageClick)}</p>
                ))}
              </blockquote>
            );

          case 'list': {
            const ListTag = block.listType;
            const listClass =
              block.listType === 'ol'
                ? 'list-decimal list-outside pl-4 space-y-1 my-1.5'
                : 'list-disc list-outside pl-4 space-y-1 my-1.5';

            return (
              <ListTag key={idx} className={listClass}>
                {block.items.map((item, iIdx) => (
                  <li key={iIdx} className="text-textMain leading-relaxed pl-0.5">
                    {renderInlineMarkdown(item, handleImageClick)}
                  </li>
                ))}
              </ListTag>
            );
          }

          case 'table':
            return (
              <div key={idx} className="my-2 overflow-x-auto rounded-lg border border-white/10">
                <table className="min-w-full divide-y divide-white/10 text-[11px]">
                  <thead className="bg-white/5">
                    <tr>
                      {block.headers.map((h, hIdx) => (
                        <th key={hIdx} className="px-2.5 py-1.5 text-left font-semibold text-white">
                          {renderInlineMarkdown(h, handleImageClick)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-black/20">
                    {block.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-white/[0.02]">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="px-2.5 py-1.5 text-textMain">
                            {renderInlineMarkdown(cell, handleImageClick)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case 'paragraph':
          default:
            return (
              <p key={idx} className="text-textMain leading-relaxed">
                {block.text.split('\n').map((line, lIdx, arr) => (
                  <React.Fragment key={lIdx}>
                    {renderInlineMarkdown(line, handleImageClick)}
                    {lIdx < arr.length - 1 && <br />}
                  </React.Fragment>
                ))}
              </p>
            );
        }
      })}

      <ImageZoomModal
        isOpen={Boolean(zoomedImage)}
        onClose={() => setZoomedImage(null)}
        src={zoomedImage?.src}
        alt={zoomedImage?.alt}
      />
    </div>
  );
}
