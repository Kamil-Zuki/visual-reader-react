import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

export default function DiagramModal({ isOpen, onClose, svgContent, title }) {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (isOpen) {
      setZoom(1);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleZoom = (delta) => {
    setZoom(prev => Math.min(Math.max(0.4, prev + delta), 3.0));
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="bg-bgSidebar border border-borderColor rounded-2xl w-full max-w-6xl h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-borderColor bg-bgSidebar shrink-0">
          <span className="font-medium text-white text-base truncate max-w-md">
            {title || 'Диаграмма архитектуры'}
          </span>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => handleZoom(-0.2)}
              title="Уменьшить"
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-textMuted hover:text-white border border-borderColor transition-colors"
            >
              <ZoomOut size={16} />
            </button>
            <button 
              onClick={() => setZoom(1)}
              title="Сбросить масштаб"
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono text-textMuted hover:text-white border border-borderColor transition-colors"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button 
              onClick={() => handleZoom(0.2)}
              title="Увеличить"
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-textMuted hover:text-white border border-borderColor transition-colors"
            >
              <ZoomIn size={16} />
            </button>
            <div className="w-[1px] h-6 bg-borderColor mx-2"></div>
            <button 
              onClick={onClose}
              className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-textMuted hover:text-red-400 border border-borderColor transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Canvas Body */}
        <div className="flex-1 overflow-auto p-8 flex items-center justify-center bg-[#07090e] select-none">
          <div 
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.15s ease-out' }}
            className="flex items-center justify-center min-w-full min-h-full"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        </div>
      </div>
    </div>
  );
}
