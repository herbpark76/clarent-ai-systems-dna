import { useState, useEffect, useCallback } from 'react';
import {
  Plus, FileDown, MessageSquare, Clock,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// ── Types ──────────────────────────────────────────────
export interface JournalEntry {
  id: string;
  learner_id: string;
  week_id: string | null;
  entry_date: string;
  built: string;
  broke: string;
  learned: string;
  questions: string | null;
  hours: number | null;
  created_at: string;
  updated_at: string;
}

export interface JournalComment {
  id: string;
  entry_id: string;
  author_id: string;
  body: string;
  created_at: string;
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

function fmtDate(d: string): string {
  return localDate(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── New Entry Form ─────────────────────────────────────
function EntryForm({
  weeks, onSave, onCancel,
}: {
  weeks: Week[];
  onSave: (data: { week_id: string; entry_date: string; built: string; broke: string; learned: string; questions: string; hours: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const currentWeek = weeks.find((w) => isCurrentWeek(w));
  const [weekId, setWeekId] = useState(currentWeek?.id || weeks[0]?.id || '');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [built, setBuilt] = useState('');
  const [broke, setBroke] = useState('');
  const [learned, setLearned] = useState('');
  const [questions, setQuestions] = useState('');
  const [hours, setHours] = useState('');
  const [saving, setSaving] = useState(false);

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/20 text-sm focus:outline-none focus:border-blue-500/50 transition-all';
  const labelCls = 'block text-xs font-semibold text-white/50 mb-1.5';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!built.trim() && !broke.trim() && !learned.trim()) return;
    setSaving(true);
    await onSave({ week_id: weekId, entry_date: entryDate, built, broke, learned, questions, hours });
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Plus className="w-4 h-4 text-cyan-400" />
        <h3 className="text-sm font-bold text-white">New Journal Entry</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Week</label>
          <select value={weekId} onChange={(e) => setWeekId(e.target.value)} className={inputCls}>
            {weeks.map((w) => (
              <option key={w.id} value={w.id} className="bg-[#0d1320]">Week {w.week_number}: {w.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Date</label>
          <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className={inputCls} />
        </div>
      </div>

      <div>
        <label className={labelCls}>What I built</label>
        <textarea value={built} onChange={(e) => setBuilt(e.target.value)} rows={2} placeholder="What did you build or work on today?" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>What broke</label>
        <textarea value={broke} onChange={(e) => setBroke(e.target.value)} rows={2} placeholder="What went wrong, bugs, blockers?" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>What I learned</label>
        <textarea value={learned} onChange={(e) => setLearned(e.target.value)} rows={2} placeholder="Key takeaways, new concepts, insights?" className={inputCls} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label className={labelCls}>Questions for Herb (optional)</label>
          <textarea value={questions} onChange={(e) => setQuestions(e.target.value)} rows={1} placeholder="Anything you need help with?" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Hours (optional)</label>
          <input type="number" step="0.5" min="0" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="3.5" className={inputCls} />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={saving}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold text-xs hover:from-blue-400 hover:to-cyan-400 disabled:opacity-60 transition-all">
          {saving ? 'Saving…' : 'Save entry'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/50 text-xs font-semibold hover:text-white/80 hover:bg-white/[0.06] transition-all">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Comment Box ────────────────────────────────────────
function CommentBox({ entryId, onReply }: { entryId: string; onReply: (entryId: string, body: string) => Promise<void> }) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    await onReply(entryId, body);
    setBody('');
    setSending(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-start gap-2 mt-3">
      <input
        type="text"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a reply…"
        disabled={sending}
        className="flex-1 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white placeholder-white/20 text-xs focus:outline-none focus:border-blue-500/40 transition-all"
      />
      <button type="submit" disabled={sending || !body.trim()}
        className="px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white/60 text-xs font-semibold hover:text-white/90 hover:bg-white/[0.08] disabled:opacity-40 transition-all">
        Send
      </button>
    </form>
  );
}

// ── Entry Card ─────────────────────────────────────────
function EntryCard({
  entry, comments, weekTitle, showCommentBox, onReply,
}: {
  entry: JournalEntry;
  comments: JournalComment[];
  weekTitle: string;
  showCommentBox: boolean;
  onReply: (entryId: string, body: string) => Promise<void>;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.04]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wide">{weekTitle}</span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-white/25">
            {entry.hours != null && (
              <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> {entry.hours}h</span>
            )}
            <span>{fmtDate(entry.entry_date)}</span>
          </div>
        </div>
      </div>
      <div className="px-4 py-3 space-y-3">
        {entry.built && (
          <div>
            <p className="text-[10px] font-semibold text-cyan-400/60 uppercase tracking-wide mb-0.5">Built</p>
            <p className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap">{entry.built}</p>
          </div>
        )}
        {entry.broke && (
          <div>
            <p className="text-[10px] font-semibold text-red-400/60 uppercase tracking-wide mb-0.5">Broke</p>
            <p className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap">{entry.broke}</p>
          </div>
        )}
        {entry.learned && (
          <div>
            <p className="text-[10px] font-semibold text-green-400/60 uppercase tracking-wide mb-0.5">Learned</p>
            <p className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap">{entry.learned}</p>
          </div>
        )}
        {entry.questions && (
          <div>
            <p className="text-[10px] font-semibold text-amber-400/60 uppercase tracking-wide mb-0.5">Questions</p>
            <p className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap">{entry.questions}</p>
          </div>
        )}
      </div>

      {comments.length > 0 && (
        <div className="px-4 py-3 bg-white/[0.01] border-t border-white/[0.04] space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2">
              <MessageSquare className="w-3 h-3 text-cyan-400/40 mt-1 flex-shrink-0" />
              <div>
                <p className="text-xs text-white/70 leading-relaxed">{c.body}</p>
                <p className="text-[9px] text-white/20 mt-0.5">{fmtDate(c.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCommentBox && (
        <div className="px-4 pb-3">
          <CommentBox entryId={entry.id} onReply={onReply} />
        </div>
      )}
    </div>
  );
}

// ── Trainee Journal View ───────────────────────────────
export function TraineeJournal({
  learnerId, weeks,
}: {
  learnerId: string;
  weeks: Week[];
}) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [comments, setComments] = useState<JournalComment[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadEntries = useCallback(async () => {
    const { data } = await supabase
      .from('lp_journal_entries')
      .select('*')
      .eq('learner_id', learnerId)
      .order('entry_date', { ascending: false });
    const entryRows = (data || []) as JournalEntry[];
    setEntries(entryRows);
    if (entryRows.length > 0) {
      const entryIds = entryRows.map((e) => e.id);
      const { data: c } = await supabase
        .from('lp_journal_comments')
        .select('*')
        .in('entry_id', entryIds)
        .order('created_at', { ascending: true });
      setComments((c || []) as JournalComment[]);
    } else {
      setComments([]);
    }
    setLoading(false);
  }, [learnerId]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const handleSave = async (d: { week_id: string; entry_date: string; built: string; broke: string; learned: string; questions: string; hours: string }) => {
    const { data } = await supabase.from('lp_journal_entries').insert({
      learner_id: learnerId,
      week_id: d.week_id || null,
      entry_date: d.entry_date,
      built: d.built,
      broke: d.broke,
      learned: d.learned,
      questions: d.questions || null,
      hours: d.hours ? parseFloat(d.hours) : null,
    }).select('*');
    if (data && data.length > 0) {
      setShowForm(false);
      loadEntries();
    }
  };

  const handleReply = async (entryId: string, body: string) => {
    const { data } = await supabase.from('lp_journal_comments').insert({
      entry_id: entryId,
      body,
    }).select('*');
    if (data && data.length > 0) {
      setComments((prev) => [...prev, data[0] as JournalComment]);
    }
  };

  const handleExport = () => {
    const sortedWeeks = [...weeks].sort((a, b) => a.week_number - b.week_number);
    let md = `# Build Journal\n\n`;
    md += `Exported: ${new Date().toLocaleDateString('en-US', { dateStyle: 'full' })}\n\n`;
    for (const week of sortedWeeks) {
      const weekEntries = entries.filter((e) => e.week_id === week.id);
      if (weekEntries.length === 0) continue;
      md += `## Week ${week.week_number}: ${week.title}\n\n`;
      for (const entry of [...weekEntries].sort((a, b) => b.entry_date.localeCompare(a.entry_date))) {
        md += `### ${fmtDate(entry.entry_date)}${entry.hours != null ? ` (${entry.hours}h)` : ''}\n\n`;
        if (entry.built) md += `**What I built:** ${entry.built}\n\n`;
        if (entry.broke) md += `**What broke:** ${entry.broke}\n\n`;
        if (entry.learned) md += `**What I learned:** ${entry.learned}\n\n`;
        if (entry.questions) md += `**Questions:** ${entry.questions}\n\n`;
        const entryComments = comments.filter((c) => c.entry_id === entry.id);
        if (entryComments.length > 0) {
          md += `**Herb's comments:**\n`;
          for (const c of entryComments) {
            md += `- ${c.body} _(${fmtDate(c.created_at)})_\n`;
          }
          md += `\n`;
        }
        md += `---\n\n`;
      }
    }
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `build-journal-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-4 h-4 border-2 border-white/10 border-t-cyan-400 rounded-full animate-spin" />
      </div>
    );
  }

  const sortedWeeks = [...weeks].sort((a, b) => a.week_number - b.week_number);
  const entryCountByWeek = new Map<string, number>();
  for (const e of entries) {
    if (e.week_id) entryCountByWeek.set(e.week_id, (entryCountByWeek.get(e.week_id) || 0) + 1);
  }

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-white">Build Journal</h2>
          <span className="text-xs text-white/30">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
        </div>
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <button onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs font-semibold text-white/60 hover:text-white/90 hover:bg-white/[0.06] transition-all">
              <FileDown className="w-3.5 h-3.5" /> Export
            </button>
          )}
          <button onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-semibold hover:from-blue-400 hover:to-cyan-400 transition-all">
            <Plus className="w-3.5 h-3.5" /> New entry
          </button>
        </div>
      </div>

      {showForm && (
        <EntryForm weeks={weeks} onSave={handleSave} onCancel={() => setShowForm(false)} />
      )}

      {/* Entries grouped by week, newest week first */}
      {entries.length === 0 && !showForm ? (
        <div className="text-center py-12 rounded-xl border border-white/[0.05] bg-white/[0.01]">
          <p className="text-sm text-white/30">No journal entries yet. Click "New entry" to start your build journal.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedWeeks.slice().reverse().map((week) => {
            const weekEntries = entries
              .filter((e) => e.week_id === week.id)
              .sort((a, b) => b.entry_date.localeCompare(a.entry_date));
            if (weekEntries.length === 0) return null;
            return (
              <div key={week.id}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold text-white/50">Week {week.week_number}: {week.title}</span>
                  <span className="text-[10px] text-white/25">{weekEntries.length} {weekEntries.length === 1 ? 'entry' : 'entries'}</span>
                </div>
                <div className="space-y-3">
                  {weekEntries.map((entry) => (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      comments={comments.filter((c) => c.entry_id === entry.id)}
                      weekTitle={`Week ${week.week_number}`}
                      showCommentBox
                      onReply={handleReply}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Admin Journal View (on learner detail) ─────────────
export function AdminJournal({
  learnerId, weeks,
}: {
  learnerId: string;
  weeks: Week[];
  adminId: string;
}) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [comments, setComments] = useState<JournalComment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('lp_journal_entries')
      .select('*')
      .eq('learner_id', learnerId)
      .order('entry_date', { ascending: false });
    const entryRows = (data || []) as JournalEntry[];
    setEntries(entryRows);
    if (entryRows.length > 0) {
      const entryIds = entryRows.map((e) => e.id);
      const { data: c } = await supabase
        .from('lp_journal_comments')
        .select('*')
        .in('entry_id', entryIds)
        .order('created_at', { ascending: true });
      setComments((c || []) as JournalComment[]);
    } else {
      setComments([]);
    }
    setLoading(false);
  }, [learnerId]);

  useEffect(() => { load(); }, [load]);

  const handleComment = async (entryId: string, body: string) => {
    const { data } = await supabase.from('lp_journal_comments').insert({
      entry_id: entryId,
      body,
    }).select('*');
    if (data && data.length > 0) {
      setComments((prev) => [...prev, data[0] as JournalComment]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-4 h-4 border-2 border-white/10 border-t-cyan-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 rounded-xl border border-white/[0.05] bg-white/[0.01]">
        <p className="text-sm text-white/30">No journal entries yet.</p>
      </div>
    );
  }

  const sortedWeeks = [...weeks].sort((a, b) => a.week_number - b.week_number);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold text-white">Journal</h3>
        <span className="text-xs text-white/30">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
      </div>
      <div className="space-y-6">
        {sortedWeeks.slice().reverse().map((week) => {
          const weekEntries = entries
            .filter((e) => e.week_id === week.id)
            .sort((a, b) => b.entry_date.localeCompare(a.entry_date));
          if (weekEntries.length === 0) return null;
          return (
            <div key={week.id}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-white/50">Week {week.week_number}: {week.title}</span>
              </div>
              <div className="space-y-3">
                {weekEntries.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    comments={comments.filter((c) => c.entry_id === entry.id)}
                    weekTitle={`Week ${week.week_number}`}
                    showCommentBox
                    onReply={handleComment}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Helper: count entries per week ─────────────────────
export function getEntryCountByWeek(entries: JournalEntry[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of entries) {
    if (e.week_id) m.set(e.week_id, (m.get(e.week_id) || 0) + 1);
  }
  return m;
}

// ── Helper: latest entry date ──────────────────────────
export function getLatestEntryDate(entries: JournalEntry[]): string | null {
  if (entries.length === 0) return null;
  return [...entries].sort((a, b) => b.entry_date.localeCompare(a.entry_date))[0].entry_date;
}
