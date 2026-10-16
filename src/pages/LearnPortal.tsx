import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2, LogOut, CheckCircle2, Circle, PlayCircle,
  BookOpen, Calendar, Users, ChevronRight, ArrowLeft,
  GraduationCap, TrendingUp, Eye, ListChecks, NotebookPen,
  UserPlus, X, Mail, Check, Clock, AlertTriangle,
  FileText, Link2, MessageSquare, Send, Edit3,
  ClipboardCheck, Hourglass, CalendarDays,
  Video, Lightbulb, Plus, Trash2, ExternalLink, BookMarked, ChevronUp, ChevronDown,
  KeyRound, ShieldCheck, Sparkles, Mic, Lock, ClipboardList, Flame, Award, Unlock,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import NavBar from '../components/NavBar';
import {
  TraineeJournal, AdminJournal,
  getEntryCountByWeek, getLatestEntryDate,
  type JournalEntry,
} from '../components/Journal';
import {
  CoachFeedbackModal, StatusBadge, KnowledgeCheckCard, InterviewPracticeCard,
  AdminQuizSummary, AdminInterviewSummary,
} from '../components/learnCoachComponents';
import { AttachmentDropzone, AttachmentGallery } from '../components/AttachmentsUI';
import {
  type PendingFile, type AttachmentRow,
  uploadFile, createAttachmentRecord, deleteAttachment,
  fetchAttachments, getSignedUrl,
} from '../lib/attachments';
import { generateInterviewQuestion, gradeInterview, type QuizAttempt, type InterviewPracticeRow, type CoachFeedback } from '../lib/learnCoach';
import {
  computeWeekUnlock, computeStreak, computeBadges, StreakBadgesSection,
  CelebrationOverlay, SessionPrepModal, AdminUnlockButton, fetchManualUnlocks,
  type WeekUnlockInfo,
} from '../components/weekProgress';

// ── Types ──────────────────────────────────────────────
type TaskStatus = 'not_started' | 'in_progress' | 'submitted' | 'approved' | 'changes_requested';

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
  due_date: string | null;
}

interface ProgressRow {
  id: string;
  learner_id: string;
  task_id: string;
  status: TaskStatus;
  completed_at: string | null;
  completion_note: string | null;
  link: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
  coach_feedback?: string | null;
  coach_question?: string | null;
  coach_answer?: string | null;
  coach_completed?: boolean | null;
}

type ResourceKind = 'doc' | 'video' | 'concept' | 'tutorial';

interface TaskResource {
  id: string;
  task_id: string;
  title: string;
  url: string;
  kind: ResourceKind;
  sort_order: number;
}

interface LearnerInfo {
  id: string;
  fullName: string;
  startDate: string | null;
  approvedCount: number;
  overdueCount: number;
  awaitingReviewCount: number;
  currentWeek: number | null;
  latestEntryDate: string | null;
}

// ── Per-learner date computation ───────────────────────
// Week 1: start_date through the first Sunday on or after start_date.
// Week N (N>1): Monday through Sunday, offset (N-1)*7 days from the first Monday after Week 1's end.

function dateToStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function strToDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getDayOfWeek(d: Date): number {
  return d.getDay(); // 0=Sun, 1=Mon, ...
}

/**
 * Compute the start and end dates for a given week number, relative to a learner's start_date.
 * Week 1: start_date → first Sunday on or after start_date (inclusive).
 * Week N: Monday → Sunday, offset from the first Monday after Week 1's end.
 */
function computeWeekRange(startDate: string, weekNumber: number): { start: string; end: string } {
  const sd = strToDate(startDate);
  if (weekNumber === 1) {
    // Week 1 starts on start_date
    const start = sd;
    // End on the first Sunday on or after start_date
    const dow = getDayOfWeek(start);
    // If start_date is Sunday (dow=0), week 1 is just that one day
    const daysToSunday = dow === 0 ? 0 : 7 - dow;
    const end = addDays(start, daysToSunday);
    return { start: dateToStr(start), end: dateToStr(end) };
  }
  // Week 1 end
  const w1Dow = getDayOfWeek(sd);
  const daysToSunday1 = w1Dow === 0 ? 0 : 7 - w1Dow;
  const w1End = addDays(sd, daysToSunday1);
  // Week 2 starts the Monday after Week 1's Sunday
  const w2Start = addDays(w1End, 1);
  // Week N starts (N-2)*7 days after week 2 start
  const weekStart = addDays(w2Start, (weekNumber - 2) * 7);
  const weekEnd = addDays(weekStart, 6);
  return { start: dateToStr(weekStart), end: dateToStr(weekEnd) };
}

/**
 * Compute the due date for a task — the Sunday its week ends.
 */
function computeTaskDueDate(startDate: string, weekNumber: number): string {
  return computeWeekRange(startDate, weekNumber).end;
}

/**
 * Build a map of task_id → computed due date for a learner.
 */
function buildTaskDueDates(startDate: string | null, weeks: Week[], tasks: Task[]): Map<string, string> {
  const map = new Map<string, string>();
  if (!startDate) {
    // Fall back to stored due dates if no start_date
    for (const t of tasks) {
      if (t.due_date) map.set(t.id, t.due_date);
    }
    return map;
  }
  const weekNumById = new Map(weeks.map((w) => [w.id, w.week_number]));
  for (const t of tasks) {
    const wn = weekNumById.get(t.week_id);
    if (wn) {
      map.set(t.id, computeTaskDueDate(startDate, wn));
    }
  }
  return map;
}

/**
 * Build a map of week_id → {start, end} for a learner.
 */
function buildWeekRanges(startDate: string | null, weeks: Week[]): Map<string, { start: string; end: string }> {
  const map = new Map<string, { start: string; end: string }>();
  for (const w of weeks) {
    if (startDate) {
      map.set(w.id, computeWeekRange(startDate, w.week_number));
    } else if (w.start_date && w.end_date) {
      map.set(w.id, { start: w.start_date, end: w.end_date });
    }
  }
  return map;
}

// ── Date / Time Helpers (US Central) ───────────────────
function localDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getCentralDateStr(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}

function getCentralDateStrFromISO(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}

