import { useState } from 'react';
import { CheckCircle2, XCircle, RotateCcw, Award } from 'lucide-react';
import type { QuizData, QuizQuestion } from '../lib/articles';

interface Props {
  quiz: QuizData;
  onComplete?: () => void;
}

export default function Quiz({ quiz, onComplete }: Props) {
  const [answers, setAnswers] = useState<(number | null)[]>(() =>
    quiz.questions.map(() => null),
  );
  const [submitted, setSubmitted] = useState(false);
  const [revealed, setRevealed] = useState<boolean[]>(() =>
    quiz.questions.map(() => false),
  );

  const score = answers.reduce<number>((acc, ans, i) => {
    return ans === quiz.questions[i].answer ? acc + 1 : acc;
  }, 0);
  const total = quiz.questions.length;
  const allAnswered = answers.every((a) => a !== null);

  const handleSelect = (qIdx: number, optIdx: number) => {
    if (submitted) return;
    const next = [...answers];
    next[qIdx] = optIdx;
    setAnswers(next);
    const nextRevealed = [...revealed];
    nextRevealed[qIdx] = true;
    setRevealed(nextRevealed);
  };

  const handleSubmit = () => {
    if (!allAnswered) return;
    setSubmitted(true);
    onComplete?.();
  };

  const handleReset = () => {
    setAnswers(quiz.questions.map(() => null));
    setRevealed(quiz.questions.map(() => false));
    setSubmitted(false);
  };

  return (
    <div className="mt-12 pt-8 border-t border-white/[0.07]">
      <div className="flex items-center gap-2 mb-6">
        <Award className="w-4 h-4 text-cyan-400" />
        <h2 className="text-base font-bold text-white">Check your understanding</h2>
        <span className="text-[10px] text-white/30 ml-1">{total} questions</span>
      </div>

      <div className="space-y-6">
        {quiz.questions.map((q: QuizQuestion, qIdx) => {
          const selected = answers[qIdx];
          const isRevealed = revealed[qIdx];
          const isCorrect = selected === q.answer;

          return (
            <div key={qIdx} className="p-4 rounded-xl border border-white/[0.07] bg-white/[0.02]">
              <div className="text-sm font-semibold text-white mb-3">
                <span className="text-white/35 mr-1.5">{qIdx + 1}.</span>
                {q.question}
              </div>
              <div className="space-y-2">
                {q.options.map((opt, oIdx) => {
                  const isSelected = selected === oIdx;
                  const isAnswer = oIdx === q.answer;

                  let optClass = 'border-white/[0.08] bg-white/[0.03] text-white/60 hover:border-white/15 hover:bg-white/[0.05]';
                  if (isRevealed && isAnswer) {
                    optClass = 'border-green-500/40 bg-green-500/10 text-green-200';
                  } else if (isRevealed && isSelected && !isAnswer) {
                    optClass = 'border-red-500/40 bg-red-500/10 text-red-200';
                  } else if (isSelected) {
                    optClass = 'border-cyan-500/40 bg-cyan-500/10 text-white';
                  }

                  return (
                    <button
                      key={oIdx}
                      onClick={() => handleSelect(qIdx, oIdx)}
                      disabled={submitted}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm text-left transition-all ${optClass} ${submitted ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      <div className="flex-shrink-0 w-5 h-5 rounded-full border border-white/15 flex items-center justify-center text-[10px] font-bold">
                        {String.fromCharCode(65 + oIdx)}
                      </div>
                      <span className="flex-1">{opt}</span>
                      {isRevealed && isAnswer && <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />}
                      {isRevealed && isSelected && !isAnswer && <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
              {isRevealed && (
                <div className={`mt-3 p-3 rounded-lg text-xs leading-relaxed ${isCorrect ? 'bg-green-500/[0.07] text-green-200/80' : 'bg-amber-500/[0.07] text-amber-200/80'}`}>
                  <span className="font-semibold">{isCorrect ? 'Correct. ' : 'Not quite. '}</span>
                  {q.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!submitted ? (
        <div className="mt-6 flex items-center justify-between">
          <span className="text-xs text-white/30">
            {answers.filter((a) => a !== null).length} / {total} answered
          </span>
          <button
            onClick={handleSubmit}
            disabled={!allAnswered}
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-semibold hover:from-cyan-400 hover:to-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Submit answers
          </button>
        </div>
      ) : (
        <div className="mt-6 p-5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-center">
          <div className="text-2xl font-bold text-white mb-1">
            {score} / {total}
          </div>
          <div className="text-sm text-white/45 mb-4">
            {score === total ? 'Perfect score — you nailed it.' : score >= total * 0.6 ? 'Good work — review the misses and try again.' : 'Keep going — give it another shot.'}
          </div>
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/[0.1] bg-white/[0.05] text-sm text-white/70 hover:text-white hover:bg-white/[0.08] transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
