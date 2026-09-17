import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { getAllBooksFromDB, saveBookToDB, deleteBookFromDB } from '../utils/db';
import { parseHtmlBook } from '../utils/parser';
import { parsePdfBook } from '../utils/pdfParser';
import { X, Library, UploadCloud, Trash2, CheckCircle, BookOpen, Loader2, FileType } from 'lucide-react';

export default function LibraryModal() {
  const { isLibraryOpen, setLibraryOpen, currentBookId, setCurrentBook, setActiveChapter } = useStore();
  
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(null); // { current, total, percentage }
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isLibraryOpen) {
      loadLibraryBooks();
    }
  }, [isLibraryOpen]);

  const loadLibraryBooks = async () => {
    setLoading(true);
    try {
      const allBooks = await getAllBooksFromDB();
      setBooks(allBooks);
    } catch (err) {
      console.error('Failed to load books from DB:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBook = (book) => {
    setCurrentBook(book, book.id);
    setActiveChapter(0, 0);
    setLibraryOpen(false);
  };

  const handleDeleteBook = async (e, bookId) => {
    e.stopPropagation();
    if (window.confirm('Удалить эту книгу из библиотеки?')) {
      await deleteBookFromDB(bookId);
      if (currentBookId === bookId) {
        const remaining = books.filter(b => b.id !== bookId);
        if (remaining.length > 0) {
          handleSelectBook(remaining[0]);
        }
      }
      loadLibraryBooks();
    }
  };

  const processFile = async (file) => {
    if (!file) return;
    setParsing(true);
    setPdfProgress(null);

    try {
      let parsedBook = null;
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith('.pdf')) {
        // PDF parsing
        parsedBook = await parsePdfBook(file, (progress) => {
          setPdfProgress(progress);
        });
      } else {
        // HTML / MD / TXT parsing
        const text = await file.text();
        parsedBook = parseHtmlBook(text, file.name);
      }

      await saveBookToDB(parsedBook);
      await loadLibraryBooks();
      handleSelectBook(parsedBook);
    } catch (err) {
      console.error('Error parsing book file:', err);
      alert('Ошибка при чтении или парсинге книги: ' + err.message);
    } finally {
      setParsing(false);
      setPdfProgress(null);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  if (!isLibraryOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-bgSidebar border border-borderColor rounded-2xl w-full max-w-xl shadow-2xl p-6 relative flex flex-col gap-5 max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-borderColor pb-3">
          <div className="flex items-center gap-2 text-lg font-semibold text-white">
            <Library className="text-primary" size={20} />
            Моя Библиотека книг
          </div>
          <button 
            onClick={() => setLibraryOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-textMuted hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Upload Dropzone */}
        <div 
          onClick={() => !parsing && fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); if (!parsing) setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
            dragOver ? 'border-primary bg-primary/10' : 'border-borderColor hover:border-primary/50 hover:bg-white/5'
          }`}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".html,.htm,.txt,.md,.pdf" 
            className="hidden" 
          />
          {parsing ? (
            <div className="flex flex-col items-center gap-3 text-primaryGlow py-2 w-full max-w-xs">
              <Loader2 className="animate-spin" size={32} />
              <div className="text-center">
                <span className="text-sm font-semibold text-white block">
                  {pdfProgress ? `Парсинг PDF: страница ${pdfProgress.current} из ${pdfProgress.total}` : 'Чтение книги и построение глав...'}
                </span>
                {pdfProgress && (
                  <span className="text-xs text-textMuted">
                    Извлекаем оглавление и текст ({pdfProgress.percentage}%)
                  </span>
                )}
              </div>
              
              {pdfProgress && (
                <div className="w-full bg-black/50 rounded-full h-2 overflow-hidden border border-white/10">
                  <div 
                    className="bg-gradient-to-r from-primary to-accentCyan h-full transition-all duration-150"
                    style={{ width: `${pdfProgress.percentage}%` }}
                  />
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-1">
                <UploadCloud size={24} />
              </div>
              <div className="text-sm font-semibold text-white">
                Нажмите или перетащите сюда файл книги
              </div>
              <div className="text-xs text-textDim max-w-md leading-relaxed">
                Поддерживаются <span className="text-white font-medium">PDF</span>, <span className="text-white font-medium">HTML</span>, <span className="text-white font-medium">Markdown</span>, TXT.
                <br />
                Для PDF автоматически считываются встроенные закладки оглавления!
              </div>
            </>
          )}
        </div>

        {/* Book List */}
        <div className="flex flex-col gap-2 overflow-hidden flex-1">
          <span className="text-xs font-semibold text-textMuted uppercase tracking-wider">Доступные книги:</span>
          
          <div className="overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-1 max-h-60">
            {loading ? (
              <div className="text-center py-6 text-textMuted text-sm">Загрузка библиотеки...</div>
            ) : books.length === 0 ? (
              <div className="text-center py-6 text-textDim text-sm">В библиотеке пока нет книг</div>
            ) : (
              books.map((b) => {
                const isSelected = b.id === currentBookId;
                const totalChapters = (b.chapters || b.structure || []).length;
                const isPdf = b.format === 'pdf';
                return (
                  <div
                    key={b.id}
                    onClick={() => handleSelectBook(b)}
                    className={`flex items-center justify-between p-3.5 rounded-lg border cursor-pointer transition-all ${
                      isSelected 
                        ? 'border-primary bg-primary/10 text-white shadow-md shadow-primary/5' 
                        : 'border-borderColor hover:border-white/20 hover:bg-white/5 text-textMain'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <BookOpen size={18} className={isSelected ? 'text-primaryGlow' : 'text-textMuted'} />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{b.title}</span>
                          {isPdf && (
                            <span className="text-[10px] font-semibold bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                              PDF
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-textDim">
                          {b.author ? `${b.author} • ` : ''}{totalChapters} глав
                          {b.totalPages ? ` • ${b.totalPages} стр.` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isSelected ? (
                        <span className="flex items-center gap-1 text-xs text-primaryGlow font-medium bg-primary/20 px-2 py-1 rounded">
                          <CheckCircle size={13} /> Читается
                        </span>
                      ) : (
                        <button
                          onClick={(e) => handleDeleteBook(e, b.id)}
                          title="Удалить книгу"
                          className="p-1.5 rounded-md hover:bg-red-500/20 text-textDim hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end pt-3 border-t border-borderColor">
          <button 
            onClick={() => setLibraryOpen(false)}
            className="px-5 py-2 rounded-lg text-xs font-medium text-textMuted hover:text-white hover:bg-white/5 transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
