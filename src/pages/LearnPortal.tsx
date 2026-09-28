import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2, LogOut, CheckCircle2, Circle, PlayCircle,
  BookOpen, Calendar, Users, ChevronRight, ArrowLeft,
  GraduationCap, TrendingUp, Eye, ListChecks, NotebookPen,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import NavBar from '../components/NavBar';
import {
  TraineeJournal, AdminJournal,
  getEntryCountByWeek, getLatestEntryDate,
  type JournalEntry,
} from '../components/Journal';

// ── Types ──────────────────────────────────────────────
type TaskStatus = 'not_started' | 'in_progress' | 'done';

interface Track {
  id: string;
  title: string;
  description: string | null;
}

interface Week {
  id: string;
  track_id: string;
  week_number: number;
  title: string;
  goal: string | null;
  start_date: string | null;
  end_date: string | null;
}

interface Task {
  id: string;
  week_id: string;
  title: string;
  description: string | null;
  sort_order: number;
}

interface ProgressRow {
  id: string;
  learner_id: string;
  task_id: string;
  status: TaskStatus;
  completed_at: string | null;
}

interface LearnerInfo {
  id: string;
  fullName: string;
  doneCount: number;
  currentWeek: number | null;
  latestEntryDate: string | null;
}

// ── Auth Gate ──────────────────────────────────────────
function SignInGate({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      onSignedIn();
    }
  };

  return (
    <div className="pt-20 min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white mb-1">Learner Portal</h1>
          <p className="text-sm text-white/40">Sign in to access your training track</p>
        </div>
        <form onSubmit={handleSignIn} className="space-y-3">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
            className="w-full px-4 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-blue-500/50 transition-all" />
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password"
            className="w-full px-4 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-blue-500/50 transition-all" />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold text-sm hover:from-blue-400 hover:to-cyan-400 disabled:opacity-60 transition-all">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="text-[10px] text-white/25 text-center mt-4">
          Don't have an account? Contact your administrator for an invite.
        </p>
      </div>
    </div>
  );
}