function daysUntilDue(dueDate: string): number {
  const today = getCentralDateStr();
  const todayDate = strToDate(today);
  const dueDateObj = strToDate(dueDate);
  return Math.round((dueDateObj.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
}

function isOverdue(dueDate: string | null | undefined, status: TaskStatus): boolean {
  if (!dueDate || status === 'submitted' || status === 'approved') return false;
  return daysUntilDue(dueDate) < 0;
}

function isDueSoon(dueDate: string | null | undefined, status: TaskStatus): boolean {
  if (!dueDate || status === 'submitted' || status === 'approved') return false;
  const days = daysUntilDue(dueDate);
  return days >= 0 && days <= 2;
}

function isDueThisWeek(dueDate: string | null | undefined, status: TaskStatus): boolean {
  if (!dueDate || status === 'submitted' || status === 'approved') return false;
  const days = daysUntilDue(dueDate);
  return days >= 0 && days <= 7;
}

function getDaysLate(dueDate: string, submittedAt: string): number {
  const submittedStr = getCentralDateStrFromISO(submittedAt);
  const submittedDate = strToDate(submittedStr);
  const dueDateObj = strToDate(dueDate);
  const diff = Math.round((submittedDate.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

function formatDueDate(dueDate: string | null | undefined): string {
  if (!dueDate) return '';
  const [y, m, d] = dueDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatSubmittedDate(submittedAt: string): string {
  const centralDate = getCentralDateStrFromISO(submittedAt);
  const [y, m, d] = centralDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isCurrentWeek(weekRange: { start: string; end: string } | undefined): boolean {
  if (!weekRange) return false;
  const now = new Date();
  const start = localDate(weekRange.start);
  const end = localDate(weekRange.end);
  end.setHours(23, 59, 59);
  return now >= start && now <= end;
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return '';
  const fmt = (d: string) => localDate(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  return fmt(start || end!);
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ── Status Icon ────────────────────────────────────────
function StatusIcon({ status, className = 'w-4 h-4' }: { status: TaskStatus; className?: string }) {
  switch (status) {
    case 'approved':
      return <CheckCircle2 className={`${className} text-green-400 flex-shrink-0`} />;
    case 'submitted':
      return <Send className={`${className} text-cyan-400 flex-shrink-0`} />;
    case 'changes_requested':
      return <AlertTriangle className={`${className} text-red-400 flex-shrink-0`} />;
    case 'in_progress':
      return <PlayCircle className={`${className} text-amber-400 flex-shrink-0`} />;
    default:
      return <Circle className={`${className} text-white/20 flex-shrink-0`} />;
  }
}

// ── Due Date Badge ─────────────────────────────────────
function DueDateBadge({ dueDate, status }: { dueDate: string | null; status: TaskStatus }) {
  if (!dueDate || status === 'submitted' || status === 'approved') return null;
  const overdue = isOverdue(dueDate, status);
  const dueSoon = isDueSoon(dueDate, status);

  if (overdue) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-red-500/15 text-red-400 border border-red-500/20">
        <AlertTriangle className="w-2.5 h-2.5" /> Overdue
      </span>
    );
  }
  if (dueSoon) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20">
        <Clock className="w-2.5 h-2.5" /> Due soon
      </span>
    );
  }
  return null;
}

// ── Resource Helpers ───────────────────────────────────
function ResourceIcon({ kind, className = 'w-3 h-3' }: { kind: ResourceKind; className?: string }) {
  switch (kind) {
    case 'video': return <Video className={className} />;
    case 'concept': return <Lightbulb className={className} />;
    case 'tutorial': return <GraduationCap className={className} />;
    default: return <FileText className={className} />;
  }
}

function ResourceChips({ taskId, resourcesByTask, isAdmin, onAdd, onEdit, onDelete, onReorder }: {
  taskId: string;
  resourcesByTask: Map<string, TaskResource[]>;
  isAdmin: boolean;
  onAdd: (taskId: string) => void;
  onEdit: (resource: TaskResource) => void;
  onDelete: (id: string) => void;
  onReorder: (id: string, dir: 'up' | 'down') => void;
}) {
  const taskResources = resourcesByTask.get(taskId) || [];
  if (taskResources.length === 0 && !isAdmin) return null;

  return (
    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
      {taskResources.length > 0 && (
        <span className="text-[10px] text-white/30 flex items-center gap-1 flex-shrink-0">
          <BookMarked className="w-2.5 h-2.5" /> Learn
        </span>
      )}
      {taskResources.map((r, i) => {
        const isInternal = r.url.startsWith('/');
        const chipContent = (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-white/[0.05] border border-white/[0.08] text-white/60 hover:text-white/90 hover:border-white/15 transition-all">
            <ResourceIcon kind={r.kind} className="w-2.5 h-2.5" />
            {r.title}
            {!isInternal && <ExternalLink className="w-2 h-2 opacity-40" />}
          </span>
        );
        return (
          <span key={r.id} className="inline-flex items-center gap-0.5">
            {isInternal ? (
              <Link to={r.url}>{chipContent}</Link>
            ) : (
              <a href={r.url} target="_blank" rel="noopener noreferrer">{chipContent}</a>
            )}
            {isAdmin && (
              <span className="inline-flex items-center gap-0.5">
                {i > 0 && (
                  <button onClick={() => onReorder(r.id, 'up')} className="text-white/15 hover:text-white/50 transition-colors p-0.5">
                    <ChevronUp className="w-2.5 h-2.5" />
                  </button>
                )}
                {i < taskResources.length - 1 && (
                  <button onClick={() => onReorder(r.id, 'down')} className="text-white/15 hover:text-white/50 transition-colors p-0.5">
                    <ChevronDown className="w-2.5 h-2.5" />
                  </button>
                )}
                <button onClick={() => onEdit(r)} className="text-white/15 hover:text-white/50 transition-colors p-0.5">
                  <Edit3 className="w-2.5 h-2.5" />
                </button>
                <button onClick={() => onDelete(r.id)} className="text-white/15 hover:text-red-400 transition-colors p-0.5">
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </span>
            )}
          </span>
        );
      })}
      {isAdmin && (
        <button
          onClick={() => onAdd(taskId)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-white/[0.03] border border-dashed border-white/[0.12] text-white/30 hover:text-white/60 hover:border-white/20 transition-all"
        >
          <Plus className="w-2.5 h-2.5" /> Add
        </button>
      )}
    </div>
  );
}

function ResourceEditModal({ resource, taskId, onClose, onSave }: {
  resource: TaskResource | null;
  taskId: string;
  onClose: () => void;
  onSave: (data: { id?: string; task_id: string; title: string; url: string; kind: ResourceKind; sort_order: number }) => Promise<void>;
}) {
  const [title, setTitle] = useState(resource?.title || '');
  const [url, setUrl] = useState(resource?.url || '');
  const [kind, setKind] = useState<ResourceKind>(resource?.kind || 'doc');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) {
      setError('Title and URL are required.');
      return;
    }
    setSubmitting(true);
    setError('');
    await onSave({
      id: resource?.id,
      task_id: taskId,
      title: title.trim(),
      url: url.trim(),
      kind,
      sort_order: resource?.sort_order ?? 0,
    });
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1320] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <h3 className="text-sm font-bold text-white">{resource ? 'Edit resource' : 'Add resource'}</h3>
          <button onClick={onClose} className="p-1 text-white/40 hover:text-white/80 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-[10px] font-semibold text-white/40 uppercase tracking-wide mb-1.5">Title</label>
            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Resource title"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-blue-500/50 transition-all" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-white/40 uppercase tracking-wide mb-1.5">URL</label>
            <input type="text" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… or /concepts/…"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-blue-500/50 transition-all" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-white/40 uppercase tracking-wide mb-1.5">Type</label>
            <select value={kind} onChange={(e) => setKind(e.target.value as ResourceKind)}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all">
              <option value="doc">Documentation</option>
              <option value="video">Video</option>
              <option value="concept">Concept page</option>
              <option value="tutorial">Tutorial</option>
            </select>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg border border-white/10 text-white/50 text-xs hover:text-white/80 transition-all">Cancel</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold text-xs hover:from-blue-400 hover:to-cyan-400 disabled:opacity-60 transition-all">
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Auth Gate ──────────────────────────────────────────
function SignInGate({ onSignedIn, onForgotPassword }: { onSignedIn: () => void; onForgotPassword: () => void }) {
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
        <div className="flex items-center justify-between mt-4">
          <p className="text-[10px] text-white/25">
            Don't have an account? Contact your administrator for an invite.
          </p>
          <button onClick={onForgotPassword} className="text-[10px] text-cyan-400/60 hover:text-cyan-400 transition-colors">
            Forgot password?
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Forgot Password ────────────────────────────────────
function ForgotPassword({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const redirectTo = `${window.location.origin}/learn`;
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    // Always show the same message regardless of whether the email exists
    setSent(true);
    setLoading(false);
  };

  return (
    <div className="pt-20 min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white mb-1">Reset password</h1>
          <p className="text-sm text-white/40">Enter your email and we'll send a reset link</p>
        </div>
        {sent ? (
          <div className="rounded-xl border border-green-500/20 bg-green-500/[0.04] p-4 text-center">
            <Check className="w-5 h-5 text-green-400 mx-auto mb-2" />
            <p className="text-sm text-white/70 leading-relaxed">
              If that email has an account, a reset link is on its way.
            </p>
            <p className="text-[10px] text-white/30 mt-2">Check your inbox and spam folder.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
              className="w-full px-4 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-blue-500/50 transition-all" />
            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold text-sm hover:from-blue-400 hover:to-cyan-400 disabled:opacity-60 transition-all">
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}
        <button onClick={onBack} className="mt-4 text-[10px] text-white/30 hover:text-white/60 transition-colors mx-auto block">
          Back to sign in
        </button>
      </div>
    </div>
  );
}

// ── Reset Password (after recovery link) ───────────────
function ResetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }
    setLoading(false);
    onDone();
  };

  return (
    <div className="pt-20 min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-400 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white mb-1">Set new password</h1>
          <p className="text-sm text-white/40">Choose a new password for your account</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password"
            className="w-full px-4 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-blue-500/50 transition-all" />
          <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password"
            className="w-full px-4 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-blue-500/50 transition-all" />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold text-sm hover:from-green-400 hover:to-emerald-400 disabled:opacity-60 transition-all">
            {loading ? 'Saving…' : 'Set new password'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Change Password (for signed-in users) ──────────────
function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }
    setLoading(false);
    setSuccess(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d1320] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
              <KeyRound className="w-4 h-4 text-cyan-300" />
            </div>
            <h3 className="text-sm font-bold text-white">Change password</h3>
          </div>
          <button onClick={onClose} className="p-1 text-white/40 hover:text-white/80 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          {success ? (
            <div className="text-center py-4">
              <Check className="w-6 h-6 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-white/70">Your password has been updated.</p>
              <button onClick={onClose} className="mt-4 px-4 py-2 rounded-lg border border-white/10 text-white/60 text-xs hover:text-white/90 transition-all">
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <input type="password" required value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="New password (min 8 characters)"
                className="w-full px-4 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-blue-500/50 transition-all" />
              <input type="password" required value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(''); }}
                placeholder="Confirm new password"
                className="w-full px-4 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-blue-500/50 transition-all" />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold text-sm hover:from-blue-400 hover:to-cyan-400 disabled:opacity-60 transition-all">
                {loading ? 'Saving…' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Task Complete Modal ────────────────────────────────
function TaskCompleteModal({ task, computedDueDate, existingProgress, onClose, onSubmit, learnerId, existingAttachments, onRemoveAttachment }: {
  task: Task;
  computedDueDate: string | null;
  existingProgress: ProgressRow | undefined;
  onClose: () => void;
  onSubmit: (note: string, link: string, pendingFiles: PendingFile[]) => Promise<void>;
  learnerId: string;
  existingAttachments: AttachmentRow[];
  onRemoveAttachment: (att: AttachmentRow) => void;
}) {
  const [note, setNote] = useState(existingProgress?.completion_note || '');
  const [link, setLink] = useState(existingProgress?.link || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const isApproved = existingProgress?.status === 'approved';

  const isEdit = existingProgress?.status === 'submitted';
  const isResubmit = existingProgress?.status === 'changes_requested';
  const titleText = isResubmit ? 'Resubmit task' : isEdit ? 'Edit submission' : 'Mark complete';
  const buttonText = isResubmit ? 'Resubmit' : isEdit ? 'Save changes' : 'Submit for review';
  const minChars = 30;
  const charCount = note.trim().length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (charCount < minChars) {
      setError(`Please write at least ${minChars} characters describing what you did.`);
      return;
    }
    setSubmitting(true);
    setError('');
    await onSubmit(note.trim(), link.trim(), pendingFiles);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d1320] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
              <ClipboardCheck className="w-4 h-4 text-cyan-400" />
            </div>
            <h3 className="text-sm font-bold text-white">{titleText}</h3>
          </div>
          <button onClick={onClose} className="p-1 text-white/40 hover:text-white/80 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
            <p className="text-sm font-semibold text-white">{task.title}</p>
            {task.description && <p className="text-xs text-white/40 mt-0.5">{task.description}</p>}
            {computedDueDate && (
              <p className="text-[10px] text-white/30 mt-1 flex items-center gap-1">
                <Calendar className="w-2.5 h-2.5" /> Due {formatDueDate(computedDueDate)}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-white/40 uppercase tracking-wide mb-1.5">
              What I did <span className="text-red-400">*</span>
            </label>
            <textarea
              required
              value={note}
              onChange={(e) => { setNote(e.target.value); setError(''); }}
              rows={4}
              placeholder="Describe what you did for this task…"
              className="w-full px-3 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-blue-500/50 transition-all resize-none"
            />
            <p className={`text-[10px] mt-1 ${charCount >= minChars ? 'text-green-400/60' : 'text-white/30'}`}>
              {charCount}/{minChars} characters minimum
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-white/40 uppercase tracking-wide mb-1.5">
              Link <span className="text-white/20">(optional)</span>
            </label>
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
              <input
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="GitHub commit, deployed URL, screenshot, doc…"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-blue-500/50 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-white/40 uppercase tracking-wide mb-1.5">
              Attachments <span className="text-white/20">(optional — up to 5 files, 10 MB each)</span>
            </label>
            <AttachmentDropzone
              pendingFiles={pendingFiles}
              onAddFiles={(files) => setPendingFiles((prev) => [...prev, ...files].slice(0, 5))}
              onRemoveFile={(i) => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
              existingAttachments={existingAttachments}
              onRemoveExisting={isApproved ? undefined : (id) => {
                const att = existingAttachments.find((a) => a.id === id);
                if (att) onRemoveAttachment(att);
              }}
              disabled={isApproved}
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/[0.08] border border-red-500/15 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-3 py-2 rounded-lg border border-white/10 text-white/50 text-xs hover:text-white/80 transition-all">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold text-xs hover:from-blue-400 hover:to-cyan-400 disabled:opacity-60 transition-all">
              {submitting ? 'Submitting…' : buttonText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Request Changes Modal ──────────────────────────────
function RequestChangesModal({ taskTitle, onClose, onSubmit }: {
  taskTitle: string;
  onClose: () => void;
  onSubmit: (comment: string) => Promise<void>;
}) {
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (comment.trim().length < 5) {
      setError('Please provide a comment explaining what needs to change.');
      return;
    }
    setSubmitting(true);
    setError('');
    await onSubmit(comment.trim());
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1320] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-red-400" />
            </div>
            <h3 className="text-sm font-bold text-white">Request changes</h3>
          </div>
          <button onClick={onClose} className="p-1 text-white/40 hover:text-white/80 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <p className="text-xs text-white/40">{taskTitle}</p>
          <div>
            <label className="block text-[10px] font-semibold text-white/40 uppercase tracking-wide mb-1.5">
              Comment <span className="text-red-400">*</span>
            </label>
            <textarea
              required
              value={comment}
              onChange={(e) => { setComment(e.target.value); setError(''); }}
              rows={4}
              placeholder="Explain what needs to change before this can be approved…"
              className="w-full px-3 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-red-500/50 transition-all resize-none"
            />
          </div>
          {error && (
            <p className="text-xs text-red-400 bg-red-500/[0.08] border border-red-500/15 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-3 py-2 rounded-lg border border-white/10 text-white/50 text-xs hover:text-white/80 transition-all">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="px-4 py-2 rounded-lg bg-red-500/80 text-white font-semibold text-xs hover:bg-red-500 disabled:opacity-60 transition-all">
              {submitting ? 'Sending…' : 'Request changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Learner Dashboard ──────────────────────────────────
function LearnerDashboard({
  track, weeks, tasks, progress, onSubmitTask, fullName, readOnly = false,
  journalEntries, onJumpToJournal, startDate, resources, isAdmin = false,
  onAddResource, onUpdateResource, onDeleteResource, onReorderResource,
  learnerId, quizAttempts = [], interviewPractice = [], onQuizPassed, onNewInterviewAttempt,
  manualUnlocks, onWeekCompleted,
}: {
  track: Track;
  weeks: Week[];
  tasks: Task[];
  progress: Map<string, ProgressRow>;
  onSubmitTask: (taskId: string, note: string, link: string, coachFeedback?: CoachFeedback, coachAnswer?: string, pendingFiles?: PendingFile[]) => Promise<void>;
  fullName: string;
  readOnly?: boolean;
  learnerId: string;
  journalEntries: JournalEntry[];
  onJumpToJournal: () => void;
  startDate: string | null;
  resources: TaskResource[];
  isAdmin?: boolean;
  onAddResource?: (taskId: string, title: string, url: string, kind: ResourceKind, sortOrder: number) => Promise<void>;
  onUpdateResource?: (id: string, title: string, url: string, kind: ResourceKind) => Promise<void>;
  onDeleteResource?: (id: string) => Promise<void>;
  onReorderResource?: (id: string, dir: 'up' | 'down') => Promise<void>;
  quizAttempts?: QuizAttempt[];
  interviewPractice?: InterviewPracticeRow[];
  onQuizPassed?: () => void;
  onNewInterviewAttempt?: () => void;
  manualUnlocks?: Set<string>;
  onWeekCompleted?: (weekNumber: number) => void;
}) {
  const sortedWeeks = [...weeks].sort((a, b) => a.week_number - b.week_number);
  const totalTasks = tasks.length;
  const approvedCount = Array.from(progress.values()).filter((p) => p.status === 'approved').length;
  const submittedCount = Array.from(progress.values()).filter((p) => p.status === 'submitted').length;
  const pct = totalTasks > 0 ? Math.round((approvedCount / totalTasks) * 100) : 0;

  const taskDueDates = useMemo(() => buildTaskDueDates(startDate, weeks, tasks), [startDate, weeks, tasks]);
  const weekRanges = useMemo(() => buildWeekRanges(startDate, weeks), [startDate, weeks]);

  let overdueCount = 0;
  let dueThisWeekCount = 0;
  for (const task of tasks) {
    const p = progress.get(task.id);
    const status = p?.status || 'not_started';
    const dd = taskDueDates.get(task.id) || null;
    if (isOverdue(dd, status)) overdueCount++;
    if (isDueThisWeek(dd, status)) dueThisWeekCount++;
  }

  const resourcesByTask = useMemo(() => {
    const map = new Map<string, TaskResource[]>();
    for (const r of resources) {
      if (!map.has(r.task_id)) map.set(r.task_id, []);
      map.get(r.task_id)!.push(r);
    }
    for (const [, list] of map) list.sort((a, b) => a.sort_order - b.sort_order);
    return map;
  }, [resources]);

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [resourceEditFor, setResourceEditFor] = useState<{ taskId: string; resource: TaskResource | null } | null>(null);
  const [coachModal, setCoachModal] = useState<{ task: Task; note: string; link: string } | null>(null);
  const [celebrationWeek, setCelebrationWeek] = useState<number | null>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [taskAttachments, setTaskAttachments] = useState<AttachmentRow[]>([]);
  const entryCountByWeek = getEntryCountByWeek(journalEntries);

  const unlockSet = manualUnlocks || new Set<string>();
  const streak = useMemo(() => computeStreak(weeks, tasks, progress, startDate), [weeks, tasks, progress, startDate]);
  const badges = useMemo(() => computeBadges(weeks, tasks, progress, quizAttempts), [weeks, tasks, progress, quizAttempts]);

  // Fetch attachments for all submitted tasks
  useEffect(() => {
    const progressIds = Array.from(progress.values()).filter((p) => p.id && p.id !== 'temp').map((p) => p.id);
    if (progressIds.length === 0) { setTaskAttachments([]); return; }
    fetchAttachments(progressIds).then(setTaskAttachments);
  }, [progress]);

  // Track which weeks were previously incomplete to detect completion
  const prevWeekCompleteRef = useState<Set<number>>(new Set())[0];
  useEffect(() => {
    const sortedWeeks = [...weeks].sort((a, b) => a.week_number - b.week_number);
    const nowComplete = new Set<number>();
    for (const week of sortedWeeks) {
      const weekTasks = tasks.filter((t) => t.week_id === week.id);
      if (weekTasks.length > 0 && weekTasks.every((t) => progress.get(t.id)?.status === 'approved')) {
        nowComplete.add(week.week_number);
      }
    }
    // Check if any week just became complete that wasn't before
    for (const wn of nowComplete) {
      if (!prevWeekCompleteRef.has(wn) && !readOnly) {
        setCelebrationWeek(wn);
        break;
      }
    }
    // Update ref — we use a mutable ref pattern
    (prevWeekCompleteRef as Set<number>).clear();
    nowComplete.forEach((n) => (prevWeekCompleteRef as Set<number>).add(n));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, weeks, tasks, readOnly]);

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
        {startDate && !readOnly && (
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-white/35">
            <CalendarDays className="w-3 h-3" /> Started {formatDueDate(startDate)}
          </div>
        )}
      </div>

      {/* Summary counts */}
      {!readOnly && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className={`rounded-xl border p-4 ${overdueCount > 0 ? 'border-red-500/20 bg-red-500/[0.04]' : 'border-white/[0.08] bg-white/[0.02]'}`}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className={`w-3.5 h-3.5 ${overdueCount > 0 ? 'text-red-400' : 'text-white/25'}`} />
              <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wide">Overdue</span>
            </div>
            <p className={`text-2xl font-bold ${overdueCount > 0 ? 'text-red-400' : 'text-white/50'}`}>{overdueCount}</p>
          </div>
          <div className={`rounded-xl border p-4 ${dueThisWeekCount > 0 ? 'border-amber-500/20 bg-amber-500/[0.04]' : 'border-white/[0.08] bg-white/[0.02]'}`}>
            <div className="flex items-center gap-2 mb-1">
              <Hourglass className={`w-3.5 h-3.5 ${dueThisWeekCount > 0 ? 'text-amber-400' : 'text-white/25'}`} />
              <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wide">Due this week</span>
            </div>
            <p className={`text-2xl font-bold ${dueThisWeekCount > 0 ? 'text-amber-400' : 'text-white/50'}`}>{dueThisWeekCount}</p>
          </div>
          <div className={`rounded-xl border p-4 ${submittedCount > 0 ? 'border-cyan-500/20 bg-cyan-500/[0.04]' : 'border-white/[0.08] bg-white/[0.02]'}`}>
            <div className="flex items-center gap-2 mb-1">
              <ClipboardCheck className={`w-3.5 h-3.5 ${submittedCount > 0 ? 'text-cyan-400' : 'text-white/25'}`} />
              <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wide">Awaiting review</span>
            </div>
            <p className={`text-2xl font-bold ${submittedCount > 0 ? 'text-cyan-400' : 'text-white/50'}`}>{submittedCount}</p>
          </div>
        </div>
      )}

      {/* Streak + Badges */}
      {!readOnly && (
        <StreakBadgesSection streak={streak} badges={badges} />
      )}

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
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-400" /> {approvedCount} approved</span>
          {submittedCount > 0 && <span className="flex items-center gap-1"><Send className="w-3 h-3 text-cyan-400" /> {submittedCount} awaiting review</span>}
          <span className="flex items-center gap-1"><Circle className="w-3 h-3 text-white/30" /> {totalTasks - approvedCount - submittedCount} remaining</span>
        </div>
      </div>

      {/* Week cards */}
      <div className="space-y-4">
        {sortedWeeks.map((week) => {
          const weekTasks = tasks.filter((t) => t.week_id === week.id).sort((a, b) => a.sort_order - b.sort_order);
          const weekApproved = weekTasks.filter((t) => progress.get(t.id)?.status === 'approved').length;
          const weekPct = weekTasks.length > 0 ? Math.round((weekApproved / weekTasks.length) * 100) : 0;
          const wr = weekRanges.get(week.id);
          const current = isCurrentWeek(wr);
          const weekResourceCount = weekTasks.reduce((sum, t) => sum + (resourcesByTask.get(t.id)?.length || 0), 0);
          const unlockInfo = computeWeekUnlock(week, weeks, tasks, progress, quizAttempts, unlockSet);
          const isLocked = unlockInfo.locked && !readOnly;

          return (
            <div
              key={week.id}
              className={`rounded-xl border overflow-hidden transition-all ${
                isLocked ? 'border-white/[0.04] bg-white/[0.01] opacity-60' :
                current ? 'border-blue-500/40 bg-blue-500/[0.03] shadow-lg shadow-blue-500/5' : 'border-white/[0.08] bg-white/[0.02]'
              }`}
            >
              {/* Week header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.05]">
                <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                  isLocked ? 'bg-white/[0.03] text-white/20' :
                  current ? 'bg-blue-500/20 text-blue-300' : 'bg-white/[0.05] text-white/40'
                }`}>
                  {isLocked ? <Lock className="w-3.5 h-3.5" /> : week.week_number}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm font-bold ${isLocked ? 'text-white/40' : 'text-white'}`}>{week.title}</h3>
                  {week.goal && <p className={`text-xs mt-0.5 ${isLocked ? 'text-white/25' : 'text-white/40'}`}>{week.goal}</p>}
                  {isLocked && unlockInfo.reason && (
                    <p className="text-[10px] text-white/30 mt-0.5 flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> {unlockInfo.reason}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {wr && (
                    <span className="hidden sm:flex items-center gap-1 text-[10px] text-white/30">
                      <Calendar className="w-2.5 h-2.5" />
                      {formatDateRange(wr.start, wr.end)}
                    </span>
                  )}
                  {current && !isLocked && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      Current
                    </span>
                  )}
                  <span className={`text-xs font-semibold ${weekPct === 100 ? 'text-green-400' : 'text-white/40'}`}>
                    {weekApproved}/{weekTasks.length}
                  </span>
                  {weekResourceCount > 0 && (
                    <span className="flex items-center gap-1 text-[10px] text-white/30">
                      <BookMarked className="w-2.5 h-2.5" /> {weekResourceCount}
                    </span>
                  )}
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

              {/* Task list */}
              <div className="px-5 py-3">
                {weekTasks.length === 0 ? (
                  <p className="text-xs text-white/30 py-2">No tasks for this week yet.</p>
                ) : (
                  <div className="space-y-2">
                    {weekTasks.map((task) => {
                      const p = progress.get(task.id);
                      const status = p?.status || 'not_started';
                      const dd = taskDueDates.get(task.id) || null;
                      const daysLate = p?.submitted_at && dd ? getDaysLate(dd, p.submitted_at) : 0;

                      return (
                        <div
                          key={task.id}
                          className="rounded-lg px-3 py-3 transition-all"
                        >
                          <div className="flex items-start gap-3">
                            <span className="flex-shrink-0 mt-0.5">
                              <StatusIcon status={status} />
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm leading-snug ${
                                status === 'approved' ? 'text-white/40 line-through' : 'text-white/80'
                              }`}>{task.title}</p>
                              {task.description && (
                                <p className="text-xs text-white/35 mt-0.5 leading-relaxed">{task.description}</p>
                              )}

                              {/* Due date + badges */}
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                {dd && (
                                  <span className="text-[10px] text-white/30 flex items-center gap-1">
                                    <Calendar className="w-2.5 h-2.5" /> Due {formatDueDate(dd)}
                                  </span>
                                )}
                                <DueDateBadge dueDate={dd} status={status} />
                                <StatusBadge status={status} reviewedAt={p?.reviewed_at} />
                              </div>

                              {/* Learning resources */}
                              <ResourceChips
                                taskId={task.id}
                                resourcesByTask={resourcesByTask}
                                isAdmin={isAdmin}
                                onAdd={(tid) => setResourceEditFor({ taskId: tid, resource: null })}
                                onEdit={(r) => setResourceEditFor({ taskId: r.task_id, resource: r })}
                                onDelete={(id) => onDeleteResource?.(id)}
                                onReorder={(id, dir) => onReorderResource?.(id, dir)}
                              />

                              {/* Submitted: show note, link, late flag */}
                              {(status === 'submitted' || status === 'approved' || status === 'changes_requested') && p?.completion_note && (
                                <div className="mt-2 rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 space-y-1.5">
                                  <div className="flex items-start gap-2">
                                    <FileText className="w-3 h-3 text-white/30 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap">{p.completion_note}</p>
                                  </div>
                                  {p.link && (
                                    <a href={p.link} target="_blank" rel="noopener noreferrer"
                                       className="flex items-center gap-1.5 text-[11px] text-cyan-400/70 hover:text-cyan-400 transition-colors">
                                      <Link2 className="w-3 h-3" /> {p.link}
                                    </a>
                                  )}
                                  {taskAttachments.filter((a) => a.progress_id === p.id).length > 0 && (
                                    <AttachmentGallery attachments={taskAttachments.filter((a) => a.progress_id === p.id)} />
                                  )}
                                  {p.submitted_at && (
                                    <p className="text-[10px] text-white/30 flex items-center gap-1">
                                      <Send className="w-2.5 h-2.5" />
                                      Submitted {formatSubmittedDate(p.submitted_at)}
                                      {daysLate > 0 && <span className="text-red-400/80 ml-1">({daysLate} {daysLate === 1 ? 'day' : 'days'} late)</span>}
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Changes requested: show review comment */}
                              {status === 'changes_requested' && p?.review_comment && (
                                <div className="mt-2 rounded-lg bg-red-500/[0.06] border border-red-500/15 p-3">
                                  <div className="flex items-start gap-2">
                                    <MessageSquare className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                      <p className="text-[10px] font-semibold text-red-400/80 uppercase tracking-wide mb-1">Review feedback</p>
                                      <p className="text-xs text-white/60 leading-relaxed">{p.review_comment}</p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Action buttons */}
                              {!readOnly && !isLocked && status !== 'approved' && status !== 'submitted' && (
                                <button
                                  onClick={() => setActiveTask(task)}
                                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/25 text-blue-300 text-xs font-semibold hover:bg-blue-500/25 transition-all"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  {status === 'changes_requested' ? 'Resubmit' : 'Mark complete'}
                                </button>
                              )}
                              {!readOnly && !isLocked && status === 'submitted' && (
                                <button
                                  onClick={() => setActiveTask(task)}
                                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-white/50 text-xs font-semibold hover:text-white/80 hover:bg-white/[0.08] transition-all"
                                >
                                  <Edit3 className="w-3.5 h-3.5" /> Edit note
                                </button>
                              )}
                              {readOnly && status === 'changes_requested' && p?.review_comment && (
                                <p className="text-[10px] text-red-400/60 mt-1">Changes requested — learner can resubmit.</p>
                              )}

                              {/* Coach feedback display for submitted/approved/changes_requested */}
                              {(status === 'submitted' || status === 'approved' || status === 'changes_requested') && p?.coach_feedback && (
                                <div className="mt-2 rounded-lg bg-violet-500/[0.06] border border-violet-500/15 p-3 space-y-1.5">
                                  <p className="text-[10px] font-semibold text-violet-300/80 uppercase tracking-wide">AI Coach Feedback</p>
                                  <p className="text-xs text-white/60 leading-relaxed">{p.coach_feedback}</p>
                                  {p.coach_question && (
                                    <div className="pt-1">
                                      <p className="text-[10px] text-violet-300/60 uppercase tracking-wide">Follow-up question</p>
                                      <p className="text-xs text-white/50 leading-relaxed">{p.coach_question}</p>
                                    </div>
                                  )}
                                  {p.coach_answer && (
                                    <div className="pt-1">
                                      <p className="text-[10px] text-green-400/60 uppercase tracking-wide">Your answer</p>
                                      <p className="text-xs text-white/50 leading-relaxed">{p.coach_answer}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Knowledge Check card */}
              {!readOnly && !isLocked && quizAttempts && onQuizPassed && (
                <div className="px-5 pb-3">
                  <KnowledgeCheckCard
                    week={week}
                    weekTasks={weekTasks}
                    resources={resources}
                    learnerId={learnerId}
                    onPassed={onQuizPassed}
                    quizAttempts={quizAttempts}
                  />
                </div>
              )}

              {/* Interview Practice card (Week 3 onward) */}
              {!readOnly && !isLocked && interviewPractice && onNewInterviewAttempt && week.week_number >= 3 && (
                <div className="px-5 pb-3">
                  <InterviewPracticeCard
                    learnerId={learnerId}
                    journalEntries={journalEntries}
                    approvedTasks={tasks
                      .filter((t) => progress.get(t.id)?.status === 'approved' && t.week_id !== week.id)
                      .map((t) => ({ title: t.title, completion_note: progress.get(t.id)?.completion_note || '' }))}
                    interviewHistory={interviewPractice}
                    onNewAttempt={onNewInterviewAttempt}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Resource edit modal */}
      {resourceEditFor && (
        <ResourceEditModal
          resource={resourceEditFor.resource}
          taskId={resourceEditFor.taskId}
          onClose={() => setResourceEditFor(null)}
          onSave={async (data) => {
            if (data.id) {
              await onUpdateResource?.(data.id, data.title, data.url, data.kind);
            } else {
              await onAddResource?.(data.task_id, data.title, data.url, data.kind, data.sort_order);
            }
            setResourceEditFor(null);
          }}
        />
      )}

      {/* Task completion modal */}
      {activeTask && !coachModal && (
        <TaskCompleteModal
          task={activeTask}
          computedDueDate={taskDueDates.get(activeTask.id) || null}
          existingProgress={progress.get(activeTask.id)}
          learnerId={learnerId}
          existingAttachments={taskAttachments.filter((a) => a.progress_id === progress.get(activeTask.id)?.id)}
          onRemoveAttachment={async (att) => {
            await deleteAttachment(att);
            setTaskAttachments((prev) => prev.filter((a) => a.id !== att.id));
          }}
          onClose={() => setActiveTask(null)}
          onSubmit={async (note, link, files) => {
            setPendingFiles(files);
            if (!readOnly) {
              setCoachModal({ task: activeTask, note, link });
            } else {
              await onSubmitTask(activeTask.id, note, link, undefined, undefined, files);
              setActiveTask(null);
            }
          }}
        />
      )}

      {/* Coach feedback modal */}
      {coachModal && (
        <CoachFeedbackModal
          task={coachModal.task}
          resources={resourcesByTask.get(coachModal.task.id) || []}
          existingProgress={progress.get(coachModal.task.id)}
          learnerNote={coachModal.note}
          learnerLink={coachModal.link}
          attachmentFileNames={pendingFiles.map((pf) => pf.file.name)}
          onClose={() => {
            setCoachModal(null);
            setActiveTask(null);
          }}
          onComplete={async (feedback: CoachFeedback, answer: string) => {
            await onSubmitTask(coachModal.task.id, coachModal.note, coachModal.link, feedback, answer, pendingFiles);
            setCoachModal(null);
            setActiveTask(null);
            setPendingFiles([]);
          }}
          onSkipWithoutFeedback={async () => {
            await onSubmitTask(coachModal.task.id, coachModal.note, coachModal.link, undefined, undefined, pendingFiles);
            setCoachModal(null);
            setActiveTask(null);
            setPendingFiles([]);
          }}
        />
      )}

      {celebrationWeek !== null && (
        <CelebrationOverlay weekNumber={celebrationWeek} onClose={() => {
          setCelebrationWeek(null);
          onWeekCompleted?.(celebrationWeek);
        }} />
      )}
    </div>
  );
}

// ── Invite Learner Modal ─────────────────────────────
function InviteLearnerModal({ onClose, onInvited }: {
  onClose: () => void;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !fullName.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { setError('Not authenticated.'); setSubmitting(false); return; }

      const funcUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-learner`;
      const resp = await fetch(funcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email: email.trim(), full_name: fullName.trim() }),
      });
      const result = await resp.json();
      if (!resp.ok) {
        setError(result.error || `Request failed (${resp.status})`);
      } else {
        setSuccessMsg(result.message || 'Invite email sent.');
        setSuccess(true);
        setTimeout(() => { onInvited(); onClose(); }, 2000);
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1320] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-cyan-400" />
            </div>
            <h3 className="text-sm font-bold text-white">Invite Learner</h3>
          </div>
          <button onClick={onClose} className="p-1 text-white/40 hover:text-white/80 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="px-5 py-10 text-center">
            <div className="w-12 h-12 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4">
              <Check className="w-6 h-6 text-green-400" />
            </div>
            <p className="text-sm font-semibold text-white mb-1">{successMsg.includes('Existing') ? 'Learner updated' : 'Invite sent!'}</p>
            <p className="text-xs text-white/40">{successMsg.includes('Existing') ? successMsg : `An email has been sent to ${email.trim()} with a link to set up their account.`}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            <div>
              <label className="block text-[10px] font-semibold text-white/40 uppercase tracking-wide mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="learner@example.com"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-blue-500/50 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-white/40 uppercase tracking-wide mb-1.5">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full px-3 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-blue-500/50 transition-all"
              />
            </div>
            {error && (
              <p className="text-xs text-red-400 bg-red-500/[0.08] border border-red-500/15 rounded-lg px-3 py-2">{error}</p>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={onClose}
                className="px-3 py-2 rounded-lg border border-white/10 text-white/50 text-xs hover:text-white/80 transition-all">
                Cancel
              </button>
              <button type="submit" disabled={submitting}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold text-xs hover:from-blue-400 hover:to-cyan-400 disabled:opacity-60 transition-all">
                {submitting ? 'Sending invite…' : 'Send invite'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Admin Learner Detail Tabs ──────────────────────────
function LearnerDetailTabs({
  selectedLearner, selectedLearnerInfo, weeks, tasks, learnerProgress, adminId,
  onApproveTask, onRequestChanges, onUpdateStartDate,
  resources, onAddResource, onUpdateResource, onDeleteResource, onReorderResource,
  learnerQuizAttempts, learnerInterviewPractice, learnerJournalEntries,
  adminManualUnlocks, onUnlockChanged,
}: {
  selectedLearner: string;
  selectedLearnerInfo: LearnerInfo;
  weeks: Week[];
  tasks: Task[];
  learnerProgress: ProgressRow[];
  adminId: string;
  learnerJournalEntries: JournalEntry[];
  adminManualUnlocks: Set<string>;
  onApproveTask: (progressId: string) => Promise<void>;
  onRequestChanges: (progressId: string, comment: string) => Promise<void>;
  onUpdateStartDate: (learnerId: string, startDate: string) => Promise<void>;
  resources: TaskResource[];
  onAddResource: (taskId: string, title: string, url: string, kind: ResourceKind, sortOrder: number) => Promise<void>;
  onUpdateResource: (id: string, title: string, url: string, kind: ResourceKind) => Promise<void>;
  onDeleteResource: (id: string) => Promise<void>;
  onReorderResource: (id: string, dir: 'up' | 'down') => Promise<void>;
  learnerQuizAttempts: QuizAttempt[];
  learnerInterviewPractice: InterviewPracticeRow[];
  onUnlockChanged: () => void;
}) {
  const hasJournal = !!selectedLearnerInfo.latestEntryDate;
  const hasAwaitingReview = learnerProgress.some((p) => p.status === 'submitted');
  const [detailTab, setDetailTab] = useState<'progress' | 'journal' | 'coach'>('progress');
  useEffect(() => {
    if (hasAwaitingReview) {
      setDetailTab('progress');
    } else if (detailTab === 'progress' && hasJournal && !hasAwaitingReview) {
      setDetailTab('journal');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAwaitingReview, hasJournal]);
  const [requestChangesFor, setRequestChangesFor] = useState<ProgressRow | null>(null);
  const [startDateInput, setStartDateInput] = useState(selectedLearnerInfo.startDate || '');
  const [resourceEditFor, setResourceEditFor] = useState<{ taskId: string; resource: TaskResource | null } | null>(null);
  const [showInterviewPreview, setShowInterviewPreview] = useState(false);
  const [showSessionPrep, setShowSessionPrep] = useState(false);
  const [adminTaskAttachments, setAdminTaskAttachments] = useState<AttachmentRow[]>([]);
  const progressMap = new Map(learnerProgress.map((p) => [p.task_id, p]));
  const sortedWeeks = [...weeks].sort((a, b) => a.week_number - b.week_number);
  const adminBadges = useMemo(() => computeBadges(weeks, tasks, progressMap, learnerQuizAttempts), [weeks, tasks, progressMap, learnerQuizAttempts]);
  const adminStreak = useMemo(() => computeStreak(weeks, tasks, progressMap, selectedLearnerInfo.startDate), [weeks, tasks, progressMap, selectedLearnerInfo.startDate]);

  const taskDueDates = useMemo(
    () => buildTaskDueDates(selectedLearnerInfo.startDate, weeks, tasks),
    [selectedLearnerInfo.startDate, weeks, tasks],
  );
  const weekRanges = useMemo(
    () => buildWeekRanges(selectedLearnerInfo.startDate, weeks),
    [selectedLearnerInfo.startDate, weeks],
  );
  const resourcesByTask = useMemo(() => {
    const map = new Map<string, TaskResource[]>();
    for (const r of resources) {
      if (!map.has(r.task_id)) map.set(r.task_id, []);
      map.get(r.task_id)!.push(r);
    }
    for (const [, list] of map) list.sort((a, b) => a.sort_order - b.sort_order);
    return map;
  }, [resources]);

  const approvedCount = learnerProgress.filter((p) => p.status === 'approved').length;
  const submittedCount = learnerProgress.filter((p) => p.status === 'submitted').length;
  const pct = tasks.length > 0 ? Math.round((approvedCount / tasks.length) * 100) : 0;

  useEffect(() => {
    const progressIds = learnerProgress.filter((p) => p.id).map((p) => p.id);
    if (progressIds.length === 0) { setAdminTaskAttachments([]); return; }
    fetchAttachments(progressIds).then(setAdminTaskAttachments);
  }, [learnerProgress]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24">
      <div className="flex items-center gap-3 mb-2">
        <Users className="w-4 h-4 text-cyan-400" />
        <h1 className="text-xl font-bold text-white">{selectedLearnerInfo.fullName}</h1>
      </div>
      <p className="text-sm text-white/40 mb-4">
        {approvedCount} of {tasks.length} tasks approved ({pct}%){submittedCount > 0 && ` · ${submittedCount} awaiting review`}
        {selectedLearnerInfo.overdueCount > 0 && <span className="text-red-400"> · {selectedLearnerInfo.overdueCount} overdue</span>}
      </p>

      {/* Start date editor */}
      <div className="flex items-center gap-3 mb-4 rounded-lg bg-white/[0.03] border border-white/[0.06] px-4 py-3">
        <CalendarDays className="w-4 h-4 text-white/40" />
        <span className="text-xs font-semibold text-white/40 uppercase tracking-wide">Start date</span>
        <input
          type="date"
          value={startDateInput}
          onChange={(e) => setStartDateInput(e.target.value)}
          onBlur={() => {
            if (startDateInput !== (selectedLearnerInfo.startDate || '')) {
              onUpdateStartDate(selectedLearner, startDateInput);
            }
          }}
          className="bg-white/[0.05] border border-white/10 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-blue-500/50 transition-all"
        />
        {selectedLearnerInfo.startDate && (
          <span className="text-[10px] text-white/30">Weeks run from this date</span>
        )}
      </div>

      {/* Progress bar */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 mb-6">
        <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Streak + Badges + Session prep */}
      <div className="mb-6">
        <StreakBadgesSection streak={adminStreak} badges={adminBadges} compact />
        <button
          onClick={() => setShowSessionPrep(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-500/15 to-cyan-500/15 border border-blue-500/25 text-cyan-300 text-xs font-semibold hover:from-blue-500/25 hover:to-cyan-500/25 transition-all"
        >
          <ClipboardList className="w-3.5 h-3.5" /> Prep for session
        </button>
      </div>

      {/* Tab toggle */}
      <div className="inline-flex items-center gap-0.5 rounded-lg bg-white/[0.04] border border-white/[0.08] p-0.5 mb-6">
        <button
          onClick={() => setDetailTab('progress')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            detailTab === 'progress' ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white/70'
          }`}
        >
          <ListChecks className="w-3.5 h-3.5" /> Progress
        </button>
        <button
          onClick={() => setDetailTab('journal')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            detailTab === 'journal' ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white/70'
          }`}
        >
          <NotebookPen className="w-3.5 h-3.5" /> Journal
        </button>
        <button
          onClick={() => setDetailTab('coach')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            detailTab === 'coach' ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white/70'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" /> Coach
        </button>
      </div>

      {detailTab === 'progress' ? (
        <div className="space-y-4">
          {sortedWeeks.map((week) => {
            const weekTasks = tasks.filter((t) => t.week_id === week.id).sort((a, b) => a.sort_order - b.sort_order);
            const weekApproved = weekTasks.filter((t) => progressMap.get(t.id)?.status === 'approved').length;
            const wr = weekRanges.get(week.id);
            const weekResourceCount = weekTasks.reduce((sum, t) => sum + (resourcesByTask.get(t.id)?.length || 0), 0);
            const weekQuizAttempts = learnerQuizAttempts.filter((a) => a.week_id === week.id);
            return (
              <div key={week.id} className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.05]">
                  <div className="w-7 h-7 rounded-lg bg-white/[0.05] flex items-center justify-center text-[10px] font-bold text-white/40">
                    {week.week_number}
                  </div>
                  <h3 className="text-sm font-bold text-white flex-1">{week.title}</h3>
                  {wr && (
                    <span className="text-[10px] text-white/30 flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" /> {formatDateRange(wr.start, wr.end)}
                    </span>
                  )}
                  <span className="text-xs font-semibold text-white/40">{weekApproved}/{weekTasks.length}</span>
                  {weekResourceCount > 0 && (
                    <span className="flex items-center gap-1 text-[10px] text-white/30">
                      <BookMarked className="w-2.5 h-2.5" /> {weekResourceCount}
                    </span>
                  )}
                  <AdminUnlockButton
                    learnerId={selectedLearner}
                    weekId={week.id}
                    weekNumber={week.week_number}
                    isUnlocked={computeWeekUnlock(week, weeks, tasks, progressMap, learnerQuizAttempts, adminManualUnlocks).locked === false}
                    onUnlocked={onUnlockChanged}
                  />
                </div>
                <div className="px-5 py-2 divide-y divide-white/[0.04]">
                  {weekTasks.map((task) => {
                    const p = progressMap.get(task.id);
                    const status = p?.status || 'not_started';
                    const dd = taskDueDates.get(task.id) || null;
                    const daysLate = p?.submitted_at && dd ? getDaysLate(dd, p.submitted_at) : 0;

                    return (
                      <div key={task.id} className="py-3">
                        <div className="flex items-start gap-3">
                          <span className="flex-shrink-0 mt-0.5">
                            <StatusIcon status={status} />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${status === 'approved' ? 'text-white/40 line-through' : 'text-white/70'}`}>
                              {task.title}
                            </p>
                            {task.description && (
                              <p className="text-xs text-white/35 mt-0.5">{task.description}</p>
                            )}

                            {/* Due date (computed from learner's start date) */}
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              {dd && (
                                <span className="text-[10px] text-white/30 flex items-center gap-1">
                                  <Calendar className="w-2.5 h-2.5" /> Due {formatDueDate(dd)}
                                </span>
                              )}
                              <DueDateBadge dueDate={dd} status={status} />
                              <StatusBadge status={status} reviewedAt={p?.reviewed_at} />
                            </div>

                            {/* Learning resources */}
                            <ResourceChips
                              taskId={task.id}
                              resourcesByTask={resourcesByTask}
                              isAdmin={true}
                              onAdd={(tid) => setResourceEditFor({ taskId: tid, resource: null })}
                              onEdit={(r) => setResourceEditFor({ taskId: r.task_id, resource: r })}
                              onDelete={(id) => onDeleteResource(id)}
                              onReorder={(id, dir) => onReorderResource(id, dir)}
                            />

                            {/* Submitted/approved/changes: show note */}
                            {(status === 'submitted' || status === 'approved' || status === 'changes_requested') && p?.completion_note && (
                              <div className="mt-2 rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 space-y-1.5">
                                <div className="flex items-start gap-2">
                                  <FileText className="w-3 h-3 text-white/30 flex-shrink-0 mt-0.5" />
                                  <p className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap">{p.completion_note}</p>
                                </div>
                                {p.link && (
                                  <a href={p.link} target="_blank" rel="noopener noreferrer"
                                     className="flex items-center gap-1.5 text-[11px] text-cyan-400/70 hover:text-cyan-400 transition-colors">
                                    <Link2 className="w-3 h-3" /> {p.link}
                                  </a>
                                )}
                                {adminTaskAttachments.filter((a) => a.progress_id === p.id).length > 0 && (
                                  <AttachmentGallery attachments={adminTaskAttachments.filter((a) => a.progress_id === p.id)} />
                                )}
                                {p.submitted_at && (
                                  <p className="text-[10px] text-white/30 flex items-center gap-1">
                                    <Send className="w-2.5 h-2.5" />
                                    Submitted {formatSubmittedDate(p.submitted_at)}
                                    {daysLate > 0 && <span className="text-red-400/80 ml-1">({daysLate} {daysLate === 1 ? 'day' : 'days'} late)</span>}
                                  </p>
                                )}
                                {status === 'approved' && p.reviewed_at && (
                                  <p className="text-[10px] text-green-400/60 flex items-center gap-1">
                                    <CheckCircle2 className="w-2.5 h-2.5" /> Approved {formatSubmittedDate(p.reviewed_at)}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Changes requested: show review comment */}
                            {status === 'changes_requested' && p?.review_comment && (
                              <div className="mt-2 rounded-lg bg-red-500/[0.06] border border-red-500/15 p-3">
                                <div className="flex items-start gap-2">
                                  <MessageSquare className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
                                  <div>
                                    <p className="text-[10px] font-semibold text-red-400/80 uppercase tracking-wide mb-1">Changes requested</p>
                                    <p className="text-xs text-white/60 leading-relaxed">{p.review_comment}</p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Coach feedback display for admin */}
                            {(status === 'submitted' || status === 'approved' || status === 'changes_requested') && p?.coach_feedback && (
                              <div className="mt-2 rounded-lg bg-violet-500/[0.06] border border-violet-500/15 p-3 space-y-1.5">
                                <p className="text-[10px] font-semibold text-violet-300/80 uppercase tracking-wide">AI Coach Feedback</p>
                                <p className="text-xs text-white/60 leading-relaxed">{p.coach_feedback}</p>
                                {p.coach_question && (
                                  <p className="text-xs text-white/40"><span className="text-[10px] text-violet-300/60 uppercase">Q:</span> {p.coach_question}</p>
                                )}
                                {p.coach_answer && (
                                  <p className="text-xs text-white/40"><span className="text-[10px] text-green-400/60 uppercase">A:</span> {p.coach_answer}</p>
                                )}
                              </div>
                            )}

                            {/* Admin action buttons for submitted tasks */}
                            {status === 'submitted' && p && (
                              <div className="flex items-center gap-2 mt-2">
                                <button
                                  onClick={() => onApproveTask(p.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/15 border border-green-500/25 text-green-300 text-xs font-semibold hover:bg-green-500/25 transition-all"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                                </button>
                                <button
                                  onClick={() => setRequestChangesFor(p)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/25 text-red-300 text-xs font-semibold hover:bg-red-500/25 transition-all"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" /> Request changes
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Admin quiz summary per week */}
                {weekQuizAttempts.length > 0 && (
                  <div className="px-5 py-2 border-t border-white/[0.04]">
                    <AdminQuizSummary weekId={week.id} quizAttempts={learnerQuizAttempts} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : detailTab === 'journal' ? (
        <AdminJournal learnerId={selectedLearner} weeks={weeks} adminId={adminId} />
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.03] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-semibold text-white">Preview Interview Practice</span>
              </div>
              <button onClick={() => setShowInterviewPreview(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/25 text-violet-300 text-xs font-semibold hover:bg-violet-500/25 transition-all">
                <Mic className="w-3.5 h-3.5" /> Try it
              </button>
            </div>
            <p className="text-xs text-white/40 mt-2">Generate a practice interview question for this learner and grade a sample answer. No data is saved.</p>
          </div>
          {sortedWeeks.map((week) => {
            const weekQuiz = learnerQuizAttempts.filter((a) => a.week_id === week.id);
            if (weekQuiz.length === 0) return null;
            return (
              <div key={week.id} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-white/40">Week {week.week_number}</span>
                  <span className="text-sm font-semibold text-white">{week.title}</span>
                </div>
                <AdminQuizSummary weekId={week.id} quizAttempts={learnerQuizAttempts} />
              </div>
            );
          })}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-semibold text-white">Interview Practice</span>
            </div>
            <AdminInterviewSummary interviewHistory={learnerInterviewPractice} />
          </div>
        </div>
      )}

      {/* Admin interview practice preview modal */}
      {showInterviewPreview && (
        <AdminInterviewPreviewModal
          learnerId={selectedLearner}
          journalEntries={learnerJournalEntries}
          approvedTasks={learnerProgress
            .filter((p) => p.status === 'approved')
            .map((p) => ({ title: tasks.find((t) => t.id === p.task_id)?.title || 'Task', completion_note: p.completion_note || '' }))}
          onClose={() => setShowInterviewPreview(false)}
        />
      )}

      {/* Admin session prep modal */}
      {showSessionPrep && (
        <SessionPrepModal
          learnerId={selectedLearner}
          learnerName={selectedLearnerInfo.fullName}
          weeks={weeks}
          tasks={tasks}
          progress={learnerProgress}
          quizAttempts={learnerQuizAttempts}
          journalEntries={learnerJournalEntries}
          startDate={selectedLearnerInfo.startDate}
          adminId={adminId}
          onClose={() => setShowSessionPrep(false)}
        />
      )}

      {/* Resource edit modal */}
      {resourceEditFor && (
        <ResourceEditModal
          resource={resourceEditFor.resource}
          taskId={resourceEditFor.taskId}
          onClose={() => setResourceEditFor(null)}
          onSave={async (data) => {
            if (data.id) {
              await onUpdateResource(data.id, data.title, data.url, data.kind);
            } else {
              await onAddResource(data.task_id, data.title, data.url, data.kind, data.sort_order);
            }
            setResourceEditFor(null);
          }}
        />
      )}

      {/* Request changes modal */}
      {requestChangesFor && (
        <RequestChangesModal
          taskTitle={tasks.find((t) => t.id === requestChangesFor.task_id)?.title || 'Task'}
          onClose={() => setRequestChangesFor(null)}
          onSubmit={async (comment) => {
            await onRequestChanges(requestChangesFor.id, comment);
            setRequestChangesFor(null);
          }}
        />
      )}
    </div>
  );
}

// ── Admin Interview Preview Modal ───────────────────────
function AdminInterviewPreviewModal({ learnerId, journalEntries, approvedTasks, onClose }: {
  learnerId: string;
  journalEntries: JournalEntry[];
  approvedTasks: Array<{ title: string; completion_note: string }>;
  onClose: () => void;
}) {
  const [state, setState] = useState<'loading_q' | 'answering' | 'grading' | 'result' | 'error'>('loading_q');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<{ scores: { clarity: number; technical_depth: number; use_of_specifics: number }; feedback: string; suggested_version: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { question: q } = await generateInterviewQuestion({
          journal_entries: journalEntries.slice(0, 5).map((j) => ({ entry_text: j.questions || j.learned || j.built || '', entry_date: j.entry_date })),
          approved_tasks: approvedTasks.slice(0, 10),
          target_learner_id: learnerId,
        });
        if (cancelled) return;
        setQuestion(q);
        setState('answering');
      } catch (err) {
        if (cancelled) return;
        setError((err as Error).message);
        setState('error');
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    if (answer.trim().length < 20) {
      setError('Please write at least 20 characters.');
      return;
    }
    setState('grading');
    setError('');
    try {
      const grade = await gradeInterview({ question, answer: answer.trim() });
      setResult(grade);
      setState('result');
    } catch (err) {
      setError((err as Error).message);
      setState('answering');
    }
  };

  const scoreColor = (s: number) => s >= 4 ? 'text-green-400' : s >= 3 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d1320] shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] sticky top-0 bg-[#0d1320] z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
              <Mic className="w-4 h-4 text-violet-300" />
            </div>
            <h3 className="text-sm font-bold text-white">Preview Interview Practice</h3>
          </div>
          <button onClick={onClose} className="p-1 text-white/40 hover:text-white/80 transition-colors text-xs">Close</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {state === 'loading_q' && (
            <div className="flex items-center gap-2 py-8 justify-center">
              <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
              <p className="text-xs text-white/40">Generating question for this learner…</p>
            </div>
          )}

          {state === 'error' && (
            <div className="rounded-lg bg-red-500/[0.08] border border-red-500/15 px-3 py-2.5">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {state === 'answering' && (
            <div className="space-y-3">
              <div className="rounded-lg bg-violet-500/[0.06] border border-violet-500/15 p-3">
                <p className="text-[10px] font-semibold text-violet-300/80 uppercase tracking-wide mb-1">Interview Question</p>
                <p className="text-sm text-white/80 leading-relaxed">{question}</p>
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <textarea value={answer} onChange={(e) => { setAnswer(e.target.value); setError(''); }} rows={4}
                placeholder="Type a sample answer to preview the grading…"
                className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-violet-500/50 transition-all resize-none" />
              <div className="flex items-center justify-end gap-2">
                <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-white/10 text-white/50 text-xs hover:text-white/80 transition-all">Cancel</button>
                <button onClick={handleSubmit} className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-semibold text-xs hover:from-violet-400 hover:to-fuchsia-400 transition-all">
                  Grade answer
                </button>
              </div>
            </div>
          )}

          {state === 'grading' && (
            <div className="flex items-center gap-2 py-6 justify-center">
              <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
              <p className="text-xs text-white/40">Scoring the answer…</p>
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
              <button onClick={onClose} className="w-full px-4 py-2 rounded-lg border border-white/10 text-white/60 text-xs font-semibold hover:text-white/90 transition-all">Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Admin Dashboard ────────────────────────────────────
function AdminDashboard({
  learners, weeks, tasks, onSelectLearner, selectedLearner, learnerProgress, track, adminId,
  onInviteLearner, onApproveTask, onRequestChanges, onUpdateStartDate,
  resources, onAddResource, onUpdateResource, onDeleteResource, onReorderResource,
  learnerQuizAttempts, learnerInterviewPractice, learnerJournalEntries, manualUnlocks, onUnlockChanged,
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
  onInviteLearner: () => void;
  onApproveTask: (progressId: string) => Promise<void>;
  onRequestChanges: (progressId: string, comment: string) => Promise<void>;
  onUpdateStartDate: (learnerId: string, startDate: string) => Promise<void>;
  resources: TaskResource[];
  onAddResource: (taskId: string, title: string, url: string, kind: ResourceKind, sortOrder: number) => Promise<void>;
  onUpdateResource: (id: string, title: string, url: string, kind: ResourceKind) => Promise<void>;
  onDeleteResource: (id: string) => Promise<void>;
  onReorderResource: (id: string, dir: 'up' | 'down') => Promise<void>;
  learnerQuizAttempts: QuizAttempt[];
  learnerInterviewPractice: InterviewPracticeRow[];
  manualUnlocks: Set<string>;
  onUnlockChanged: () => void;
}) {
  const sortedLearners = [...learners].sort((a, b) => b.approvedCount - a.approvedCount);
  const selectedLearnerInfo = learners.find((l) => l.id === selectedLearner);

  if (selectedLearner && selectedLearnerInfo) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24">
        <button
          onClick={() => onSelectLearner('')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-xs text-white/60 hover:text-white/90 hover:bg-white/[0.08] mb-6 transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to all learners
        </button>
        <LearnerDetailTabs
          selectedLearner={selectedLearner}
          selectedLearnerInfo={selectedLearnerInfo}
          weeks={weeks}
          tasks={tasks}
          learnerProgress={learnerProgress}
          adminId={adminId}
          onApproveTask={onApproveTask}
          onRequestChanges={onRequestChanges}
          onUpdateStartDate={onUpdateStartDate}
          resources={resources}
          onAddResource={onAddResource}
          onUpdateResource={onUpdateResource}
          onDeleteResource={onDeleteResource}
          onReorderResource={onReorderResource}
          learnerQuizAttempts={learnerQuizAttempts.filter((a) => a.learner_id === selectedLearner)}
          learnerInterviewPractice={learnerInterviewPractice.filter((p) => p.learner_id === selectedLearner)}
          learnerJournalEntries={learnerJournalEntries.filter((j) => j.learner_id === selectedLearner)}
          adminManualUnlocks={manualUnlocks}
          onUnlockChanged={onUnlockChanged}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <Users className="w-4 h-4 text-cyan-400" />
          <h1 className="text-xl font-bold text-white">Learner Progress</h1>
        </div>
        <button
          onClick={onInviteLearner}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 text-cyan-300 text-xs font-semibold hover:from-blue-500/30 hover:to-cyan-500/30 transition-all"
        >
          <UserPlus className="w-3.5 h-3.5" /> Invite learner
        </button>
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
            const pct = tasks.length > 0 ? Math.round((learner.approvedCount / tasks.length) * 100) : 0;
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
                  <div className="flex items-center gap-3 mt-0.5 text-[10px]">
                    <span className="text-white/30">
                      {learner.approvedCount}/{tasks.length} approved{learner.currentWeek ? ` · Week ${learner.currentWeek}` : ''}
                    </span>
                    {learner.awaitingReviewCount > 0 && (
                      <span className="flex items-center gap-0.5 text-cyan-400/70">
                        <ClipboardCheck className="w-2.5 h-2.5" /> {learner.awaitingReviewCount} review
                      </span>
                    )}
                    {learner.overdueCount > 0 && (
                      <span className="flex items-center gap-0.5 text-red-400">
                        <AlertTriangle className="w-2.5 h-2.5" /> {learner.overdueCount} overdue
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="w-24 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400"
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
  const [resources, setResources] = useState<TaskResource[]>([]);
  const [progressMap, setProgressMap] = useState<Map<string, ProgressRow>>(new Map());

  // Learner's own start date (for trainee view)
  const [myStartDate, setMyStartDate] = useState<string | null>(null);

  // Admin data
  const [learners, setLearners] = useState<LearnerInfo[]>([]);
  const [selectedLearner, setSelectedLearner] = useState<string | null>(null);
  const [learnerProgress, setLearnerProgress] = useState<ProgressRow[]>([]);
  const [adminView, setAdminView] = useState<'learners' | 'preview'>('learners');

  // Journal data
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [learnerJournalEntries, setLearnerJournalEntries] = useState<JournalEntry[]>([]);
  const [traineeView, setTraineeView] = useState<'track' | 'journal'>('track');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([]);
  const [interviewPractice, setInterviewPractice] = useState<InterviewPracticeRow[]>([]);
  const [learnerQuizAttempts, setLearnerQuizAttempts] = useState<QuizAttempt[]>([]);
  const [learnerInterviewPractice, setLearnerInterviewPractice] = useState<InterviewPracticeRow[]>([]);
  const [manualUnlocks, setManualUnlocks] = useState<Set<string>>(new Set());
  const [authView, setAuthView] = useState<'signin' | 'forgot'>('signin');
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  // Detect recovery/invite flows from URL on initial load
  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const query = new URLSearchParams(window.location.search);
    const urlType = params.get('type') || query.get('type');
    const hasRecoveryToken = params.get('type') === 'recovery' || query.get('type') === 'recovery';
    const hasInviteToken = params.get('type') === 'invite' || query.get('type') === 'invite';
    if (hasRecoveryToken || hasInviteToken) {
      setPasswordRecovery(true);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        // Don't set authed if we're in a recovery/invite flow
        if (passwordRecovery) {
          setAuthChecked(true);
          return;
        }
        setAuthed(true);
        setUserId(data.session.user.id);
        const role = data.session.user.app_metadata?.role;
        setIsAdmin(role === 'admin');
        const name = data.session.user.user_metadata?.full_name as string | undefined;
        setFullName(name || data.session.user.email || '');
      }
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
        setAuthed(false);
        setAuthChecked(true);
        return;
      }
      if (passwordRecovery) return;
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

  // ── Effect 1: Load curriculum once per session ──
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
      let resourceRows: TaskResource[] = [];
      if (taskRows.length > 0) {
        const { data: res } = await supabase.from('lp_task_resources').select('*').in('task_id', taskRows.map((r) => r.id)).order('sort_order');
        resourceRows = (res || []) as TaskResource[];
      }
      if (cancelled) return;
      setTrack(t);
      setWeeks(weekRows);
      setTasks(taskRows);
      setResources(resourceRows);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [authed]);

  // ── Effect 2: Load progress after curriculum is loaded ──
  useEffect(() => {
    if (!track || tasks.length === 0) return;
    let cancelled = false;
    if (isAdmin) {
      (async () => {
        const { data: trainees } = await supabase.rpc('lp_list_trainees');
        if (cancelled) return;
        const traineeRows = (trainees || []) as { id: string; full_name: string; start_date: string | null }[];

        const { data: allProgress } = await supabase.from('lp_progress').select('*');
        if (cancelled) return;
        const rows = (allProgress || []) as ProgressRow[];

        const byLearner = new Map<string, ProgressRow[]>();
        for (const r of rows) {
          if (!byLearner.has(r.learner_id)) byLearner.set(r.learner_id, []);
          byLearner.get(r.learner_id)!.push(r);
        }

        const sortedWeeks = [...weeks].sort((a, b) => a.week_number - b.week_number);

        const learnerInfos: LearnerInfo[] = traineeRows.map((t) => {
          const pRows = byLearner.get(t.id) || [];
          const approvedCount = pRows.filter((p) => p.status === 'approved').length;
          const awaitingReviewCount = pRows.filter((p) => p.status === 'submitted').length;

          // Compute per-learner task due dates
          const dueDates = buildTaskDueDates(t.start_date, weeks, tasks);

          let overdueCount = 0;
          for (const task of tasks) {
            const p = pRows.find((pr) => pr.task_id === task.id);
            const status = p?.status || 'not_started';
            const dd = dueDates.get(task.id) || null;
            if (isOverdue(dd, status)) overdueCount++;
          }

          // Compute current week from per-learner dates
          let currentWeek: number | null = null;
          for (const w of sortedWeeks) {
            const wTasks = tasks.filter((tk) => tk.week_id === w.id);
            const allApproved = wTasks.every((tk) => pRows.find((p) => p.task_id === tk.id && p.status === 'approved'));
            if (!allApproved && wTasks.length > 0) {
              currentWeek = w.week_number;
              break;
            }
          }
          if (currentWeek === null && approvedCount > 0 && approvedCount < tasks.length) {
            for (const w of sortedWeeks) {
              const wTasks = tasks.filter((tk) => tk.week_id === w.id);
              const hasProgress = wTasks.some((tk) => pRows.find((p) => p.task_id === tk.id));
              if (!hasProgress) {
                currentWeek = w.week_number;
                break;
              }
            }
          }

          return {
            id: t.id,
            fullName: t.full_name || 'Unknown learner',
            startDate: t.start_date,
            approvedCount,
            overdueCount,
            awaitingReviewCount,
            currentWeek,
            latestEntryDate: null,
          };
        });

        const { data: allJournal } = await supabase
          .from('lp_journal_entries')
          .select('*')
          .order('entry_date', { ascending: false });
        if (cancelled) return;
        const journalRows = (allJournal || []) as JournalEntry[];
        setLearnerJournalEntries(journalRows);

        // Load all quiz attempts and interview practice for admin view
        const { data: allQuiz } = await supabase.from('lp_quiz_attempts').select('*').order('created_at', { ascending: false });
        if (!cancelled) setLearnerQuizAttempts((allQuiz || []) as QuizAttempt[]);
        const { data: allInterview } = await supabase.from('lp_interview_practice').select('*').order('created_at', { ascending: false });
        if (!cancelled) setLearnerInterviewPractice((allInterview || []) as InterviewPracticeRow[]);
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
        // Load learner's own progress
        const { data } = await supabase.from('lp_progress').select('*').eq('learner_id', userId);
        if (cancelled) return;
        const rows = (data || []) as ProgressRow[];
        setProgressMap(new Map(rows.map((r) => [r.task_id, r])));

        // Load learner's own start_date from lp_profiles
        const { data: profileData } = await supabase
          .from('lp_profiles')
          .select('start_date')
          .eq('id', userId)
          .maybeSingle();
        if (cancelled) return;
        setMyStartDate((profileData as { start_date: string | null } | null)?.start_date ?? null);

        // Load journal entries
        const { data: jData } = await supabase
          .from('lp_journal_entries')
          .select('*')
          .eq('learner_id', userId)
          .order('entry_date', { ascending: false });
        if (cancelled) return;
        setJournalEntries((jData || []) as JournalEntry[]);

        // Load quiz attempts
        const { data: qaData } = await supabase.from('lp_quiz_attempts').select('*').eq('learner_id', userId).order('created_at', { ascending: false });
        if (!cancelled) setQuizAttempts((qaData || []) as QuizAttempt[]);

        // Load interview practice
        const { data: ipData } = await supabase.from('lp_interview_practice').select('*').eq('learner_id', userId).order('created_at', { ascending: false });
        if (!cancelled) setInterviewPractice((ipData || []) as InterviewPracticeRow[]);

        // Load own manual unlocks (for week locking display)
        if (!cancelled) {
          const unlocks = await fetchManualUnlocks(userId);
          if (!cancelled) setManualUnlocks(unlocks);
        }
      })();
    }
    return () => { cancelled = true; };
  }, [track, tasks, weeks, isAdmin, userId]);

  const loadSelectedLearnerProgress = useCallback(async (learnerId: string) => {
    const { data } = await supabase.from('lp_progress').select('*').eq('learner_id', learnerId);
    setLearnerProgress((data || []) as ProgressRow[]);
  }, []);

  // ── Upload attachments after progress row is created ──
  const uploadAttachments = async (learnerId: string, progressId: string | null, journalEntryId: string | null, files: PendingFile[]) => {
    const folderId = progressId || journalEntryId || crypto.randomUUID();
    for (const pf of files) {
      if (pf.error) continue;
      const uploaded = await uploadFile(learnerId, folderId, pf.file);
      if (uploaded) {
        await createAttachmentRecord(learnerId, progressId, journalEntryId, uploaded);
      }
    }
  };

  // ── Task submission handler ──
  const handleSubmitTask = async (taskId: string, note: string, link: string, coachFeedback?: CoachFeedback, coachAnswer?: string, pendingFiles?: PendingFile[]) => {
    const existing = progressMap.get(taskId);
    const now = new Date().toISOString();
    const payload: Record<string, unknown> = {
      status: 'submitted',
      completion_note: note,
      link: link || null,
      coach_feedback: coachFeedback?.whats_good ? `Good: ${coachFeedback.whats_good}\n\nMissing: ${coachFeedback.whats_missing}` : null,
      coach_question: coachFeedback?.follow_up || null,
      coach_answer: coachAnswer || null,
      coach_completed: !!(coachFeedback && coachAnswer),
    };

    if (!existing || existing.status !== 'submitted') {
      payload.submitted_at = now;
    }

    setProgressMap((prev) => {
      const next = new Map(prev);
      if (existing) {
        next.set(taskId, { ...existing, ...payload } as ProgressRow);
      } else {
        next.set(taskId, {
          id: 'temp',
          learner_id: userId,
          task_id: taskId,
          status: 'submitted',
          completed_at: null,
          completion_note: note,
          link: link || null,
          submitted_at: payload.submitted_at as string,
          reviewed_at: null,
          review_comment: null,
          coach_feedback: payload.coach_feedback as string | null,
          coach_question: payload.coach_question as string | null,
          coach_answer: payload.coach_answer as string | null,
          coach_completed: payload.coach_completed as boolean | null,
        });
      }
      return next;
    });

    if (existing && existing.id !== 'temp') {
      const { error } = await supabase.from('lp_progress').update(payload).eq('id', existing.id);
      if (error) {
        setProgressMap((prev) => {
          const next = new Map(prev);
          next.set(taskId, existing);
          return next;
        });
      } else if (pendingFiles && pendingFiles.length > 0) {
        await uploadAttachments(userId, existing.id, null, pendingFiles);
      }
    } else {
      const { data, error } = await supabase.from('lp_progress').insert({
        learner_id: userId,
        task_id: taskId,
        ...payload,
      }).select('*');
      if (error) {
        setProgressMap((prev) => {
          const next = new Map(prev);
          next.delete(taskId);
          return next;
        });
      } else if (data && data.length > 0) {
        setProgressMap((prev) => {
          const next = new Map(prev);
          next.set(taskId, data[0] as ProgressRow);
          return next;
        });
        if (pendingFiles && pendingFiles.length > 0) {
          await uploadAttachments(userId, data[0].id, null, pendingFiles);
        }
      }
    }
  };

  // ── Admin: approve task ──
  const handleApproveTask = async (progressId: string) => {
    const now = new Date().toISOString();
    await supabase.from('lp_progress').update({ status: 'approved', reviewed_at: now }).eq('id', progressId);
    if (selectedLearner) {
      await loadSelectedLearnerProgress(selectedLearner);
      setLearners((prev) => prev.map((l) => {
        if (l.id !== selectedLearner) return l;
        const newProgress = learnerProgress.map((p) =>
          p.id === progressId ? { ...p, status: 'approved' as TaskStatus, reviewed_at: now } : p
        );
        return {
          ...l,
          approvedCount: newProgress.filter((p) => p.status === 'approved').length,
          awaitingReviewCount: newProgress.filter((p) => p.status === 'submitted').length,
        };
      }));
    }
  };

  // ── Admin: request changes ──
  const handleRequestChanges = async (progressId: string, comment: string) => {
    const now = new Date().toISOString();
    await supabase.from('lp_progress').update({
      status: 'changes_requested',
      review_comment: comment,
      reviewed_at: now,
    }).eq('id', progressId);
    if (selectedLearner) {
      await loadSelectedLearnerProgress(selectedLearner);
      setLearners((prev) => prev.map((l) => {
        if (l.id !== selectedLearner) return l;
        const newProgress = learnerProgress.map((p) =>
          p.id === progressId ? { ...p, status: 'changes_requested' as TaskStatus, review_comment: comment, reviewed_at: now } : p
        );
        return {
          ...l,
          awaitingReviewCount: newProgress.filter((p) => p.status === 'submitted').length,
        };
      }));
    }
  };

  // ── Admin: resource CRUD ──
  const handleAddResource = async (taskId: string, title: string, url: string, kind: ResourceKind, sortOrder: number) => {
    const maxSort = Math.max(0, ...resources.filter((r) => r.task_id === taskId).map((r) => r.sort_order));
    const { data, error } = await supabase.from('lp_task_resources')
      .insert({ task_id: taskId, title, url, kind, sort_order: sortOrder || maxSort + 1 })
      .select('*').single();
    if (!error && data) setResources((prev) => [...prev, data as TaskResource]);
  };

  const handleUpdateResource = async (id: string, title: string, url: string, kind: ResourceKind) => {
    await supabase.from('lp_task_resources').update({ title, url, kind }).eq('id', id);
    setResources((prev) => prev.map((r) => (r.id === id ? { ...r, title, url, kind } : r)));
  };

  const handleDeleteResource = async (id: string) => {
    await supabase.from('lp_task_resources').delete().eq('id', id);
    setResources((prev) => prev.filter((r) => r.id !== id));
  };

  const handleReorderResource = async (id: string, dir: 'up' | 'down') => {
    const resource = resources.find((r) => r.id === id);
    if (!resource) return;
    const taskResources = resources.filter((r) => r.task_id === resource.task_id).sort((a, b) => a.sort_order - b.sort_order);
    const idx = taskResources.findIndex((r) => r.id === id);
    if (dir === 'up' && idx === 0) return;
    if (dir === 'down' && idx === taskResources.length - 1) return;
    const swapWith = taskResources[dir === 'up' ? idx - 1 : idx + 1];
    await supabase.from('lp_task_resources').update({ sort_order: swapWith.sort_order }).eq('id', id);
    await supabase.from('lp_task_resources').update({ sort_order: resource.sort_order }).eq('id', swapWith.id);
    setResources((prev) => prev.map((r) => {
      if (r.id === id) return { ...r, sort_order: swapWith.sort_order };
      if (r.id === swapWith.id) return { ...r, sort_order: resource.sort_order };
      return r;
    }));
  };

  // ── Admin: update learner start date ──
  const handleUpdateStartDate = async (learnerId: string, startDate: string) => {
    await supabase.from('lp_profiles').update({ start_date: startDate || null }).eq('id', learnerId);
    setLearners((prev) => prev.map((l) =>
      l.id === learnerId ? { ...l, startDate: startDate || null } : l
    ));
  };

  const loadManualUnlocks = useCallback(async (learnerId: string) => {
    const unlocks = await fetchManualUnlocks(learnerId);
    setManualUnlocks(unlocks);
  }, []);

  const handleSelectLearner = (learnerId: string) => {
    if (learnerId === '') {
      setSelectedLearner(null);
      setLearnerProgress([]);
      setManualUnlocks(new Set());
      return;
    }
    setSelectedLearner(learnerId);
    loadSelectedLearnerProgress(learnerId);
    loadManualUnlocks(learnerId);
  };

  const handleSignOut = () => {
    supabase.auth.signOut();
    setAuthed(false);
    setProgressMap(new Map());
    setLearners([]);
    setSelectedLearner(null);
    setMyStartDate(null);
  };

  // Track Preview uses today as start_date
  const previewStartDate = useMemo(() => getCentralDateStr(), []);

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

  if (passwordRecovery) {
    return (
      <div className="min-h-screen bg-[#080c14] text-white font-sans antialiased">
        <NavBar />
        <ResetPassword onDone={() => {
          setPasswordRecovery(false);
          setAuthed(true);
        }} />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#080c14] text-white font-sans antialiased">
        <NavBar />
        {authView === 'forgot' ? (
          <ForgotPassword onBack={() => setAuthView('signin')} />
        ) : (
          <SignInGate
            onSignedIn={() => setAuthed(true)}
            onForgotPassword={() => setAuthView('forgot')}
          />
        )}
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
          <button onClick={() => setShowChangePassword(true)} className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors">
            <KeyRound className="w-3 h-3" /> Change password
          </button>
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
              onInviteLearner={() => setShowInviteModal(true)}
              onApproveTask={handleApproveTask}
              onRequestChanges={handleRequestChanges}
              onUpdateStartDate={handleUpdateStartDate}
              resources={resources}
              onAddResource={handleAddResource}
              onUpdateResource={handleUpdateResource}
              onDeleteResource={handleDeleteResource}
              onReorderResource={handleReorderResource}
              learnerQuizAttempts={learnerQuizAttempts}
              learnerInterviewPractice={learnerInterviewPractice}
              learnerJournalEntries={learnerJournalEntries}
              manualUnlocks={manualUnlocks}
              onUnlockChanged={() => selectedLearner && loadManualUnlocks(selectedLearner)}
            />
          )}

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
                onSubmitTask={async () => {}}
                fullName={fullName}
                readOnly
                isAdmin
                learnerId={userId}
                journalEntries={[]}
                onJumpToJournal={() => {}}
                startDate={previewStartDate}
                resources={resources}
                onAddResource={handleAddResource}
                onUpdateResource={handleUpdateResource}
                onDeleteResource={handleDeleteResource}
                onReorderResource={handleReorderResource}
                quizAttempts={[]}
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
              onSubmitTask={handleSubmitTask}
              fullName={fullName}
              learnerId={userId}
              journalEntries={journalEntries}
              onJumpToJournal={() => setTraineeView('journal')}
              startDate={myStartDate}
              resources={resources}
              quizAttempts={quizAttempts}
              interviewPractice={interviewPractice}
              manualUnlocks={manualUnlocks}
              onQuizPassed={async () => {
                const { data: qaData } = await supabase.from('lp_quiz_attempts').select('*').eq('learner_id', userId).order('created_at', { ascending: false });
                setQuizAttempts((qaData || []) as QuizAttempt[]);
              }}
              onNewInterviewAttempt={async () => {
                const { data: ipData } = await supabase.from('lp_interview_practice').select('*').eq('learner_id', userId).order('created_at', { ascending: false });
                setInterviewPractice((ipData || []) as InterviewPracticeRow[]);
              }}
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

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}

      {showInviteModal && isAdmin && (
        <InviteLearnerModal
          onClose={() => setShowInviteModal(false)}
          onInvited={() => {
            if (track) {
              const reload = async () => {
                const { data: trainees } = await supabase.rpc('lp_list_trainees');
                const traineeRows = (trainees || []) as { id: string; full_name: string; start_date: string | null }[];
                setLearners((prev) => {
                  const existingIds = new Set(prev.map((p) => p.id));
                  const newOnes = traineeRows
                    .filter((t) => !existingIds.has(t.id))
                    .map((t) => ({ id: t.id, fullName: t.full_name || 'Unknown learner', startDate: t.start_date, approvedCount: 0, overdueCount: 0, awaitingReviewCount: 0, currentWeek: null, latestEntryDate: null }));
                  return [...prev, ...newOnes];
                });
              };
              reload();
            }
          }}
        />
      )}
    </div>
  );
}
