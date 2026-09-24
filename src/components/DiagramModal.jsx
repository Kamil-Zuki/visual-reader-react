import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Maximize2, Download } from 'lucide-react';

export default function DiagramModal({ isOpen, onClose, svgContent, title }) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const touchPinchRef = useRef(null);

  // Parse SVG dimensions and remove restrictive inline max-width
  const parsedSvg = useMemo(() => {
    if (!svgContent) return { html: '', width: 800, height: 600 };

    let width = 800;
    let height = 600;

    // Extract viewBox="minX minY width height"
    const viewBoxMatch = svgContent.match(/viewBox=["']\s*([0-9.-]+)[\s,]+([0-9.-]+)[\s,]+([0-9.-]+)[\s,]+([0-9.-]+)\s*["']/i);
    if (viewBoxMatch) {
      const vbW = parseFloat(viewBoxMatch[3]);
      const vbH = parseFloat(viewBoxMatch[4]);
      if (vbW > 0 && vbH > 0) {
        width = vbW;
        height = vbH;
      }
    } else {
      const wMatch = svgContent.match(/width=["']([0-9.-]+)(px)?["']/i);
      const hMatch = svgContent.match(/height=["']([0-9.-]+)(px)?["']/i);
      if (wMatch && parseFloat(wMatch[1]) > 0) width = parseFloat(wMatch[1]);
      if (hMatch && parseFloat(hMatch[1]) > 0) height = parseFloat(hMatch[1]);
    }

    // Clean inline max-width and ensure full dimensions
    const cleanSvg = svgContent
      .replace(/max-width:\s*[^;"']+;?/gi, 'max-width: none;')
      .replace(/height=["']100%["']/gi, `height="${height}"`)
      .replace(/width=["']100%["']/gi, `width="${width}"`);

    return { html: cleanSvg, width, height };
  }, [svgContent]);

  // Fit to screen
  const fitToView = () => {
    if (!containerRef.current || !parsedSvg.width || !parsedSvg.height) return;
    const containerW = containerRef.current.clientWidth;
    const containerH = containerRef.current.clientHeight;
    if (containerW === 0 || containerH === 0) return;

    const padding = 48;
    const availW = Math.max(100, containerW - padding * 2);
    const availH = Math.max(100, containerH - padding * 2);

    const fitScale = Math.min(availW / parsedSvg.width, availH / parsedSvg.height, 1.2);
    const posX = (containerW - parsedSvg.width * fitScale) / 2;
    const posY = (containerH - parsedSvg.height * fitScale) / 2;

    setScale(fitScale);
    setPosition({ x: posX, y: posY });
  };

  // Reset to 1:1 (100%)
  const handleReset100 = () => {
    if (!containerRef.current || !parsedSvg.width || !parsedSvg.height) return;
    const containerW = containerRef.current.clientWidth;
    const containerH = containerRef.current.clientHeight;
    const newScale = 1.0;
    const posX = (containerW - parsedSvg.width * newScale) / 2;
    const posY = (containerH - parsedSvg.height * newScale) / 2;
    setScale(newScale);
    setPosition({ x: posX, y: posY });
  };

  // Button Zoom (+ or -)
  const handleZoomBtn = (delta) => {
    if (!containerRef.current) return;
    const containerW = containerRef.current.clientWidth;
    const containerH = containerRef.current.clientHeight;
    const centerX = containerW / 2;
    const centerY = containerH / 2;

    const newScale = Math.min(Math.max(0.15, scale + delta), 5.0);
    if (newScale === scale) return;

    const canvasX = (centerX - position.x) / scale;
    const canvasY = (centerY - position.y) / scale;

    setPosition({
      x: centerX - canvasX * newScale,
      y: centerY - canvasY * newScale
    });
    setScale(newScale);
  };

  // Download SVG
  const handleDownloadSvg = () => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = (title || 'diagram').slice(0, 35).replace(/[^a-zA-Z0-9а-яА-Я_-]/g, '_');
    a.download = `${safeTitle}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Auto-fit on open
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        fitToView();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, parsedSvg]);

  // Window resize listener
  useEffect(() => {
    if (!isOpen) return;
    const handleResize = () => {
      fitToView();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, parsedSvg]);

  // Keyboard controls
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomBtn(0.2);
      } else if (e.key === '-' || e.key === '_') {
        handleZoomBtn(-0.2);
      } else if (e.key === '0') {
        fitToView();
      } else if (e.key === '1') {
        handleReset100();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, scale, position, parsedSvg]);

  // Non-passive wheel zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isOpen) return;

    const onWheel = (e) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;

      setScale(prevScale => {
        const newScale = Math.min(Math.max(0.15, prevScale * zoomFactor), 5.0);
        if (newScale === prevScale) return prevScale;

        setPosition(prevPos => {
          const canvasX = (mouseX - prevPos.x) / prevScale;
          const canvasY = (mouseY - prevPos.y) / prevScale;
          return {
            x: mouseX - canvasX * newScale,
            y: mouseY - canvasY * newScale
          };
        });

        return newScale;
      });
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', onWheel);
    };
  }, [isOpen]);

  // Mouse drag handlers
  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Only left click
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      const touch = e.touches[0];
      dragStartRef.current = {
        x: touch.clientX - position.x,
        y: touch.clientY - position.y
      };
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchPinchRef.current = {
        dist,
        scale,
        center: {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2
        }
      };
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 1 && isDragging) {
      const touch = e.touches[0];
      setPosition({
        x: touch.clientX - dragStartRef.current.x,
        y: touch.clientY - dragStartRef.current.y
      });
    } else if (e.touches.length === 2 && touchPinchRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / touchPinchRef.current.dist;
      const newScale = Math.min(Math.max(0.15, touchPinchRef.current.scale * factor), 5.0);
      setScale(newScale);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    touchPinchRef.current = null;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-bgSidebar border border-borderColor rounded-2xl w-full max-w-6xl h-[92vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-borderColor bg-bgSidebar shrink-0">
          <div className="flex items-center gap-2 overflow-hidden mr-3">
            <span className="font-semibold text-white text-sm sm:text-base truncate">
              {title || 'Диаграмма архитектуры'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Zoom Out */}
            <button 
              onClick={() => handleZoomBtn(-0.2)}
              title="Уменьшить (-)"
              className="p-1.5 sm:p-2 rounded-lg bg-white/5 hover:bg-white/10 text-textMuted hover:text-white border border-borderColor transition-colors cursor-pointer"
            >
              <ZoomOut size={16} />
            </button>

            {/* Current Scale Display / Click to reset 100% */}
            <button 
              onClick={handleReset100}
              title="Масштаб 1:1 (Кликните для 100%)"
              className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono text-textMuted hover:text-white border border-borderColor transition-colors cursor-pointer min-w-[54px] text-center"
            >
              {Math.round(scale * 100)}%
            </button>

            {/* Zoom In */}
            <button 
              onClick={() => handleZoomBtn(0.2)}
              title="Увеличить (+)"
              className="p-1.5 sm:p-2 rounded-lg bg-white/5 hover:bg-white/10 text-textMuted hover:text-white border border-borderColor transition-colors cursor-pointer"
            >
              <ZoomIn size={16} />
            </button>

            {/* Fit to View */}
            <button 
              onClick={fitToView}
              title="Вписать в экран (0)"
              className="p-1.5 sm:p-2 rounded-lg bg-white/5 hover:bg-primary/20 text-textMuted hover:text-primaryGlow border border-borderColor transition-colors cursor-pointer flex items-center gap-1.5 text-xs"
            >
              <Maximize2 size={15} />
              <span className="hidden md:inline">Вписать</span>
            </button>

            <div className="w-[1px] h-5 bg-borderColor mx-1"></div>

            {/* Download SVG */}
            <button 
              onClick={handleDownloadSvg}
              title="Скачать диаграмму (SVG)"
              className="p-1.5 sm:p-2 rounded-lg bg-white/5 hover:bg-accentCyan/20 text-textMuted hover:text-accentCyan border border-borderColor transition-colors cursor-pointer"
            >
              <Download size={16} />
            </button>

            {/* Close */}
            <button 
              onClick={onClose}
              title="Закрыть (Esc)"
              className="p-1.5 sm:p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-textMuted hover:text-red-400 border border-borderColor transition-colors cursor-pointer ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Canvas Body with Interactive Pan & Zoom */}
        <div 
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onDoubleClick={(e) => {
            if (Math.abs(scale - 1) < 0.1) {
              fitToView();
            } else {
              handleReset100();
            }
          }}
          className={`flex-1 relative overflow-hidden select-none ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          style={{
            backgroundColor: '#07090e',
            backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }}
        >
          {/* Transformed SVG Canvas */}
          <div 
            style={{
              width: `${parsedSvg.width}px`,
              height: `${parsedSvg.height}px`,
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: '0 0',
              transition: isDragging ? 'none' : 'transform 0.12s ease-out',
              willChange: 'transform'
            }}
            className="absolute top-0 left-0 [&_svg]:w-full [&_svg]:h-full [&_svg]:max-w-none pointer-events-none"
            dangerouslySetInnerHTML={{ __html: parsedSvg.html }}
          />

          {/* Canvas Bottom Hint */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none z-10 px-3.5 py-1.5 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-[11px] text-textDim flex items-center gap-3 shadow-xl">
            <span>🖐️ Зажмите и тяните</span>
            <span className="w-1 h-1 rounded-full bg-white/20"></span>
            <span>🔍 Колёсико мыши: зум</span>
            <span className="w-1 h-1 rounded-full bg-white/20"></span>
            <span>2× клик: сброс</span>
          </div>
        </div>
      </div>
    </div>
  );
}
