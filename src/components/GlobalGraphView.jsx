import React, { useMemo, useRef, useState, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useStore } from '../store/useStore';
import { Network } from 'lucide-react';
import { getAllBooksFromDB } from '../utils/db';

function escapeMermaidLabel(text) {
  return String(text || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 40);
}

export default function GlobalGraphView() {
  const { flashcards, highlights, setCurrentBook } = useStore();
  const [books, setBooks] = useState([]);
  const containerRef = useRef(null);

  useEffect(() => {
    getAllBooksFromDB().then((data) => {
      setBooks(data || []);
    });
  }, []);

  const graphData = useMemo(() => {
    const nodes = [];
    const links = [];
    const nodeMeta = {};

    // Center Node (You / Mind)
    nodes.push({ id: 'core', name: 'Второй Мозг', val: 30, color: '#ec4899', type: 'core' });

    books.forEach((book) => {
      const bookNodeId = `book_${book.id}`;
      nodes.push({
        id: bookNodeId,
        name: escapeMermaidLabel(book.title),
        val: 18,
        color: '#6366f1',
        type: 'book',
        bookId: book.id
      });
      links.push({ source: 'core', target: bookNodeId });
      nodeMeta[bookNodeId] = { type: 'book', bookId: book.id };

      const bookCards = flashcards[book.id] || [];
      const bookHL = highlights[book.id] || [];

      bookCards.forEach((c) => {
        const cId = `fc_${c.id}`;
        nodes.push({
          id: cId,
          name: escapeMermaidLabel(c.front),
          val: 6,
          color: '#eab308',
          type: 'flashcard'
        });
        links.push({ source: bookNodeId, target: cId });
      });

      bookHL.forEach((h) => {
        const hId = `hl_${h.id}`;
        nodes.push({
          id: hId,
          name: escapeMermaidLabel(h.text),
          val: 5,
          color: '#f43f5e',
          type: 'highlight'
        });
        links.push({ source: bookNodeId, target: hId });
      });
    });

    return { nodes, links, nodeMeta };
  }, [books, flashcards, highlights]);

  const handleNodeClick = (node) => {
    if (node.type === 'book') {
      const b = books.find(x => x.id === node.bookId);
      if (b) setCurrentBook(b, b.id);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0d14] relative">
      <div className="absolute top-6 left-6 z-10 p-4 rounded-xl bg-slate-900/60 backdrop-blur-md border border-white/10 shadow-2xl">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Network className="text-indigo-400" /> Глобальный Граф Знаний
        </h2>
        <p className="text-xs text-slate-400 mt-1 max-w-xs">
          Визуализация вашей базы знаний. Книги выступают центрами гравитации для ваших заметок и карточек.
        </p>
        
        <div className="mt-4 flex flex-col gap-2 text-xs text-slate-300">
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#ec4899] shadow-[0_0_10px_rgba(236,72,153,0.8)]"></span> Ваш мозг</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#6366f1] shadow-[0_0_10px_rgba(99,102,241,0.8)]"></span> Книги ({books.length})</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#eab308]"></span> Флешкарты</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#f43f5e]"></span> Заметки</div>
        </div>
      </div>

      <div className="flex-1 w-full h-full relative" ref={containerRef}>
        {graphData.nodes.length > 0 ? (
          <ForceGraph2D
            width={containerRef.current ? containerRef.current.clientWidth : 800}
            height={containerRef.current ? containerRef.current.clientHeight : 600}
            graphData={graphData}
            nodeAutoColorBy="group"
            nodeRelSize={6}
            nodeColor={node => node.color}
            nodeLabel="name"
            onNodeClick={handleNodeClick}
            linkColor={() => 'rgba(255,255,255,0.08)'}
            nodeCanvasObject={(node, ctx, globalScale) => {
              const isZettel = ['flashcard', 'highlight'].includes(node.type);
              
              ctx.beginPath();
              ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
              ctx.fillStyle = node.color;
              if (node.type !== 'core') {
                 ctx.shadowColor = node.color;
                 ctx.shadowBlur = 15;
              }
              ctx.fill();

              // Only draw labels if zoomed in enough OR if it's a major node
              if (globalScale > 1.5 || node.type === 'book' || node.type === 'core') {
                const label = node.name;
                const fontSize = node.type === 'core' ? 16/globalScale : (node.type === 'book' ? 12/globalScale : 8/globalScale);
                ctx.font = `${fontSize}px Sans-Serif`;
                const textWidth = ctx.measureText(label).width;
                const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2);

                ctx.shadowBlur = 0;
                ctx.fillStyle = 'rgba(10, 13, 20, 0.8)';
                const labelY = node.y + node.val + fontSize;
                ctx.fillRect(node.x - bckgDimensions[0] / 2, labelY - bckgDimensions[1] / 2, ...bckgDimensions);

                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = isZettel ? node.color : '#ffffff';
                ctx.fillText(label, node.x, labelY);

                node.__bckgDimensions = bckgDimensions;
                node.__labelY = labelY;
              }
            }}
            nodePointerAreaPaint={(node, color, ctx) => {
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(node.x, node.y, node.val + 2, 0, 2 * Math.PI, false);
              ctx.fill();
            }}
          />
        ) : (
          <div className="spinner m-auto mt-[40vh]" />
        )}
      </div>
    </div>
  );
}
