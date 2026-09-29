import React from 'react';
import { useStore } from '../store/useStore';
import { X } from 'lucide-react';
import LibraryPanel from './LibraryPanel';

export default function LibraryModal() {
  const { isLibraryOpen, setLibraryOpen } = useStore();

  if (!isLibraryOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-bgSidebar border border-borderColor rounded-2xl w-full max-w-xl shadow-2xl p-6 relative flex flex-col gap-5 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <button
          type="button"
          onClick={() => setLibraryOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/10 text-textMuted hover:text-white transition-colors z-10"
          aria-label="Закрыть"
        >
          <X size={18} />
        </button>
        <LibraryPanel layout="compact" showClose onClose={() => setLibraryOpen(false)} />
      </div>
    </div>
  );
}
