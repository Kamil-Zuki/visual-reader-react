import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { 
  X, CheckCircle2, XCircle, HelpCircle, Loader2, 
  RotateCcw, Sparkles, Award, ChevronRight, BookOpen, AlertCircle 
} from 'lucide-react';
import { stripHtml } from '../utils/searchIndex';

const LANGUAGE_NAMES = {
  ru: 'Russian (на русском языке)',
  en: 'English',
  de: 'German (auf Deutsch)',
  es: 'Spanish (en español)',
  fr: 'French (en français)',
  zh: 'Chinese (用中文)'
};

export default function QuizModal() {
  const {
    isQuizOpen,
    setQuizOpen,
    currentBook,
    currentBookId,
    activeChapterIdx,
    activeSectionIdx,
    quizTargetSection,
    quizResults,
    saveQuizResult,
    apiKey,
    model,
    language,
    setSettingsOpen
  } = useStore();

  const [questions, setQuestions] = useState([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({}); // { [qId]: optionIndex }
  const [isSubmitted, setIsSubmitted] = useState({}); // { [qId]: boolean }
  const [isLoading, setIsLoading] = useState(false);
  const [quizFinished, setQuizFinished] = useState(false);
  const [error, setError] = useState(null);

  // Compute active section data
  const chapters = currentBook?.chapters || currentBook?.structure || [];
  const cIdx = quizTargetSection?.chapterIdx ?? activeChapterIdx;
  const sIdx = quizTargetSection?.sectionIdx ?? activeSectionIdx;
  const chapter = chapters[cIdx];
  const section = chapter?.sections?.[sIdx];
  const sectionTitle = quizTargetSection?.title || section?.title || 'Раздел';
  const chapterTitle = chapter?.title || 'Глава';
  const sectionId = section?.id || `${cIdx}_${sIdx}`;

  const lastResult = quizResults[currentBookId]?.[sectionId];

  // Auto-generate or reset quiz when modal opens
  useEffect(() => {
    if (isQuizOpen) {
      setError(null);
      setCurrentQIndex(0);
      setSelectedAnswers({});
      setIsSubmitted({});
      setQuizFinished(false);

      if (questions.length === 0) {
        generateQuiz();
      }
    }
  }, [isQuizOpen, sectionId]);

  const generateQuiz = async () => {
    if (!apiKey) {
      setError('Для генерации теста требуется указать API-ключ OpenRouter в настройках.');
      return;
    }

    const rawHtml = section?.html || section?.content || '';
    const plainText = stripHtml(rawHtml);

    if (!plainText || plainText.length < 50) {
      setError('Недостаточно текста в данном разделе для составления теста.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSelectedAnswers({});
    setIsSubmitted({});
    setQuizFinished(false);
    setCurrentQIndex(0);

    const targetLang = LANGUAGE_NAMES[language] || 'Russian';

    const systemPrompt = `You are an expert educator and insightful reading mentor. Generate 4 insightful, conceptual multiple-choice questions testing the reader's deep understanding of the following section from the book "${currentBook?.title || 'Book'}".
Current Section: "${sectionTitle}" (Chapter: "${chapterTitle}").

Text excerpt:
"""
${plainText.slice(0, 10000)}
"""

CRITICAL RULES:
- Output ONLY valid JSON array with 4 objects. No markdown formatting, no code block backticks, just raw JSON.
- Each question must have:
  "id": integer (1 to 4)
  "question": string (concise, testing understanding of core concepts, key ideas, nuances, or implications)
  "options": array of exactly 4 strings (one unambiguously correct, three plausible distractors)
  "correctIndex": integer from 0 to 3
  "explanation": string (1-2 sentences explaining why the correct answer is right and why others are wrong)
- All text must be in ${targetLang}.`;

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.href,
          'X-Title': 'Visual Reader React - Quiz'
        },
        body: JSON.stringify({
          model: model || 'openrouter/free',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: 'Generate the 4-question quiz JSON now.' }
          ],
          temperature: 0.2
        })
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenRouter (${res.status}): ${err}`);
      }

      const data = await res.json();
      let rawOutput = data.choices?.[0]?.message?.content || '';

      // Clean JSON if model returned markdown codeblocks
      rawOutput = rawOutput.replace(/```json/gi, '').replace(/```/g, '').trim();

      const parsed = JSON.parse(rawOutput);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setQuestions(parsed);
      } else {
        throw new Error('ИИ вернул ответ в некорректном формате.');
      }
    } catch (err) {
      console.error('Quiz generation error:', err);
      setError(`Ошибка генерации квиза: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectOption = (qId, optionIdx) => {
    if (isSubmitted[qId]) return;
    setSelectedAnswers(prev => ({ ...prev, [qId]: optionIdx }));
    setIsSubmitted(prev => ({ ...prev, [qId]: true }));

    // Check if this was the last question
    const updatedAnswers = { ...selectedAnswers, [qId]: optionIdx };
    const answeredCount = Object.keys(updatedAnswers).length;

    if (answeredCount === questions.length) {
      // Calculate score and save
      let correct = 0;
      questions.forEach(q => {
        if (updatedAnswers[q.id] === q.correctIndex) {
          correct++;
        }
      });
      const pct = Math.round((correct / questions.length) * 100);
      saveQuizResult(currentBookId, sectionId, {
        score: correct,
        total: questions.length,
        percentage: pct,
        timestamp: Date.now()
      });
    }
  };

  const currentQ = questions[currentQIndex];
  const isCurrentSubmitted = currentQ ? isSubmitted[currentQ.id] : false;
  const currentSelectedOption = currentQ ? selectedAnswers[currentQ.id] : null;

  // Calculate total score
  const score = questions.reduce((acc, q) => {
    return acc + (selectedAnswers[q.id] === q.correctIndex ? 1 : 0);
  }, 0);
  const percentage = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

  if (!isQuizOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      onClick={() => setQuizOpen(false)}
    >
      <div 
        className="w-full max-w-xl bg-bgModal border border-borderColor rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-4 py-3.5 border-b border-borderColor bg-black/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primaryGlow">
              <Sparkles size={17} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white truncate">
                Проверь себя: {sectionTitle}
              </h3>
              <p className="text-[11px] text-textDim truncate">{chapterTitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {questions.length > 0 && !isLoading && (
              <button
                onClick={generateQuiz}
                title="Сгенерировать новые вопросы"
                className="p-1.5 rounded-lg text-textDim hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <RotateCcw size={15} />
              </button>
            )}
            <button
              onClick={() => setQuizOpen(false)}
              className="p-1.5 rounded-lg text-textDim hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar flex flex-col justify-center">
          {/* Loading State */}
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
              <Loader2 size={36} className="animate-spin text-primaryGlow" />
              <div className="text-sm font-semibold text-white">ИИ составляет персональный тест...</div>
              <p className="text-xs text-textMuted max-w-xs leading-relaxed">
                Анализируем ключевые мысли, понятия и выводы раздела «{sectionTitle}».
              </p>
            </div>
          )}

          {/* Error State */}
          {!isLoading && error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex flex-col gap-3 text-center items-center my-4">
              <AlertCircle size={28} className="text-red-400" />
              <div className="text-xs text-red-200 leading-relaxed">{error}</div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
                >
                  Открыть настройки
                </button>
                <button
                  onClick={generateQuiz}
                  className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primaryGlow text-white text-xs font-medium transition-colors"
                >
                  Повторить запрос
                </button>
              </div>
            </div>
          )}

          {/* Quiz in Progress */}
          {!isLoading && !error && questions.length > 0 && !quizFinished && (
            <div className="flex flex-col gap-4">
              {/* Progress bar and question indicator */}
              <div className="flex items-center justify-between text-xs text-textDim">
                <span>Вопрос {currentQIndex + 1} из {questions.length}</span>
                <span>Решено: {Object.keys(selectedAnswers).length} / {questions.length}</span>
              </div>

              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-accentEmerald transition-all duration-300"
                  style={{ width: `${((currentQIndex + 1) / questions.length) * 100}%` }}
                />
              </div>

              {/* Question Text */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                <h4 className="text-sm sm:text-base font-semibold text-white leading-snug">
                  {currentQ?.question}
                </h4>
              </div>

              {/* Options */}
              <div className="flex flex-col gap-2 pt-1">
                {currentQ?.options.map((opt, oIdx) => {
                  const isSelected = currentSelectedOption === oIdx;
                  const isCorrect = currentQ.correctIndex === oIdx;

                  let btnStyle = 'bg-bgCard hover:bg-white/10 border-borderColor text-textMain';

                  if (isCurrentSubmitted) {
                    if (isCorrect) {
                      btnStyle = 'bg-emerald-500/15 border-emerald-500/60 text-emerald-200 font-medium shadow-sm';
                    } else if (isSelected && !isCorrect) {
                      btnStyle = 'bg-red-500/15 border-red-500/60 text-red-200 font-medium';
                    } else {
                      btnStyle = 'bg-bgCard/40 border-white/5 text-textDim opacity-50';
                    }
                  }

                  return (
                    <button
                      key={oIdx}
                      disabled={isCurrentSubmitted}
                      onClick={() => handleSelectOption(currentQ.id, oIdx)}
                      className={`w-full p-3 sm:p-3.5 rounded-xl border text-left text-xs sm:text-sm transition-all flex items-start gap-3 cursor-pointer ${btnStyle}`}
                    >
                      <span className="w-5 h-5 rounded-full border border-current shrink-0 flex items-center justify-center text-[11px] font-mono mt-0.5">
                        {String.fromCharCode(65 + oIdx)}
                      </span>
                      <span className="flex-1 leading-relaxed">{opt}</span>
                      {isCurrentSubmitted && isCorrect && (
                        <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                      )}
                      {isCurrentSubmitted && isSelected && !isCorrect && (
                        <XCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Explanation card after submit */}
              {isCurrentSubmitted && (
                <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/30 flex flex-col gap-1.5 animate-fade-in">
                  <div className="text-xs font-semibold text-primaryGlow flex items-center gap-1.5">
                    <HelpCircle size={14} /> Объяснение:
                  </div>
                  <p className="text-xs text-textMain leading-relaxed">
                    {currentQ.explanation}
                  </p>
                </div>
              )}

              {/* Navigation buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  disabled={currentQIndex === 0}
                  onClick={() => setCurrentQIndex(prev => prev - 1)}
                  className="px-3 py-1.5 rounded-lg text-xs text-textDim hover:text-white disabled:opacity-30 transition-colors"
                >
                  ← Предыдущий
                </button>

                {currentQIndex < questions.length - 1 ? (
                  <button
                    onClick={() => setCurrentQIndex(prev => prev + 1)}
                    className="px-4 py-2 rounded-lg bg-primary hover:bg-primaryGlow text-white text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>Следующий вопрос</span>
                    <ChevronRight size={14} />
                  </button>
                ) : (
                  <button
                    disabled={Object.keys(selectedAnswers).length < questions.length}
                    onClick={() => setQuizFinished(true)}
                    className="px-4 py-2 rounded-lg bg-accentEmerald hover:bg-emerald-600 disabled:opacity-40 text-white text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/20"
                  >
                    <Award size={15} />
                    <span>Посмотреть результат</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Quiz Results Screen */}
          {!isLoading && quizFinished && (
            <div className="py-6 flex flex-col items-center justify-center text-center gap-4 animate-fade-in">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-xl ${
                percentage >= 80 ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 shadow-emerald-500/30' :
                percentage >= 50 ? 'bg-gradient-to-tr from-amber-500 to-yellow-400 shadow-amber-500/30' :
                'bg-gradient-to-tr from-rose-500 to-red-400 shadow-red-500/30'
              }`}>
                <Award size={32} />
              </div>

              <div>
                <h4 className="text-xl font-bold text-white mb-1">
                  {percentage >= 80 ? 'Великолепно!' : percentage >= 50 ? 'Хороший результат!' : 'Материал стоит повторить'}
                </h4>
                <p className="text-xs text-textMuted max-w-xs">
                  Вы набрали <strong className="text-white text-sm">{score} из {questions.length}</strong> правильных ответов ({percentage}%).
                </p>
              </div>

              {/* Results Breakdown List */}
              <div className="w-full flex flex-col gap-2 my-2 text-left">
                {questions.map((q, idx) => {
                  const isUserCorrect = selectedAnswers[q.id] === q.correctIndex;
                  return (
                    <div 
                      key={q.id}
                      className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                        isUserCorrect 
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' 
                          : 'bg-red-500/10 border-red-500/30 text-red-200'
                      }`}
                    >
                      {isUserCorrect ? (
                        <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white mb-0.5">Вопрос {idx + 1}: {q.question}</div>
                        <div className="text-[11px] opacity-80">{q.explanation}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setSelectedAnswers({});
                    setIsSubmitted({});
                    setQuizFinished(false);
                    setCurrentQIndex(0);
                  }}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw size={14} /> Пройти снова
                </button>
                <button
                  onClick={() => setQuizOpen(false)}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primaryGlow text-white text-xs font-semibold transition-all cursor-pointer shadow-md shadow-primary/20"
                >
                  Вернуться к чтению
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
