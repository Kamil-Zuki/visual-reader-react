import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Maximize2 } from 'lucide-react';

export default function ImageZoomModal({ isOpen, onClose, src, alt }) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, src]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === '+' || e.key === '=') handleZoom(0.25);
      if (e.key === '-') handleZoom(-0.25);
      if (e.key === '0') handleReset();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, scale]);

  if (!isOpen || !src) return null;

  const handleZoom = (delta) => {
    setScale((prev) => Math.min(Math.max(0.5, +(prev + delta).toFixed(2)), 4.0));
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    handleZoom(delta);
  };

  const handleMouseDown = (e) => {
    if (scale <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-md animate-fade-in select-none"
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/40 border-b border-white/10 shrink-0 z-10">
        <div className="text-xs text-textDim truncate max-w-md font-medium">
          {alt || 'Просмотр изображения'}
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => handleZoom(-0.25)}
              className="p-1.5 rounded hover:bg-white/10 text-textMuted hover:text-white transition-colors"
              title="Уменьшить (-)"
            >
              <ZoomOut size={16} />
            </button>
            <span className="text-xs font-mono font-semibold px-2 text-white min-w-[50px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => handleZoom(0.25)}
              className="p-1.5 rounded hover:bg-white/10 text-textMuted hover:text-white transition-colors"
              title="Увеличить (+)"
            >
              <ZoomIn size={16} />
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 rounded hover:bg-white/10 text-textMuted hover:text-white transition-colors border-l border-white/10 ml-0.5"
              title="Сбросить масштаб (0)"
            >
              <RotateCcw size={15} />
            </button>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-textMuted hover:text-white transition-colors ml-2"
            title="Закрыть (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Image Stage */}
      <div
        className={`flex-1 relative flex items-center justify-center overflow-hidden p-4 ${
          scale > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
        }`}
        onMouseDown={handleMouseDown}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <img
          src={src}
          alt={alt || ''}
          draggable={false}
          className="max-h-[90vh] max-w-[90vw] object-contain transition-transform duration-100 ease-out rounded-lg shadow-2xl"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          }}
        />
      </div>

      <div className="text-center pb-3 text-[11px] text-textDim shrink-0">
        Колесо мыши для масштабирования • Перетаскивание для панорамирования • Esc для закрытия
      </div>
    </div>
  );
}
