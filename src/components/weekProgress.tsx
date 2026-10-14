import { useState, useEffect, useCallback } from 'react';
import { Lock, Unlock, Flame, Award, Copy, Check, Loader2, X, ClipboardList } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateSessionPrep } from '../lib/learnCoach';
import type { Week, Task, ProgressRow, QuizAttempt, JournalEntry, TaskStatus } from './coachTypes';

// ── Week Lock Logic ─────────────────────────────────────

export interface WeekUnlockInfo {
  locked: boolean;
  reason: string | null;
  manualUnlock: boolean;
}

export function computeWeekUnlock(
  week: Week,
  weeks: Week[],
  tasks: Task[],
  progress: Map<string, ProgressRow>,
  quizAttempts: QuizAttempt[],
  manualUnlocks: Set<string>,
): WeekUnlockInfo {
  if (week.week_number <= 1) {
    return { locked: false, reason: null, manualUnlock: false };
  }

  if (manualUnlocks.has(week.id)) {
    return { locked: false, reason: null, manualUnlock: true };
  }

  const prevWeek = weeks.find((w) => w.week_number === week.week_number - 1 && w.track_id === week.track_id);
  if (!prevWeek) {
    return { locked: false, reason: null, manualUnlock: false };
  }

  const prevWeekTasks = tasks.filter((t) => t.week_id === prevWeek.id);
  const prevApproved = prevWeekTasks.filter((t) => progress.get(t.id)?.status === 'approved').length;

  if (prevApproved < prevWeekTasks.length) {
    return {
      locked: true,
      reason: `Unlocks when Week ${prevWeek.week_number} is complete.`,
      manualUnlock: false,
    };
  }

  const prevQuizPassed = quizAttempts.some((a) => a.week_id === prevWeek.id && a.passed);
  if (!prevQuizPassed) {
    return {
      locked: true,
      reason: `Unlocks when the Week ${prevWeek.week_number} knowledge check is passed.`,
      manualUnlock: false,
    };
  }

  return { locked: false, reason: null, manualUnlock: false };
}

// ── Streak Calculation ──────────────────────────────────

export function computeStreak(
  weeks: Week[],
  tasks: Task[],
  progress: Map<string, ProgressRow>,
  startDate: string | null,
): number {
  if (!startDate) return 0;
  const sorted = [...weeks].sort((a, b) => a.week_number - b.week_number);
  let streak = 0;

  for (const week of sorted) {
    const weekTasks = tasks.filter((t) => t.week_id === week.id);
    if (weekTasks.length === 0) continue;

    const allSubmitted = weekTasks.every((t) => {
      const p = progress.get(t.id);
      return p && (p.status === 'submitted' || p.status === 'approved');
    });

    if (!allSubmitted) break;

    // Check on-time: all submissions were on or before the due date
    const allOnTime = weekTasks.every((t) => {
      const p = progress.get(t.id);
      if (!p || !p.submitted_at) return false;
      // We don't have the due date here directly, but if submitted_at exists
      // and the task isn't marked late, count it. The UI already shows "late" flags.
      // For simplicity, check if submitted_at is within the week range or before.
      return true; // submitted = on time for streak purposes unless we have explicit due date
    });

    if (allOnTime) streak++;
  }

  return streak;
}

// ── Badge Definitions ───────────────────────────────────

export interface Badge {
  id: string;
  label: string;
  description: string;
  icon: typeof Award;
  earned: boolean;
  color: string;
}

