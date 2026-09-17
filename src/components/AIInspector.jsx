import React, { useEffect, useState } from 'react';
import { Lightbulb, Network, Maximize2 } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function AIInspector() {
  const { apiKey, isAiLoading, aiResult } = useStore();
  const [selectedText, setSelectedText] = useState('');

  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      const text = selection.toString().trim();
      if (text.length > 10) {
        setSelectedText(text);
      } else {
        setSelectedText('');
      }
    };
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  return (
    <aside className="w-[450px] bg-bgSidebar border-l border-borderColor flex flex-col shrink-0">
      <div className="h-12 border-b border-borderColor flex items-center px-4 font-semibold text-sm gap-2">
        <Network size={16} className="text-primary" />
        Визуальный инспектор
      </div>

      <div className="flex-1 p-6 overflow-y-auto relative custom-scrollbar flex flex-col">
        {!selectedText && !aiResult && !isAiLoading && (
          <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40 mt-10">
            <Lightbulb size={48} className="mb-4 text-primary" />
            <h3 className="font-semibold text-lg mb-2">Визуализация и Пояснения</h3>
            <p className="text-sm max-w-[250px]">
              Выделите фрагмент текста в книге и выберите действие: диаграмма, аналогия или резюме.
            </p>
          </div>
        )}

        {selectedText && (
          <div className="mb-6 p-4 rounded-lg bg-bgCard border border-primary/20 shadow-lg shadow-primary/5">
            <h4 className="text-xs font-semibold text-primary mb-2 uppercase tracking-wider">Выделенный текст:</h4>
            <div className="text-sm italic text-textMuted border-l-2 border-primary/40 pl-3 py-1 my-2 max-h-32 overflow-y-auto custom-scrollbar">
              {selectedText}
            </div>
            
            <div className="flex flex-col gap-2 mt-4">
              <button className="w-full py-2 px-4 rounded-md bg-primary hover:bg-primaryGlow text-white text-sm font-medium transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                <Network size={16} /> Построить Архитектуру (Диаграмма)
              </button>
              <button className="w-full py-2 px-4 rounded-md bg-white/5 hover:bg-white/10 text-textMain border border-borderColor text-sm font-medium transition-colors flex items-center justify-center gap-2">
                <Lightbulb size={16} className="text-yellow-500" /> Объяснить простой аналогией
              </button>
            </div>
          </div>
        )}

        {isAiLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="spinner mb-4"></div>
            <div className="text-sm text-textMuted animate-pulse">ИИ анализирует текст...</div>
          </div>
        )}
      </div>
    </aside>
  );
}
