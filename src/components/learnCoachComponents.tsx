import { useState, useEffect } from 'react';
import { Loader2, Sparkles, CheckCircle2, XCircle, Brain, Mic, Trophy, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  getCoachFeedback, generateQuiz, gradeQuiz, generateInterviewQuestion, gradeInterview,
  type CoachFeedback, type QuizQuestion, type QuizAttempt, type InterviewPracticeRow,
} from '../lib/learnCoach';
import type { Task, TaskResource, Week, JournalEntry, ProgressRow } from './coachTypes';

// ── Instant Feedback Modal ──────────────────────────────
export function CoachFeedbackModal({ task, resources, existingProgress, learnerNote, learnerLink, attachmentFileNames, onClose, onComplete, onSkipWithoutFeedback }: {
  task: Task;
  resources: TaskResource[];
  existingProgress?: ProgressRow;
  learnerNote: string;
  learnerLink: string;
  attachmentFileNames?: string[];
  onClose: () => void;
  onComplete: (feedback: CoachFeedback, answer: string) => Promise<void>;
  onSkipWithoutFeedback: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<CoachFeedback | null>(null);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [coachFailed, setCoachFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getCoachFeedback({
          task_title: task.title,
          task_description: task.description || undefined,
          learner_note: learnerNote,
          learner_link: learnerLink || undefined,
          resources: resources.map((r) => ({ title: r.title, url: r.url, kind: r.kind })),
          attachment_files: attachmentFileNames,
        });
        if (!cancelled) setFeedback(result);
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
          setCoachFailed(true);
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    if (answer.trim().length < 20) {
      setError('Please write at least 20 characters answering the question.');
      return;
    }
    setSubmitting(true);
    setError('');
    await onComplete(feedback!, answer.trim());
    setSubmitting(false);
  };

  const handleSkipWithoutFeedback = async () => {
    setSubmitting(true);
    await onSkipWithoutFeedback();
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d1320] shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] sticky top-0 bg-[#0d1320] z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-violet-300" />
            </div>
            <h3 className="text-sm font-bold text-white">AI Coach Feedback</h3>
          </div>
          <button onClick={onClose} className="p-1 text-white/40 hover:text-white/80 transition-colors text-xs">Cancel</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {loading && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="w-6 h-6 text-violet-400 animate-spin mb-3" />
              <p className="text-xs text-white/40">Getting feedback on your submission…</p>
            </div>
          )}

          {coachFailed && !loading && (
            <div className="rounded-lg bg-red-500/[0.08] border border-red-500/15 px-3 py-2.5">
              <p className="text-xs text-red-400 mb-2">{error}</p>
              <p className="text-[10px] text-white/40 mb-3">The AI coach couldn't review your submission. You can still submit your task for review without coach feedback.</p>
              <button onClick={handleSkipWithoutFeedback} disabled={submitting}
                className="px-3 py-2 rounded-lg border border-white/10 text-white/60 text-xs hover:text-white/90 disabled:opacity-60 transition-all">
                {submitting ? 'Submitting…' : 'Submit without AI feedback'}
              </button>
            </div>
          )}

          {feedback && (
            <>
              <div className="rounded-lg bg-green-500/[0.06] border border-green-500/15 p-3">
                <p className="text-[10px] font-semibold text-green-400/80 uppercase tracking-wide mb-1">What's good</p>
                <p className="text-xs text-white/70 leading-relaxed">{feedback.whats_good}</p>
              </div>
              <div className="rounded-lg bg-amber-500/[0.06] border border-amber-500/15 p-3">
                <p className="text-[10px] font-semibold text-amber-400/80 uppercase tracking-wide mb-1">What's missing</p>
                <p className="text-xs text-white/70 leading-relaxed">{feedback.whats_missing}</p>
              </div>
              <div className="rounded-lg bg-violet-500/[0.06] border border-violet-500/15 p-3">
                <p className="text-[10px] font-semibold text-violet-300/80 uppercase tracking-wide mb-1.5">Answer this to submit</p>
                <p className="text-sm text-white/80 leading-relaxed mb-3">{feedback.follow_up}</p>
                <textarea
                  value={answer}
                  onChange={(e) => { setAnswer(e.target.value); setError(''); }}
                  rows={3}
                  placeholder="Your answer… (at least 20 characters)"
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-violet-500/50 transition-all resize-none"
                />
                <p className="text-[10px] text-white/30 mt-1">{answer.trim().length}/20 characters minimum</p>
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex items-center justify-end gap-2">
                <button onClick={handleSubmit} disabled={submitting || answer.trim().length < 20}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-semibold text-xs hover:from-violet-400 hover:to-fuchsia-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                  {submitting ? 'Submitting…' : 'Submit for review'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Status Badge ────────────────────────────────────────
export function StatusBadge({ status, reviewedAt }: { status: string; reviewedAt?: string | null }) {
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-green-500/15 text-green-400 border border-green-500/20">
        <CheckCircle2 className="w-2.5 h-2.5" /> Approved{reviewedAt ? ` · ${new Date(reviewedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
      </span>
    );
  }
  if (status === 'submitted') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20">
        <Loader2 className="w-2.5 h-2.5" /> Submitted — awaiting review
      </span>
    );
  }
  if (status === 'changes_requested') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-red-500/15 text-red-400 border border-red-500/20">
        <XCircle className="w-2.5 h-2.5" /> Changes requested
      </span>
    );
  }
  return null;
}

// ── Knowledge Check Card ────────────────────────────────
export function KnowledgeCheckCard({ week, weekTasks, resources, learnerId, onPassed, readOnly, quizAttempts }: {
  week: Week;
  weekTasks: Task[];
  resources: TaskResource[];
  learnerId: string;
  onPassed: () => void;
  readOnly?: boolean;
  quizAttempts: QuizAttempt[];
}) {
  const [state, setState] = useState<'idle' | 'loading' | 'taking' | 'grading' | 'result'>('idle');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<{ score: number; passed: boolean; feedback: string; question_feedback: Array<{ question: string; correct: boolean; feedback: string }> } | null>(null);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const weekAttempts = quizAttempts.filter((a) => a.week_id === week.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const bestAttempt = weekAttempts.find((a) => a.passed);
  const passed = !!bestAttempt;

  const handleStart = async () => {
    setState('loading');
    setError('');
    try {
      const { questions: qs } = await generateQuiz({
        week_title: week.title,
        week_goal: week.goal || undefined,
        tasks: weekTasks.map((t) => ({ title: t.title, description: t.description || undefined })),
        resources: resources.filter((r) => weekTasks.some((t) => t.id === r.task_id)).map((r) => ({ title: r.title, url: r.url, kind: r.kind })),
      });
      setQuestions(qs);
      setAnswers(new Array(qs.length).fill(''));
      setState('taking');
    } catch (err) {
      setError((err as Error).message);
      setState('idle');
    }
  };

  const handleSubmit = async () => {
    setState('grading');
    setError('');
    try {
      const gradeResult = await gradeQuiz({ questions, answers, week_id: week.id, target_learner_id: learnerId });
      // Attempt is saved by the edge function via service role
      setResult(gradeResult);
      setState('result');
      if (gradeResult.passed) onPassed();
    } catch (err) {
      setError((err as Error).message);
      setState('taking');
    }
  };

  return (
    <div className={`rounded-xl border ${passed ? 'border-green-500/20 bg-green-500/[0.02]' : 'border-white/[0.08] bg-white/[0.02]'} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Brain className={`w-4 h-4 ${passed ? 'text-green-400' : 'text-cyan-400'}`} />
          <span className="text-sm font-semibold text-white">Knowledge Check</span>
          {passed && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-green-500/15 text-green-400 border border-green-500/20">
              <Trophy className="w-2.5 h-2.5" /> Passed
            </span>
          )}
        </div>
        {weekAttempts.length > 0 && (
          <button onClick={() => setShowHistory(!showHistory)} className="text-[10px] text-white/30 hover:text-white/60 transition-colors">
            {weekAttempts.length} attempt{weekAttempts.length !== 1 ? 's' : ''} {showHistory ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />}
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

      {state === 'idle' && !passed && !readOnly && (
        <div>
          <p className="text-xs text-white/40 mb-3">Test your understanding of this week's material. 4 questions, need 75% to pass. You can retake as many times as you need.</p>
          <button onClick={handleStart} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/25 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/25 transition-all">
            <Brain className="w-3.5 h-3.5" /> Start knowledge check
          </button>
        </div>
      )}

      {state === 'loading' && (
        <div className="flex items-center gap-2 py-3">
          <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
          <p className="text-xs text-white/40">Generating questions…</p>
        </div>
      )}

      {state === 'taking' && (
        <div className="space-y-4">
          {questions.map((q, i) => (
            <div key={i} className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
              <p className="text-xs text-white/70 mb-2"><span className="font-semibold text-white/90">Q{i + 1}.</span> {q.question}</p>
              {q.type === 'multiple_choice' && q.options?.map((opt, j) => (
                <label key={j} className="flex items-center gap-2 py-1 cursor-pointer">
                  <input type="radio" name={`q${i}`} checked={answers[i] === String(j)} onChange={() => setAnswers((prev) => { const n = [...prev]; n[i] = String(j); return n; })}
                    className="w-3 h-3 accent-cyan-500" />
                  <span className="text-xs text-white/60">{opt}</span>
                </label>
              ))}
              {q.type === 'short_answer' && (
                <textarea value={answers[i] || ''} onChange={(e) => setAnswers((prev) => { const n = [...prev]; n[i] = e.target.value; return n; })}
                  rows={2} placeholder="Your answer…" className="w-full px-2 py-1.5 rounded bg-white/[0.05] border border-white/10 text-white placeholder-white/20 text-xs focus:outline-none focus:border-cyan-500/50 resize-none" />
              )}
            </div>
          ))}
          <button onClick={handleSubmit} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold text-xs hover:from-cyan-400 hover:to-blue-400 transition-all">
            Submit answers
          </button>
        </div>
      )}

      {state === 'grading' && (
        <div className="flex items-center gap-2 py-3">
          <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
          <p className="text-xs text-white/40">Grading your answers…</p>
        </div>
      )}

      {state === 'result' && result && (
        <div className="space-y-3">
          <div className={`rounded-lg p-3 ${result.passed ? 'bg-green-500/[0.06] border border-green-500/15' : 'bg-amber-500/[0.06] border border-amber-500/15'}`}>
            <div className="flex items-center gap-2 mb-1">
              {result.passed ? <Trophy className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-amber-400" />}
              <span className="text-sm font-bold text-white">Score: {result.score}/100</span>
              <span className={`text-xs font-semibold ${result.passed ? 'text-green-400' : 'text-amber-400'}`}>{result.passed ? 'Passed!' : 'Not yet — need 75+'}</span>
            </div>
            <p className="text-xs text-white/60">{result.feedback}</p>
          </div>
          {result.question_feedback.map((qf, i) => (
            <div key={i} className={`rounded-lg p-2.5 ${qf.correct ? 'bg-green-500/[0.04]' : 'bg-red-500/[0.04]'} border border-white/[0.06]`}>
              <div className="flex items-start gap-2">
                {qf.correct ? <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0 mt-0.5" /> : <XCircle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />}
                <div>
                  <p className="text-[11px] text-white/60 leading-relaxed">{qf.question}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">{qf.feedback}</p>
                </div>
              </div>
            </div>
          ))}
          {!readOnly && (
            <button onClick={handleStart} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-white/60 text-xs font-semibold hover:text-white/90 transition-all">
              <RefreshCw className="w-3.5 h-3.5" /> Try again with new questions
            </button>
          )}
        </div>
      )}

      {showHistory && weekAttempts.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-white/[0.05] pt-3">
          {weekAttempts.map((a, i) => (
            <div key={a.id} className="flex items-center justify-between text-[10px]">
              <span className="text-white/40">Attempt {weekAttempts.length - i}: {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              <span className={a.passed ? 'text-green-400 font-semibold' : 'text-white/40'}>{a.score}/100 {a.passed ? '✓' : ''}</span>
            </div>
          ))}
        </div>
      )}

      {readOnly && !passed && state === 'idle' && (
        <p className="text-xs text-white/30">No knowledge check attempted yet.</p>
      )}
    </div>
  );
}

// ── Interview Practice Card ─────────────────────────────
export function InterviewPracticeCard({ learnerId, journalEntries, approvedTasks, interviewHistory, onNewAttempt }: {
  learnerId: string;
  journalEntries: JournalEntry[];
  approvedTasks: Array<{ title: string; completion_note: string }>;
  interviewHistory: InterviewPracticeRow[];
  onNewAttempt: () => void;
}) {
  const [state, setState] = useState<'idle' | 'loading_q' | 'answering' | 'grading' | 'result'>('idle');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<{ scores: { clarity: number; technical_depth: number; use_of_specifics: number }; feedback: string; suggested_version: string } | null>(null);
  const [error, setError] = useState('');

  const handleGetQuestion = async () => {
    setState('loading_q');
    setError('');
    try {
      const { question: q } = await generateInterviewQuestion({
        journal_entries: journalEntries.slice(0, 5).map((j) => ({ entry_text: j.questions || j.learned || j.built || '', entry_date: j.entry_date })),
        approved_tasks: approvedTasks.slice(0, 10),
      });
      setQuestion(q);
      setAnswer('');
      setResult(null);
      setState('answering');
    } catch (err) {
      setError((err as Error).message);
      setState('idle');
    }
  };

  const handleSubmit = async () => {
    if (answer.trim().length < 20) {
      setError('Please write at least 20 characters.');
      return;
    }
    setState('grading');
    setError('');
    try {
      const grade = await gradeInterview({ question, answer: answer.trim(), target_learner_id: learnerId });
      // Practice record is saved by the edge function via service role
      setResult(grade);
      setState('result');
      onNewAttempt();
    } catch (err) {
      setError((err as Error).message);
      setState('answering');
    }
  };

  const scoreColor = (s: number) => s >= 4 ? 'text-green-400' : s >= 3 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Mic className="w-4 h-4 text-violet-400" />
        <span className="text-sm font-semibold text-white">Practice Interview</span>
      </div>

      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

      {state === 'idle' && (
        <div>
          <p className="text-xs text-white/40 mb-3">Get an interview-style question drawn from your journal entries and approved tasks. Practice answering like you would in a real interview.</p>
          <button onClick={handleGetQuestion} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/25 text-violet-300 text-xs font-semibold hover:bg-violet-500/25 transition-all">
            <Mic className="w-3.5 h-3.5" /> Get a question
          </button>
        </div>
      )}

      {state === 'loading_q' && (
        <div className="flex items-center gap-2 py-3">
          <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
          <p className="text-xs text-white/40">Crafting a question from your experience…</p>
        </div>
      )}

      {state === 'answering' && (
        <div className="space-y-3">
          <div className="rounded-lg bg-violet-500/[0.06] border border-violet-500/15 p-3">
            <p className="text-[10px] font-semibold text-violet-300/80 uppercase tracking-wide mb-1">Interview Question</p>
            <p className="text-sm text-white/80 leading-relaxed">{question}</p>
          </div>
          <textarea value={answer} onChange={(e) => { setAnswer(e.target.value); setError(''); }} rows={4}
            placeholder="Type your answer as if you were in an interview…"
            className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-violet-500/50 transition-all resize-none" />
          <div className="flex items-center gap-2">
            <button onClick={handleGetQuestion} className="px-3 py-1.5 rounded-lg border border-white/10 text-white/50 text-xs hover:text-white/80 transition-all">New question</button>
            <button onClick={handleSubmit} className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-semibold text-xs hover:from-violet-400 hover:to-fuchsia-400 transition-all">
              Submit answer
            </button>
          </div>
        </div>
      )}

      {state === 'grading' && (
        <div className="flex items-center gap-2 py-3">
          <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
          <p className="text-xs text-white/40">Scoring your answer…</p>
        </div>
      )}

      {state === 'result' && result && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {([
              ['Clarity', result.scores.clarity],
              ['Tech Depth', result.scores.technical_depth],
              ['Specifics', result.scores.use_of_specifics],
            ] as const).map(([label, score]) => (
              <div key={label} className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2.5 text-center">
                <p className="text-[10px] text-white/40 uppercase tracking-wide mb-1">{label}</p>
                <p className={`text-xl font-bold ${scoreColor(score)}`}>{score}<span className="text-xs text-white/30">/5</span></p>
              </div>
            ))}
          </div>
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
            <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wide mb-1">Feedback</p>
            <p className="text-xs text-white/60 leading-relaxed">{result.feedback}</p>
          </div>
          <div className="rounded-lg bg-green-500/[0.04] border border-green-500/15 p-3">
            <p className="text-[10px] font-semibold text-green-400/80 uppercase tracking-wide mb-1">Stronger version</p>
            <p className="text-xs text-white/60 leading-relaxed">{result.suggested_version}</p>
          </div>
          <button onClick={handleGetQuestion} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-white/60 text-xs font-semibold hover:text-white/90 transition-all">
            <RefreshCw className="w-3.5 h-3.5" /> Practice again
          </button>
        </div>
      )}

      {interviewHistory.length > 0 && state === 'idle' && (
        <div className="mt-3 border-t border-white/[0.05] pt-3 space-y-1.5">
          <p className="text-[10px] text-white/30 uppercase tracking-wide mb-1">Recent practice ({interviewHistory.length})</p>
          {interviewHistory.slice(0, 3).map((h) => (
            <div key={h.id} className="text-[10px]">
              <span className="text-white/40">{new Date(h.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: </span>
              <span className="text-white/50">{h.question.slice(0, 60)}…</span>
              {h.scores && <span className="text-white/30 ml-1">({h.scores.clarity + h.scores.technical_depth + h.scores.use_of_specifics}/15)</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Admin: Quiz Attempts Summary ────────────────────────
export function AdminQuizSummary({ weekId, quizAttempts }: { weekId: string; quizAttempts: QuizAttempt[] }) {
  const attempts = quizAttempts.filter((a) => a.week_id === weekId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (attempts.length === 0) return <p className="text-[10px] text-white/30 mt-1.5">No quiz attempts.</p>;
  const best = attempts.find((a) => a.passed);
  return (
    <div className="mt-1.5 space-y-1">
      {best && <p className="text-[10px] text-green-400/70">Best: {best.score}/100 — Passed</p>}
      {attempts.slice(0, 3).map((a, i) => (
        <p key={a.id} className="text-[10px] text-white/30">
          Attempt {attempts.length - i}: {a.score}/100 {a.passed ? '✓' : ''} — {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </p>
      ))}
    </div>
  );
}

// ── Admin: Interview Practice Summary ───────────────────
export function AdminInterviewSummary({ interviewHistory }: { interviewHistory: InterviewPracticeRow[] }) {
  if (interviewHistory.length === 0) return <p className="text-[10px] text-white/30">No interview practice yet.</p>;
  return (
    <div className="space-y-1.5">
      {interviewHistory.slice(0, 5).map((h) => (
        <div key={h.id} className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2.5">
          <p className="text-[11px] text-white/60">{h.question}</p>
          {h.scores && (
            <div className="flex items-center gap-3 mt-1 text-[10px]">
              <span className="text-white/40">Clarity: {h.scores.clarity}/5</span>
              <span className="text-white/40">Tech: {h.scores.technical_depth}/5</span>
              <span className="text-white/40">Specifics: {h.scores.use_of_specifics}/5</span>
            </div>
          )}
          <p className="text-[10px] text-white/30 mt-0.5">{new Date(h.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
        </div>
      ))}
    </div>
  );
}