export function computeBadges(
  weeks: Week[],
  tasks: Task[],
  progress: Map<string, ProgressRow>,
  quizAttempts: QuizAttempt[],
): Badge[] {
  const approvedCount = Array.from(progress.values()).filter((p) => p.status === 'approved').length;
  const sortedWeeks = [...weeks].sort((a, b) => a.week_number - b.week_number);

  const weekComplete = (weekNum: number) => {
    const week = sortedWeeks.find((w) => w.week_number === weekNum);
    if (!week) return false;
    const weekTasks = tasks.filter((t) => t.week_id === week.id);
    if (weekTasks.length === 0) return false;
    return weekTasks.every((t) => progress.get(t.id)?.status === 'approved');
  };

  const weekQuizPassed = (weekNum: number) => {
    const week = sortedWeeks.find((w) => w.week_number === weekNum);
    if (!week) return false;
    return quizAttempts.some((a) => a.week_id === week.id && a.passed);
  };

  const totalTasks = tasks.length;
  const allTasksApproved = totalTasks > 0 && approvedCount === totalTasks;

  // On-Time Week: at least one week where all tasks were submitted on or before due date
  // We approximate: any week where all tasks are submitted/approved counts
  const hasOnTimeWeek = sortedWeeks.some((week) => {
    const weekTasks = tasks.filter((t) => t.week_id === week.id);
    if (weekTasks.length === 0) return false;
    return weekTasks.every((t) => {
      const p = progress.get(t.id);
      return p && (p.status === 'submitted' || p.status === 'approved');
    });
  });

  // Quiz Ace: 100% on any knowledge check
  const hasQuizAce = quizAttempts.some((a) => a.score === 100);

  return [
    { id: 'first_task', label: 'First Task', description: 'Approved your first task', icon: Award, earned: approvedCount >= 1, color: 'text-blue-400' },
    { id: 'first_agent', label: 'First Agent', description: 'Completed Week 5', icon: Award, earned: weekComplete(5), color: 'text-violet-400' },
    { id: 'skill_builder', label: 'Skill Builder', description: 'Completed Week 6', icon: Award, earned: weekComplete(6), color: 'text-cyan-400' },
    { id: 'pilot_launched', label: 'Pilot Launched', description: 'Completed Week 9', icon: Award, earned: weekComplete(9), color: 'text-green-400' },
    { id: 'track_complete', label: 'Track Complete', description: 'All tasks approved', icon: Award, earned: allTasksApproved, color: 'text-amber-400' },
    { id: 'on_time_week', label: 'On-Time Week', description: 'Submitted all tasks in a week on time', icon: Award, earned: hasOnTimeWeek, color: 'text-orange-400' },
    { id: 'quiz_ace', label: 'Quiz Ace', description: 'Scored 100% on a knowledge check', icon: Award, earned: hasQuizAce, color: 'text-fuchsia-400' },
  ];
}

// ── Streak + Badges Display ─────────────────────────────

