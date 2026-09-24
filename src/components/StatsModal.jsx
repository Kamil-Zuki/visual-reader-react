import React, { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { X, BarChart2, BookOpen, Flame, Layers, BookMarked, Network } from 'lucide-react';

const WEEK_COUNT = 16;
const DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

function getIntensity(count) {
  if (!count) return 0;
  if (count <= 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

const INTENSITY_BG = [
  'bg-white/[0.04]',
  'bg-indigo-500/30',
  'bg-indigo-500/55',
  'bg-indigo-500/80',
  'bg-indigo-400'
];

function buildCalendarGrid(readingLog) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const startDay = new Date(today);
  startDay.setDate(today.getDate() - today.getDay() - (WEEK_COUNT - 1) * 7);
  startDay.setHours(0, 0, 0, 0);

  const cells = [];
  const monthLabels = [];
  let currentMonth = -1;

  for (let w = 0; w < WEEK_COUNT; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(startDay);
      date.setDate(startDay.getDate() + w * 7 + d);
      const dateKey = date.toISOString().slice(0, 10);
      const count = readingLog[dateKey] || 0;
      const isFuture = date > today;
      if (d === 0 && date.getMonth() !== currentMonth) {
        currentMonth = date.getMonth();
        monthLabels.push({ week: w, label: MONTHS[currentMonth] });
      }
      week.push({ dateKey, count, intensity: isFuture ? -1 : getIntensity(count) });
    }
    cells.push(week);
  }
  return { cells, monthLabels };
}

function calcStreak(readingLog) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const yesterdayKey = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let startDate = readingLog[todayKey] ? new Date() : readingLog[yesterdayKey] ? new Date(Date.now() - 86400000) : null;
  if (!startDate) return 0;
  let streak = 0;
  let date = startDate;
  while (true) {
    const key = date.toISOString().slice(0, 10);
    if (!readingLog[key]) break;
    streak++;
    date = new Date(date.getTime() - 86400000);
  }
  return streak;
}

