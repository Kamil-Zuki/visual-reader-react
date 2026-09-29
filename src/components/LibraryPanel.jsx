import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { getAllBooksFromDB, saveBookToDB, deleteBookFromDB } from '../utils/db';
import { parseHtmlBook } from '../utils/parser';
import { parsePdfBook } from '../utils/pdfParser';
import { importEpubFile, deleteEpubFile, prepareEpubBookForReading } from '../utils/epubImport';
import { calcBookProgressPercent, countBookSections } from '../utils/bookProgress';
import { clearEpubSearchCache } from '../utils/epubSearchIndex';
import { invalidateSearchCache } from '../utils/searchIndex';
import { Library, UploadCloud, Trash2, CheckCircle, BookOpen, Loader2 } from 'lucide-react';

/**
 * @param {'embedded' | 'compact'} layout — полноэкранная библиотека или блок в модалке
 * @param {boolean} showClose
 * @param {() => void} [onClose]
 */
export default function LibraryPanel({ layout = 'compact', showClose = false, onClose }) {
  const {
    currentBookId,
    setCurrentBook,
    setActiveChapter,
    readSections,
    purgeBookUserData,
    setLibraryOpen,
  } = useStore();

  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(null);
  const [epubImportStage, setEpubImportStage] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const epubStageLabels = {
    read: 'Чтение файла…',
    id: 'Идентификатор книги…',
    save: 'Сохранение в библиотеку…',
    parse: 'Разбор EPUB и оглавления…',
    done: 'Готово',
  };
  const fileInputRef = useRef(null);

  const listMaxClass = layout === 'embedded' ? 'max-h-[min(50vh,420px)]' : 'max-h-60';

  useEffect(() => {
    loadLibraryBooks();
  }, []);

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

  const handleSelectBook = async (book) => {
    const { epubLocations, requestEpubResume, clearEpubResume } = useStore.getState();
    const resolved =
      book.format === 'epub' ? await prepareEpubBookForReading(book, saveBookToDB) : book;
    if (resolved.format === 'epub' && epubLocations[resolved.id]) {
      requestEpubResume(resolved.id);
    } else {
      clearEpubResume();
    }
    setCurrentBook(resolved, resolved.id);
    setActiveChapter(0, 0);
    setLibraryOpen(false);
    onClose?.();
    if (book.format === 'epub') loadLibraryBooks();
  };

  const handleDeleteBook = async (e, bookId) => {
    e.stopPropagation();
    if (!window.confirm('Удалить эту книгу из библиотеки?')) return;

    const book = books.find((b) => b.id === bookId);
    if (book?.format === 'epub') await deleteEpubFile(bookId);
    await deleteBookFromDB(bookId);
    purgeBookUserData(bookId);

    const remaining = books.filter((b) => b.id !== bookId);
    if (currentBookId === bookId) {
      if (remaining.length > 0) {
        handleSelectBook(remaining[0]);
      } else {
        setCurrentBook(null, '');
        setLibraryOpen(false);
      }
    }
    loadLibraryBooks();
  };

  const processFile = async (file) => {
    if (!file) return;
    setParsing(true);
    setPdfProgress(null);
    setEpubImportStage('');

    try {
      let parsedBook = null;
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith('.epub')) {
        parsedBook = await importEpubFile(file, (stage) => setEpubImportStage(stage));
        clearEpubSearchCache(parsedBook.id);
        invalidateSearchCache(parsedBook.id);
      } else if (fileName.endsWith('.pdf')) {
        parsedBook = await parsePdfBook(file, (progress) => {
          setPdfProgress(progress);
        });
      } else {
        const text = await file.text();
        parsedBook = parseHtmlBook(text, file.name);
      }

      await saveBookToDB(parsedBook);
      await loadLibraryBooks();
      handleSelectBook(parsedBook);
    } catch (err) {
      console.error('Error parsing book file:', err);
      const detail =
        err?.message ||
        (typeof err === 'string' ? err : null) ||
        (() => {
          try {
            return JSON.stringify(err);
          } catch {
            return String(err);
          }
        })();
      alert('Ошибка при чтении или парсинге книги: ' + detail);
    } finally {
      setParsing(false);
      setPdfProgress(null);
      setEpubImportStage('');
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

  return (
    <div
      className={`flex flex-col gap-5 w-full ${
        layout === 'embedded' ? 'max-w-2xl mx-auto' : ''
      }`}
    >
      <div className={`flex items-center justify-between ${layout === 'compact' ? 'border-b border-borderColor pb-3' : ''}`}>
        <div className="flex items-center gap-2 text-lg font-semibold text-white">
          <Library className="text-primary" size={20} />
          {layout === 'embedded' ? 'Visual Reader — библиотека' : 'Моя библиотека книг'}
        </div>
        {showClose && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-textMuted hover:text-white hover:bg-white/5 transition-colors"
          >
            Закрыть
          </button>
        )}
      </div>

      {layout === 'embedded' && (
        <p className="text-sm text-textDim -mt-2">
          Импортируйте EPUB — оглавление и вёрстка из файла. Прогресс и заметки хранятся локально и синхронизируются через Supabase.
        </p>
      )}

      <div
        onClick={() => !parsing && fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!parsing) setDragOver(true);
        }}
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
          accept=".epub,.html,.htm,.txt,.md,.pdf"
          className="hidden"
        />
        {parsing ? (
          <div className="flex flex-col items-center gap-3 text-primaryGlow py-2 w-full max-w-xs">
            <Loader2 className="animate-spin" size={32} />
            <div className="text-center">
                <span className="text-sm font-semibold text-white block">
                  {pdfProgress
                    ? `Парсинг PDF: страница ${pdfProgress.current} из ${pdfProgress.total}`
                    : epubImportStage
                      ? epubStageLabels[epubImportStage] || 'Импорт EPUB…'
                      : 'Чтение книги и построение глав...'}
                </span>
                {epubImportStage === 'parse' && (
                  <span className="text-xs text-textMuted block mt-1">
                    Обычно 5–30 сек для файла ~5 MB. Если дольше 2 мин — перезапустите приложение (нужна сборка 0.3.0+).
                  </span>
                )}
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
            <div className="text-sm font-semibold text-white">Нажмите или перетащите файл книги</div>
            <div className="text-xs text-textDim max-w-md leading-relaxed">
              Рекомендуется <span className="text-white font-medium">EPUB</span>. Также: PDF, HTML, Markdown, TXT.
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2 overflow-hidden flex-1">
        <span className="text-xs font-semibold text-textMuted uppercase tracking-wider">Доступные книги</span>
        <div className={`overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-1 ${listMaxClass}`}>
          {loading ? (
            <div className="text-center py-6 text-textMuted text-sm">Загрузка библиотеки...</div>
          ) : books.length === 0 ? (
            <div className="text-center py-8 text-textDim text-sm border border-dashed border-borderColor rounded-xl">
              Пока пусто — добавьте первый EPUB
            </div>
          ) : (
            books.map((b) => {
              const isSelected = b.id === currentBookId;
              const totalChapters = (b.chapters || b.structure || []).length;
              const sectionCount = countBookSections(b);
              const progressPct = calcBookProgressPercent(b, readSections, b.id);
              const isPdf = b.format === 'pdf';
              const isEpub = b.format === 'epub';
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
                        {isEpub && (
                          <span className="text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            EPUB
                          </span>
                        )}
                        {isPdf && (
                          <span className="text-[10px] font-semibold bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            PDF
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-textDim">
                        {b.author ? `${b.author} • ` : ''}
                        {sectionCount || totalChapters} разд.
                        {b.totalPages ? ` • ${b.totalPages} стр.` : ''}
                        {progressPct > 0 ? ` • ${progressPct}%` : ''}
                      </span>
                      {progressPct > 0 && (
                        <div className="mt-1.5 h-1 w-full max-w-[140px] bg-black/40 rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${progressPct}%` }} />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isSelected ? (
                      <span className="flex items-center gap-1 text-xs text-primaryGlow font-medium bg-primary/20 px-2 py-1 rounded">
                        <CheckCircle size={13} /> Читается
                      </span>
                    ) : (
                      <button
                        type="button"
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
    </div>
  );
}