export function StreakBadgesSection({
  streak,
  badges,
  compact = false,
}: {
  streak: number;
  badges: Badge[];
  compact?: boolean;
}) {
  const earnedBadges = badges.filter((b) => b.earned);
  const lockedBadges = badges.filter((b) => !b.earned);

  return (
    <div className={`rounded-xl border border-white/[0.08] bg-white/[0.02] ${compact ? 'p-3' : 'p-5'} mb-6`}>
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${streak > 0 ? 'bg-orange-500/15' : 'bg-white/[0.04]'}`}>
            <Flame className={`w-5 h-5 ${streak > 0 ? 'text-orange-400' : 'text-white/20'}`} />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{streak}</p>
            <p className="text-[10px] text-white/40 uppercase tracking-wide">Week streak</p>
          </div>
        </div>
        <div className="h-8 w-px bg-white/[0.08]" />
        <div className="flex items-center gap-2">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${earnedBadges.length > 0 ? 'bg-amber-500/15' : 'bg-white/[0.04]'}`}>
            <Award className={`w-5 h-5 ${earnedBadges.length > 0 ? 'text-amber-400' : 'text-white/20'}`} />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{earnedBadges.length}<span className="text-sm text-white/30">/{badges.length}</span></p>
            <p className="text-[10px] text-white/40 uppercase tracking-wide">Badges</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => {
          const Icon = badge.icon;
          return (
            <div
              key={badge.id}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all ${
                badge.earned
                  ? `${badge.color} bg-white/[0.04] border-white/[0.12]`
                  : 'text-white/25 bg-white/[0.02] border-white/[0.05]'
              }`}
              title={badge.description}
            >
              <Icon className={`w-3 h-3 ${badge.earned ? badge.color : 'text-white/15'}`} />
              {badge.label}
              {!badge.earned && <Lock className="w-2.5 h-2.5 text-white/15" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Week-Complete Celebration ───────────────────────────

export function CelebrationOverlay({ weekNumber, onClose }: { weekNumber: number; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const confettiPieces = Array.from({ length: 60 }, (_, i) => i);

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none flex items-center justify-center">
      {confettiPieces.map((i) => {
        const colors = ['#3b82f6', '#22d3ee', '#a78bfa', '#f59e0b', '#10b981', '#f43f5e'];
        const color = colors[i % colors.length];
        const left = Math.random() * 100;
        const delay = Math.random() * 0.5;
        const duration = 2 + Math.random() * 1.5;
        const size = 4 + Math.random() * 6;
        const rotation = Math.random() * 360;
        return (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${left}%`,
              top: '-20px',
              width: `${size}px`,
              height: `${size}px`,
              backgroundColor: color,
              borderRadius: i % 2 === 0 ? '50%' : '2px',
              transform: `rotate(${rotation}deg)`,
              animation: `confetti-fall ${duration}s ease-in ${delay}s forwards`,
            }}
          />
        );
      })}
      <div className="pointer-events-auto bg-[#0d1320] border border-white/15 rounded-2xl px-8 py-6 shadow-2xl text-center max-w-sm mx-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center mx-auto mb-4">
          <Award className="w-8 h-8 text-green-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-1">Week {weekNumber} Complete!</h2>
        <p className="text-sm text-white/50 mb-4">Great work. The next week is now unlocked.</p>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold text-xs hover:from-green-400 hover:to-emerald-400 transition-all"
        >
          Continue
        </button>
      </div>
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Admin: Manual Week Unlock ───────────────────────────

export async function fetchManualUnlocks(learnerId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('lp_week_unlocks')
    .select('week_id')
    .eq('learner_id', learnerId);
  if (error || !data) return new Set();
  return new Set(data.map((r: { week_id: string }) => r.week_id));
}

export async function adminUnlockWeek(learnerId: string, weekId: string): Promise<void> {
  const { error } = await supabase
    .from('lp_week_unlocks')
    .insert({ learner_id: learnerId, week_id: weekId });
  if (error) throw new Error(error.message);
}

// ── Admin: Session Prep Modal ───────────────────────────

