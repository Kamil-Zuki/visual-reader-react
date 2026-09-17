import React, { useState, useEffect, useCallback } from 'react';

export default function PanelResizer({ 
  direction = 'left', // 'left' | 'right'
  onResize, 
  onDoubleClick, 
  minWidth = 200, 
  maxWidth = 600,
  defaultWidth = 300 
}) {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      let newWidth;
      if (direction === 'left') {
        newWidth = e.clientX;
      } else {
        newWidth = window.innerWidth - e.clientX;
      }

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        onResize(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, direction, minWidth, maxWidth, onResize]);

  return (
    <div
      onMouseDown={handleMouseDown}
      onDoubleClick={() => onDoubleClick && onDoubleClick(defaultWidth)}
      className="hidden md:flex relative items-center justify-center w-2 -mx-1 z-20 cursor-col-resize select-none group transition-colors"
      title="Потяните для изменения размера (двойной клик — сброс)"
    >
      {/* Visual divider line */}
      <div 
        className={`w-0.5 h-full transition-colors duration-150 ${
          isDragging 
            ? 'bg-primary shadow-[0_0_8px_rgba(99,102,241,0.8)] scale-x-150' 
            : 'bg-borderColor group-hover:bg-primary/70'
        }`} 
      />

      {/* Subtle grip handle pill that appears on hover/drag */}
      <div 
        className={`absolute w-1 h-8 rounded-full transition-opacity duration-150 ${
          isDragging ? 'bg-primary opacity-100' : 'bg-primaryGlow opacity-0 group-hover:opacity-80'
        }`} 
      />
    </div>
  );
}