export default function StatsModal() {
  const {
    isStatsOpen, setStatsOpen,
    readingLog,
    readSections,
    highlights,
    savedCards,
    flashcards,
    glossary,
    currentBookId,
    currentBook
  } = useStore();

  const log = readingLog || {};
  const { cells, monthLabels } = useMemo(() => buildCalendarGrid(log), [log]);
  const streak = useMemo(() => calcStreak(log), [log]);

  const totalRead = Object.values(readSections || {}).reduce((a, l) => a + (l?.length || 0), 0);
  const bookRead = (readSections[currentBookId] || []).length;
  const totalSections = useMemo(() => {
    const chapters = currentBook?.chapters || currentBook?.structure || [];
    return chapters.reduce((a, ch) => a + (ch.sections?.length || 0), 0);
  }, [currentBook]);

  const todayKey = new Date().toISOString().slice(0, 10);
  const readToday = log[todayKey] || 0;
  const activeDays = Object.values(log).filter(v => v > 0).length;
  const totalHighlights = Object.values(highlights || {}).reduce((a, l) => a + (l?.length || 0), 0);
  const totalAiCards = (savedCards || []).length;
  const totalFlashcards = Object.values(flashcards || {}).reduce((a, l) => a + (l?.length || 0), 0);
  const totalGlossary = Object.values(glossary || {}).reduce((a, l) => a + (l?.length || 0), 0);
  const progressPct = totalSections > 0 ? Math.round((bookRead / totalSections) * 100) : 0;

  if (!isStatsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-bgSidebar border border-borderColor rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-borderColor px-5 py-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-700 flex items-center justify-center text-white shadow-md">
              <BarChart2 size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Статистика чтения</h2>
              <p className="text-xs text-textMuted">Ваш прогресс и активность</p>
            </div>
          </div>
          <button onClick={() => setStatsOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-textMuted hover:text-white transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-5">

          {/* Key metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/30 flex flex-col items-center gap-1 text-center">
              <Flame size={20} className="text-orange-400" />
              <div className="text-2xl font-bold text-white">{streak}</div>
              <div className="text-[11px] text-textMuted">дней подряд 🔥</div>
            </div>
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/30 flex flex-col items-center gap-1 text-center">
              <BookOpen size={20} className="text-primaryGlow" />
              <div className="text-2xl font-bold text-white">{readToday}</div>
              <div className="text-[11px] text-textMuted">разделов сегодня</div>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col items-center gap-1 text-center">
              <BarChart2 size={20} className="text-accentCyan" />
              <div className="text-2xl font-bold text-white">{activeDays}</div>
              <div className="text-[11px] text-textMuted">активных дней</div>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col items-center gap-1 text-center">
              <BookOpen size={20} className="text-accentEmerald" />
              <div className="text-2xl font-bold text-white">{totalRead}</div>
              <div className="text-[11px] text-textMuted">разделов всего</div>
            </div>
          </div>

          {/* Book progress */}
          {totalSections > 0 && (
            <div className="p-4 rounded-xl bg-white/[0.03] border border-borderColor flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <BookOpen size={13} className="text-primary" />
                  Прогресс по книге
                </span>
                <span className="text-xs font-bold text-primaryGlow">{progressPct}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-indigo-400 transition-all duration-500" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="text-[11px] text-textMuted text-right">
                {bookRead} из {totalSections} разделов · {currentBook?.title || 'Текущая книга'}
              </div>
            </div>
          )}

          {/* Heatmap */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-borderColor flex flex-col gap-3">
            <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
              <BarChart2 size={13} className="text-primary" />
              Активность за {WEEK_COUNT} недель
            </h3>
            <div className="overflow-x-auto custom-scrollbar pb-1">
              <div style={{ minWidth: `${WEEK_COUNT * 18 + 32}px` }}>
                {/* Month labels */}
                <div className="relative h-4 ml-8 mb-1">
                  {monthLabels.map((ml, i) => (
                    <span
                      key={i}
                      className="absolute text-[10px] text-textMuted"
                      style={{ left: `${ml.week * 18}px` }}
                    >
                      {ml.label}
                    </span>
                  ))}
                </div>
                {/* Grid */}
                <div className="flex gap-[3px]">
                  {/* Day labels */}
                  <div className="flex flex-col gap-[3px] mr-1 shrink-0">
                    {DAYS.map((d, i) => (
                      <div key={d} className="h-[15px] text-[9px] text-textMuted flex items-center justify-end w-6 pr-1" style={{ opacity: i % 2 !== 0 ? 1 : 0 }}>
                        {d}
                      </div>
                    ))}
                  </div>
                  {/* Weeks */}
                  {cells.map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-[3px]">
                      {week.map((cell, di) => (
                        <div
                          key={di}
                          title={cell.intensity >= 0 ? `${cell.dateKey}: ${cell.count} раздел${cell.count === 1 ? '' : cell.count < 5 ? 'а' : 'ов'}` : ''}
                          className={`w-[15px] h-[15px] rounded-sm cursor-default transition-all ${
                            cell.intensity < 0
                              ? 'opacity-15 bg-white/5'
                              : INTENSITY_BG[cell.intensity]
                          }`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                {/* Legend */}
                <div className="flex items-center gap-1.5 mt-2 ml-8">
                  <span className="text-[10px] text-textMuted">Меньше</span>
                  {INTENSITY_BG.map((cls, i) => (
                    <div key={i} className={`w-[12px] h-[12px] rounded-sm ${cls}`} />
                  ))}
                  <span className="text-[10px] text-textMuted">Больше</span>
                </div>
              </div>
            </div>
          </div>

          {/* Learning materials */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-borderColor flex items-center gap-3">
              <span className="text-yellow-400 text-lg">🎨</span>
              <div>
                <div className="text-lg font-bold text-white">{totalHighlights}</div>
                <div className="text-[11px] text-textMuted">выделений</div>
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-borderColor flex items-center gap-3">
              <Network size={16} className="text-primaryGlow shrink-0" />
              <div>
                <div className="text-lg font-bold text-white">{totalAiCards}</div>
                <div className="text-[11px] text-textMuted">AI-карточек</div>
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-borderColor flex items-center gap-3">
              <Layers size={16} className="text-accentCyan shrink-0" />
              <div>
                <div className="text-lg font-bold text-white">{totalFlashcards}</div>
                <div className="text-[11px] text-textMuted">флешкарт</div>
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-borderColor flex items-center gap-3">
              <BookMarked size={16} className="text-accentEmerald shrink-0" />
              <div>
                <div className="text-lg font-bold text-white">{totalGlossary}</div>
                <div className="text-[11px] text-textMuted">терминов</div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-borderColor shrink-0 flex justify-end">
          <button onClick={() => setStatsOpen(false)} className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white transition-colors cursor-pointer">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