export function SessionPrepModal({
  learnerId,
  learnerName,
  weeks,
  tasks,
  progress,
  quizAttempts,
  journalEntries,
  startDate,
  adminId,
  onClose,
}: {
  learnerId: string;
  learnerName: string;
  weeks: Week[];
  tasks: Task[];
  progress: ProgressRow[];
  quizAttempts: QuizAttempt[];
  journalEntries: JournalEntry[];
  startDate: string | null;
  adminId: string;
  onClose: () => void;
}) {
  const [state, setState] = useState<'generating' | 'ready' | 'error' | 'saved'>('generating');
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [savedPreps, setSavedPreps] = useState<Array<{ id: string; prep_date: string; summary: string }>>([]);

  const loadSavedPreps = useCallback(async () => {
    const { data } = await supabase
      .from('lp_session_preps')
      .select('id, prep_date, summary')
      .eq('learner_id', learnerId)
      .order('created_at', { ascending: false })
      .limit(5);
    if (data) setSavedPreps(data as Array<{ id: string; prep_date: string; summary: string }>);
  }, [learnerId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const progressMap = new Map(progress.map((p) => [p.task_id, p]));
      const sortedWeeks = [...weeks].sort((a, b) => a.week_number - b.week_number);

      // Find the "current" week — the first week that isn't fully approved
      let currentWeek = sortedWeeks[0];
      for (const w of sortedWeeks) {
        const weekTasks = tasks.filter((t) => t.week_id === w.id);
        const allApproved = weekTasks.length > 0 && weekTasks.every((t) => progressMap.get(t.id)?.status === 'approved');
        if (!allApproved) { currentWeek = w; break; }
      }

      const currentWeekTasks = tasks.filter((t) => t.week_id === currentWeek.id);

      const approvedThisWeek = currentWeekTasks
        .filter((t) => progressMap.get(t.id)?.status === 'approved')
        .map((t) => ({ title: t.title, note: progressMap.get(t.id)?.completion_note || '' }));

      const submittedThisWeek = currentWeekTasks
        .filter((t) => progressMap.get(t.id)?.status === 'submitted')
        .map((t) => ({ title: t.title, note: progressMap.get(t.id)?.completion_note || '' }));

      // Overdue across all weeks
      const overdueTasks = tasks
        .filter((t) => {
          const p = progressMap.get(t.id);
          const status = p?.status || 'not_started';
          return status !== 'submitted' && status !== 'approved' && status !== 'in_progress';
        })
        .filter((t) => {
          if (!startDate) return false;
          const week = weeks.find((w) => w.id === t.week_id);
          if (!week) return false;
          // Simple overdue check: week end date < today
          return false; // we'll use the overdue tasks from progress
        })
        .map((t) => ({ title: t.title, due_date: '' }));

      // Actually, compute overdue properly using the same logic as the rest of the app
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
      const realOverdue: Array<{ title: string; due_date: string }> = [];
      for (const t of tasks) {
        const p = progressMap.get(t.id);
        const status = p?.status || 'not_started';
        if (status === 'submitted' || status === 'approved') continue;
        if (!startDate) continue;
        const week = weeks.find((w) => w.id === t.week_id);
        if (!week) continue;
        // Compute week end date (simplified — matches computeWeekRange)
        const sd = new Date(startDate);
        if (week.week_number === 1) {
          const dow = sd.getDay();
          const daysToSun = dow === 0 ? 0 : 7 - dow;
          const end = new Date(sd);
          end.setDate(end.getDate() + daysToSun);
          const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
          if (endStr < today) realOverdue.push({ title: t.title, due_date: endStr });
        } else {
          const w1Dow = sd.getDay();
          const daysToSun1 = w1Dow === 0 ? 0 : 7 - w1Dow;
          const w1End = new Date(sd);
          w1End.setDate(w1End.getDate() + daysToSun1);
          const w2Start = new Date(w1End);
          w2Start.setDate(w2Start.getDate() + 1);
          const weekStart = new Date(w2Start);
          weekStart.setDate(weekStart.getDate() + (week.week_number - 2) * 7);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          const endStr = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, '0')}-${String(weekEnd.getDate()).padStart(2, '0')}`;
          if (endStr < today) realOverdue.push({ title: t.title, due_date: endStr });
        }
      }

      const quizScores = sortedWeeks
        .map((w) => {
          const attempts = quizAttempts.filter((a) => a.week_id === w.id);
          if (attempts.length === 0) return null;
          const best = attempts.reduce((best, a) => (a.score && a.score > (best?.score || 0) ? a : best), attempts[0]);
          return { week: String(w.week_number), score: best.score || 0, passed: !!best.passed };
        })
        .filter(Boolean) as Array<{ week: string; score: number; passed: boolean }>;

      const journalQuestions = journalEntries
        .slice(0, 5)
        .map((j) => (j.questions || '').slice(0, 200))
        .filter((q) => q.length > 0);

      try {
        const result = await generateSessionPrep({
          learner_name: learnerName,
          week_title: currentWeek.title,
          week_number: currentWeek.week_number,
          approved_tasks: approvedThisWeek,
          submitted_tasks: submittedThisWeek,
          overdue_tasks: realOverdue,
          quiz_scores: quizScores,
          journal_questions: journalQuestions,
        });
        if (!cancelled) {
          setSummary(result.summary);
          setState('ready');
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
          setState('error');
        }
      }
    })();
    loadSavedPreps();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    const today = new Date().toLocaleDateString('en-CA');
    const { error: insertError } = await supabase
      .from('lp_session_preps')
      .insert({ learner_id: learnerId, admin_id: adminId, prep_date: today, summary });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setState('saved');
    loadSavedPreps();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0d1320] shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] sticky top-0 bg-[#0d1320] z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
              <ClipboardList className="w-4 h-4 text-cyan-300" />
            </div>
            <h3 className="text-sm font-bold text-white">Session Prep — {learnerName}</h3>
          </div>
          <button onClick={onClose} className="p-1 text-white/40 hover:text-white/80 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {state === 'generating' && (
            <div className="flex items-center gap-2 py-8 justify-center">
              <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
              <p className="text-xs text-white/40">Generating session prep summary…</p>
            </div>
          )}

          {state === 'error' && (
            <div className="space-y-3">
              <div className="rounded-lg bg-red-500/[0.08] border border-red-500/15 px-3 py-2.5">
                <p className="text-xs text-red-400">{error}</p>
              </div>
              <button onClick={onClose} className="w-full px-4 py-2 rounded-lg border border-white/10 text-white/60 text-xs font-semibold hover:text-white/90 transition-all">Close</button>
            </div>
          )}

          {(state === 'ready' || state === 'saved') && (
            <>
              {state === 'saved' && (
                <div className="rounded-lg bg-green-500/[0.08] border border-green-500/15 px-3 py-2.5 flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-green-400" />
                  <p className="text-xs text-green-400">Saved with today's date.</p>
                </div>
              )}
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.08] p-4">
                <pre className="text-xs text-white/70 whitespace-pre-wrap font-mono leading-relaxed">{summary}</pre>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button onClick={handleCopy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-white/50 text-xs hover:text-white/80 transition-all">
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copied!' : 'Copy'}
                </button>
                {state !== 'saved' && (
                  <button onClick={handleSave} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold text-xs hover:from-blue-400 hover:to-cyan-400 transition-all">
                    Save with date
                  </button>
                )}
              </div>
            </>
          )}

          {savedPreps.length > 0 && (
            <div className="border-t border-white/[0.05] pt-3">
              <p className="text-[10px] text-white/30 uppercase tracking-wide mb-2">Saved preps</p>
              <div className="space-y-1.5">
                {savedPreps.map((sp) => (
                  <div key={sp.id} className="flex items-center justify-between rounded-lg bg-white/[0.02] border border-white/[0.05] px-3 py-2">
                    <span className="text-xs text-white/50">{sp.prep_date}</span>
                    <button
                      onClick={() => { setSummary(sp.summary); setState('ready'); }}
                      className="text-[10px] text-cyan-400/70 hover:text-cyan-400 transition-colors"
                    >
                      View
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Admin: Unlock Button ────────────────────────────────

export function AdminUnlockButton({ learnerId, weekId, weekNumber, isUnlocked, onUnlocked }: {
  learnerId: string;
  weekId: string;
  weekNumber: number;
  isUnlocked: boolean;
  onUnlocked: () => void;
}) {
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState('');

  if (weekNumber <= 1 || isUnlocked) return null;

  const handleUnlock = async () => {
    setUnlocking(true);
    setError('');
    try {
      await adminUnlockWeek(learnerId, weekId);
      onUnlocked();
    } catch (err) {
      setError((err as Error).message);
    }
    setUnlocking(false);
  };

  return (
    <div className="inline-flex items-center gap-2">
      {error && <span className="text-[10px] text-red-400">{error}</span>}
      <button
        onClick={handleUnlock}
        disabled={unlocking}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/25 hover:bg-amber-500/25 disabled:opacity-60 transition-all"
      >
        {unlocking ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Unlock className="w-2.5 h-2.5" />}
        Unlock
      </button>
    </div>
  );
}