// ── Progress helpers ───────────────────────────────────
function localDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isCurrentWeek(week: Week): boolean {
  if (!week.start_date || !week.end_date) return false;
  const now = new Date();
  const start = localDate(week.start_date);
  const end = localDate(week.end_date);
  end.setHours(23, 59, 59);
  return now >= start && now <= end;
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return '';
  const fmt = (d: string) => localDate(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  return fmt(start || end!);
}

function fmtJournalDate(d: string): string {
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(y, m - 1, dd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ── Learner Dashboard ──────────────────────────────────
function LearnerDashboard({
  track, weeks, tasks, progress, onToggleTask, fullName, readOnly = false,
  journalEntries, onJumpToJournal,
}: {
  track: Track;
  weeks: Week[];
  tasks: Task[];
  progress: Map<string, ProgressRow>;
  onToggleTask: (taskId: string, currentStatus: TaskStatus) => void;
  fullName: string;
  readOnly?: boolean;
  learnerId: string;
  journalEntries: JournalEntry[];
  onJumpToJournal: () => void;
}) {
  const sortedWeeks = [...weeks].sort((a, b) => a.week_number - b.week_number);
  const totalTasks = tasks.length;
  const doneCount = Array.from(progress.values()).filter((p) => p.status === 'done').length;
  const pct = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;
  const noop = () => {};
  const handleToggle = readOnly ? noop : onToggleTask;
  const entryCountByWeek = getEntryCountByWeek(journalEntries);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-24">
      {/* Track header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="w-4 h-4 text-cyan-400" />
          <span className="text-xs text-white/40">Welcome back, {fullName}</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">{track.title}</h1>
        {track.description && <p className="text-sm text-white/45 leading-relaxed max-w-2xl">{track.description}</p>}
      </div>

      {/* Overall progress bar */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-semibold text-white">Overall Progress</span>
          </div>
          <span className="text-lg font-bold text-white">{pct}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center gap-4 mt-3 text-[10px] text-white/35">
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-400" /> {doneCount} done</span>
          <span className="flex items-center gap-1"><PlayCircle className="w-3 h-3 text-amber-400" /> {Array.from(progress.values()).filter((p) => p.status === 'in_progress').length} in progress</span>
          <span className="flex items-center gap-1"><Circle className="w-3 h-3 text-white/30" /> {totalTasks - doneCount} remaining</span>
        </div>
      </div>

      {/* Week cards */}
      <div className="space-y-4">
        {sortedWeeks.map((week) => {
          const weekTasks = tasks.filter((t) => t.week_id === week.id).sort((a, b) => a.sort_order - b.sort_order);
          const weekDone = weekTasks.filter((t) => progress.get(t.id)?.status === 'done').length;
          const weekPct = weekTasks.length > 0 ? Math.round((weekDone / weekTasks.length) * 100) : 0;
          const current = isCurrentWeek(week);

          return (
            <div
              key={week.id}
              className={`rounded-xl border overflow-hidden transition-all ${
                current ? 'border-blue-500/40 bg-blue-500/[0.03] shadow-lg shadow-blue-500/5' : 'border-white/[0.08] bg-white/[0.02]'
              }`}
            >
              {/* Week header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.05]">
                <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                  current ? 'bg-blue-500/20 text-blue-300' : 'bg-white/[0.05] text-white/40'
                }`}>
                  {week.week_number}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-white">{week.title}</h3>
                  {week.goal && <p className="text-xs text-white/40 mt-0.5">{week.goal}</p>}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {(week.start_date || week.end_date) && (
                    <span className="hidden sm:flex items-center gap-1 text-[10px] text-white/30">
                      <Calendar className="w-2.5 h-2.5" />
                      {formatDateRange(week.start_date, week.end_date)}
                    </span>
                  )}
                  {current && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      Current
                    </span>
                  )}
                  <span className={`text-xs font-semibold ${weekPct === 100 ? 'text-green-400' : 'text-white/40'}`}>
                    {weekDone}/{weekTasks.length}
                  </span>
                </div>
              </div>

              {/* Journal link */}
              {(entryCountByWeek.get(week.id) || 0) > 0 && (
                <div className="px-5 pb-2">
                  <button
                    onClick={onJumpToJournal}
                    className="inline-flex items-center gap-1 text-[10px] text-cyan-400/60 hover:text-cyan-400 transition-colors"
                  >
                    <NotebookPen className="w-2.5 h-2.5" /> Journal: {entryCountByWeek.get(week.id)} {entryCountByWeek.get(week.id) === 1 ? 'entry' : 'entries'}
                  </button>
                </div>
              )}

              {/* Task checklist */}
              <div className="px-5 py-3">
                {weekTasks.length === 0 ? (
                  <p className="text-xs text-white/30 py-2">No tasks for this week yet.</p>
                ) : (
                  <div className="space-y-1">
                    {weekTasks.map((task) => {
                      const p = progress.get(task.id);
                      const status = p?.status || 'not_started';
                      return (
                        <button
                          key={task.id}
                          onClick={() => handleToggle(task.id, status)}
                          disabled={readOnly}
                          className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg transition-all text-left group ${
                            readOnly ? 'cursor-default' : 'hover:bg-white/[0.04]'
                          }`}
                        >
                          <span className="flex-shrink-0 mt-0.5">
                            {status === 'done' ? (
                              <CheckCircle2 className="w-4 h-4 text-green-400 group-hover:scale-110 transition-transform" />
                            ) : status === 'in_progress' ? (
                              <PlayCircle className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                            ) : (
                              <Circle className="w-4 h-4 text-white/25 group-hover:text-white/40 transition-colors" />
                            )}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm leading-snug ${
                              status === 'done' ? 'text-white/40 line-through' : 'text-white/80'
                            }`}>{task.title}</p>
                            {task.description && (
                              <p className="text-xs text-white/35 mt-0.5 leading-relaxed">{task.description}</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Admin Dashboard ────────────────────────────────────
function AdminDashboard({
  learners, weeks, tasks, onSelectLearner, selectedLearner, learnerProgress, track, adminId,
}: {
  learners: LearnerInfo[];
  weeks: Week[];
  tasks: Task[];
  onSelectLearner: (learnerId: string) => void;
  selectedLearner: string | null;
  learnerProgress: ProgressRow[];
  track: Track;
  learnerJournalEntries: JournalEntry[];
  adminId: string;
}) {
  const sortedLearners = [...learners].sort((a, b) => b.doneCount - a.doneCount);
  const selectedLearnerInfo = learners.find((l) => l.id === selectedLearner);

  if (selectedLearner && selectedLearnerInfo) {
    const progressMap = new Map(learnerProgress.map((p) => [p.task_id, p]));
    const sortedWeeks = [...weeks].sort((a, b) => a.week_number - b.week_number);

    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24">
        {/* Back button — clearly visible with a pill style */}
        <button
          onClick={() => onSelectLearner('')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-xs text-white/60 hover:text-white/90 hover:bg-white/[0.08] mb-6 transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to all learners
        </button>

        <div className="flex items-center gap-3 mb-2">
          <Users className="w-4 h-4 text-cyan-400" />
          <h1 className="text-xl font-bold text-white">{selectedLearnerInfo.fullName}</h1>
        </div>
        <p className="text-sm text-white/40 mb-6">
          {selectedLearnerInfo.doneCount} of {tasks.length} tasks complete ({Math.round((selectedLearnerInfo.doneCount / Math.max(tasks.length, 1)) * 100)}%)
        </p>

        <div className="space-y-4">
          {sortedWeeks.map((week) => {
            const weekTasks = tasks.filter((t) => t.week_id === week.id).sort((a, b) => a.sort_order - b.sort_order);
            const weekDone = weekTasks.filter((t) => progressMap.get(t.id)?.status === 'done').length;
            return (
              <div key={week.id} className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.05]">
                  <div className="w-7 h-7 rounded-lg bg-white/[0.05] flex items-center justify-center text-[10px] font-bold text-white/40">
                    {week.week_number}
                  </div>
                  <h3 className="text-sm font-bold text-white flex-1">{week.title}</h3>
                  <span className="text-xs font-semibold text-white/40">{weekDone}/{weekTasks.length}</span>
                </div>
                <div className="px-5 py-2">
                  {weekTasks.map((task) => {
                    const p = progressMap.get(task.id);
                    const status = p?.status || 'not_started';
                    return (
                      <div key={task.id} className="flex items-center gap-3 py-2">
                        {status === 'done' ? <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                         : status === 'in_progress' ? <PlayCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                         : <Circle className="w-4 h-4 text-white/20 flex-shrink-0" />}
                        <span className={`text-sm ${status === 'done' ? 'text-white/40 line-through' : 'text-white/70'}`}>
                          {task.title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Journal section */}
        <div className="mt-8">
          <AdminJournal learnerId={selectedLearner} weeks={weeks} adminId={adminId} />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24">
      <div className="flex items-center gap-3 mb-2">
        <Users className="w-4 h-4 text-cyan-400" />
        <h1 className="text-xl font-bold text-white">Learner Progress</h1>
      </div>
      <p className="text-sm text-white/40 mb-6">Track: {track.title}</p>

      {sortedLearners.length === 0 ? (
        <div className="text-center py-12 rounded-xl border border-white/[0.05] bg-white/[0.01]">
          <Users className="w-8 h-8 text-white/15 mx-auto mb-3" />
          <p className="text-sm text-white/30">No learners have progress yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedLearners.map((learner) => {
            const pct = tasks.length > 0 ? Math.round((learner.doneCount / tasks.length) * 100) : 0;
            return (
              <button
                key={learner.id}
                onClick={() => onSelectLearner(learner.id)}
                className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12] transition-all text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-cyan-300">
                    {getInitials(learner.fullName)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{learner.fullName}</p>
                  <p className="text-[10px] text-white/30 mt-0.5">
                    {learner.doneCount}/{tasks.length} tasks{learner.currentWeek ? ` · Week ${learner.currentWeek}` : ''}{learner.latestEntryDate ? ` · Journal: ${fmtJournalDate(learner.latestEntryDate)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="w-24 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-white/60 w-8 text-right">{pct}%</span>
                  <ChevronRight className="w-4 h-4 text-white/25" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────
export default function LearnPortal() {
  const [authed, setAuthed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [fullName, setFullName] = useState('');
  const [userId, setUserId] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Data
  const [track, setTrack] = useState<Track | null>(null);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [progressMap, setProgressMap] = useState<Map<string, ProgressRow>>(new Map());

  // Admin data
  const [learners, setLearners] = useState<LearnerInfo[]>([]);
  const [selectedLearner, setSelectedLearner] = useState<string | null>(null);
  const [learnerProgress, setLearnerProgress] = useState<ProgressRow[]>([]);
  const [adminView, setAdminView] = useState<'learners' | 'preview'>('learners');

  // Journal data
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [learnerJournalEntries, setLearnerJournalEntries] = useState<JournalEntry[]>([]);
  const [traineeView, setTraineeView] = useState<'track' | 'journal'>('track');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      if (data.session) {
        setUserId(data.session.user.id);
        const role = data.session.user.app_metadata?.role;
        setIsAdmin(role === 'admin');
        const name = data.session.user.user_metadata?.full_name as string | undefined;
        setFullName(name || data.session.user.email || '');
      }
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
      if (session) {
        setUserId(session.user.id);
        const role = session.user.app_metadata?.role;
        setIsAdmin(role === 'admin');
        const name = session.user.user_metadata?.full_name as string | undefined;
        setFullName(name || session.user.email || '');
      } else {
        setUserId('');
        setFullName('');
        setIsAdmin(false);
      }
      setAuthChecked(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // ── Effect 1: Load curriculum once per session (depends only on authed) ──
  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    (async () => {
      const { data: tracks } = await supabase.from('lp_tracks').select('*').order('created_at').limit(1);
      if (cancelled || !tracks || tracks.length === 0) return;
      const t = tracks[0] as Track;
      const trackId = t.id;
      const { data: w } = await supabase.from('lp_weeks').select('*').eq('track_id', trackId).order('week_number');
      const weekRows = (w || []) as Week[];
      const weekIds = weekRows.map((x) => x.id);
      let taskRows: Task[] = [];
      if (weekIds.length > 0) {
        const { data: tk } = await supabase.from('lp_tasks').select('*').in('week_id', weekIds).order('sort_order');
        taskRows = (tk || []) as Task[];
      }
      if (cancelled) return;
      setTrack(t);
      setWeeks(weekRows);
      setTasks(taskRows);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [authed]);

  // ── Effect 2: Load progress after curriculum is loaded (depends on track, not callbacks) ──
  useEffect(() => {
    if (!track || tasks.length === 0) return;
    let cancelled = false;
    if (isAdmin) {
      (async () => {
        const { data: allProgress } = await supabase.from('lp_progress').select('*');
        if (cancelled) return;
        const rows = (allProgress || []) as ProgressRow[];
        const { data: profiles } = await supabase.from('lp_profiles').select('id, full_name');
        if (cancelled) return;
        const profileMap = new Map<string, string>(
          (profiles || []).map((p: any) => [p.id, p.full_name || 'Unknown'])
        );
        const byLearner = new Map<string, ProgressRow[]>();
        for (const r of rows) {
          if (!byLearner.has(r.learner_id)) byLearner.set(r.learner_id, []);
          byLearner.get(r.learner_id)!.push(r);
        }
        const sortedWeeks = [...weeks].sort((a, b) => a.week_number - b.week_number);
        const learnerInfos: LearnerInfo[] = [];
        for (const [lId, pRows] of byLearner) {
          const doneCount = pRows.filter((p) => p.status === 'done').length;
          let currentWeek: number | null = null;
          for (const w of sortedWeeks) {
            const wTasks = tasks.filter((t) => t.week_id === w.id);
            const allDone = wTasks.every((t) => pRows.find((p) => p.task_id === t.id && p.status === 'done'));
            if (!allDone && wTasks.length > 0) {
              currentWeek = w.week_number;
              break;
            }
          }
          if (currentWeek === null && doneCount > 0 && doneCount < tasks.length) {
            for (const w of sortedWeeks) {
              const wTasks = tasks.filter((t) => t.week_id === w.id);
              const hasProgress = wTasks.some((t) => pRows.find((p) => p.task_id === t.id));
              if (!hasProgress) {
                currentWeek = w.week_number;
                break;
              }
            }
          }
          learnerInfos.push({
            id: lId,
            fullName: profileMap.get(lId) || 'Unknown learner',
            doneCount,
            currentWeek,
            latestEntryDate: null,
          });
        }
        // Load all journal entries to get latest dates + learner-specific entries
        const { data: allJournal } = await supabase
          .from('lp_journal_entries')
          .select('*')
          .order('entry_date', { ascending: false });
        if (cancelled) return;
        const journalRows = (allJournal || []) as JournalEntry[];
        setLearnerJournalEntries(journalRows);
        // Update learnerInfos with latest entry dates
        const journalByLearner = new Map<string, JournalEntry[]>();
        for (const je of journalRows) {
          if (!journalByLearner.has(je.learner_id)) journalByLearner.set(je.learner_id, []);
          journalByLearner.get(je.learner_id)!.push(je);
        }
        const updatedInfos = learnerInfos.map((li) => {
          const lEntries = journalByLearner.get(li.id) || [];
          return { ...li, latestEntryDate: getLatestEntryDate(lEntries) };
        });
        if (!cancelled) setLearners(updatedInfos);
      })();
    } else {
      if (!userId) return;
      (async () => {
        const { data } = await supabase.from('lp_progress').select('*').eq('learner_id', userId);
        if (cancelled) return;
        const rows = (data || []) as ProgressRow[];
        setProgressMap(new Map(rows.map((r) => [r.task_id, r])));
        // Load journal entries for this learner
        const { data: jData } = await supabase
          .from('lp_journal_entries')
          .select('*')
          .eq('learner_id', userId)
          .order('entry_date', { ascending: false });
        if (cancelled) return;
        setJournalEntries((jData || []) as JournalEntry[]);
      })();
    }
    return () => { cancelled = true; };
  }, [track, tasks, weeks, isAdmin, userId]);

  const loadSelectedLearnerProgress = useCallback(async (learnerId: string) => {
    const { data } = await supabase.from('lp_progress').select('*').eq('learner_id', learnerId);
    setLearnerProgress((data || []) as ProgressRow[]);
  }, []);

  const handleToggleTask = async (taskId: string, currentStatus: TaskStatus) => {
    const newStatus: TaskStatus = currentStatus === 'done' ? 'not_started' : currentStatus === 'not_started' ? 'in_progress' : 'done';
    const completedAt = newStatus === 'done' ? new Date().toISOString() : null;

    // Optimistic update
    setProgressMap((prev) => {
      const next = new Map(prev);
      const existing = next.get(taskId);
      if (existing) {
        next.set(taskId, { ...existing, status: newStatus, completed_at: completedAt });
      } else {
        next.set(taskId, {
          id: 'temp',
          learner_id: userId,
          task_id: taskId,
          status: newStatus,
          completed_at: completedAt,
        });
      }
      return next;
    });

    // Persist to database (no loading spinner — this is a background save)
    const existing = progressMap.get(taskId);
    if (existing && existing.id !== 'temp') {
      await supabase.from('lp_progress').update({ status: newStatus, completed_at: completedAt }).eq('id', existing.id);
    } else {
      const { data } = await supabase.from('lp_progress').insert({
        learner_id: userId,
        task_id: taskId,
        status: newStatus,
        completed_at: completedAt,
      }).select('*');
      if (data && data.length > 0) {
        setProgressMap((prev) => {
          const next = new Map(prev);
          next.set(taskId, data[0] as ProgressRow);
          return next;
        });
      }
    }
  };

  const handleSelectLearner = (learnerId: string) => {
    if (learnerId === '') {
      setSelectedLearner(null);
      setLearnerProgress([]);
      return;
    }
    setSelectedLearner(learnerId);
    loadSelectedLearnerProgress(learnerId);
  };

  const handleSignOut = () => {
    supabase.auth.signOut();
    setAuthed(false);
    setProgressMap(new Map());
    setLearners([]);
    setSelectedLearner(null);
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#080c14] text-white">
        <NavBar />
        <div className="pt-28 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#080c14] text-white font-sans antialiased">
        <NavBar />
        <SignInGate onSignedIn={() => setAuthed(true)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080c14] text-white font-sans antialiased">
      <NavBar />

      {/* Top bar with sign out */}
      <div className="fixed top-14 right-0 z-40 px-4 sm:px-6 lg:px-8 py-2">
        <div className="flex items-center gap-3">
          {isAdmin && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-amber-500/30 bg-amber-500/10 text-amber-300">
              Admin
            </span>
          )}
          <button onClick={handleSignOut} className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors">
            <LogOut className="w-3 h-3" /> Sign out
          </button>
        </div>
      </div>

      {loading || !track ? (
        <div className="pt-28 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
        </div>
      ) : isAdmin ? (
        <>
          {/* Admin view toggle */}
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20">
            <div className="inline-flex items-center gap-0.5 rounded-lg bg-white/[0.04] border border-white/[0.08] p-0.5">
              <button
                onClick={() => { setAdminView('learners'); setSelectedLearner(null); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  adminView === 'learners' ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white/70'
                }`}
              >
                <ListChecks className="w-3.5 h-3.5" /> Learner Progress
              </button>
              <button
                onClick={() => setAdminView('preview')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  adminView === 'preview' ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white/70'
                }`}
              >
                <Eye className="w-3.5 h-3.5" /> Track Preview
              </button>
            </div>
          </div>

          {/* Admin: learner list or learner detail */}
          {adminView === 'learners' && (
            <AdminDashboard
              learners={learners}
              weeks={weeks}
              tasks={tasks}
              onSelectLearner={handleSelectLearner}
              selectedLearner={selectedLearner}
              learnerProgress={learnerProgress}
              track={track}
              learnerJournalEntries={learnerJournalEntries}
              adminId={userId}
            />
          )}

          {/* Admin: read-only track preview */}
          {adminView === 'preview' && (
            <>
              <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border border-amber-500/30 bg-amber-500/10 text-amber-300">
                  <Eye className="w-3 h-3" /> Read-only preview — what learners see
                </span>
              </div>
              <LearnerDashboard
                track={track}
                weeks={weeks}
                tasks={tasks}
                progress={new Map()}
                onToggleTask={() => {}}
                fullName={fullName}
                readOnly
                learnerId={userId}
                journalEntries={[]}
                onJumpToJournal={() => {}}
              />
            </>
          )}
        </>
      ) : (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20">
          {/* Trainee tab toggle: Track | Journal */}
          <div className="inline-flex items-center gap-0.5 rounded-lg bg-white/[0.04] border border-white/[0.08] p-0.5 mb-6">
            <button
              onClick={() => setTraineeView('track')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                traineeView === 'track' ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white/70'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" /> Track
            </button>
            <button
              onClick={() => setTraineeView('journal')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                traineeView === 'journal' ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white/70'
              }`}
            >
              <NotebookPen className="w-3.5 h-3.5" /> Journal
            </button>
          </div>

          {traineeView === 'journal' ? (
            <div className="pt-2">
              <TraineeJournal learnerId={userId} weeks={weeks} />
            </div>
          ) : (
            <LearnerDashboard
              track={track}
              weeks={weeks}
              tasks={tasks}
              progress={progressMap}
              onToggleTask={handleToggleTask}
              fullName={fullName}
              learnerId={userId}
              journalEntries={journalEntries}
              onJumpToJournal={() => setTraineeView('journal')}
            />
          )}
        </div>
      )}

      {/* Back link */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors group">
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          Back to site
        </Link>
      </div>
    </div>
  );
}
