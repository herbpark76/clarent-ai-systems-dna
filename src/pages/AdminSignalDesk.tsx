import { useState, useEffect, useCallback, Component } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Trash2, Send, RefreshCw,
  Newspaper, AlertCircle, CheckCircle2, ExternalLink,
  Layers, Tag, Briefcase, Building2, ChevronDown, Link2,
  GitMerge, XCircle, Copy, Cpu, Trophy, Plus, FileText, PenLine,
  AlertTriangle, ScanLine, X, Wrench,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { reviewDraft, reReviewAfterApply, type ReviewProposal, type ReviewSummary } from '../lib/qualityReview';
import NavBar from '../components/NavBar';

// ── Types ──────────────────────────────────────────────
type EntryType = 'news' | 'tutorial' | 'use_case' | 'tool' | 'model_release' | 'risk';
type SystemLayer = 'model' | 'agent' | 'tools_connectors' | 'data_context' | 'evals' | 'security_governance' | 'interface';
type DuplicateStatus = 'none' | 'possible' | 'merged' | 'separate' | 'discarded';
type EntryOrigin = 'newsletter' | 'original';

interface SourceObj {
  name: string | null;
  date: string | null;
  url: string | null;
}

type ReviewStatus = 'ready_for_review' | 'needs_attention' | 'not_checked';

interface SignalEntry {
  id: string;
  created_at: string;
  slug: string;
  type: EntryType;
  system_layer: SystemLayer | null;
  title: string;
  summary: string;
  why_it_matters: string | null;
  how_its_built: string | null;
  business_angle: string | null;
  steps: Array<{ text: string; prompt?: string }> | null;
  tags: string[] | null;
  role_tags: string[] | null;
  model_name: string | null;
  vendor: string | null;
  benchmark_score: number | null;
  benchmark_name: string | null;
  price_input: string | null;
  price_output: string | null;
  source_name: string | null;
  source_date: string | null;
  source_url: string | null;
  sources: SourceObj[] | null;
  duplicate_of: string | null;
  duplicate_status: DuplicateStatus;
  origin: EntryOrigin;
  status: 'draft' | 'published';
  result: string | null;
  review_status: ReviewStatus;
  review_notes: string | null;
}

const TYPE_LABELS: Record<EntryType, string> = {
  news: 'News', tutorial: 'Tutorial', use_case: 'Use Case',
  tool: 'Tool', model_release: 'Model Release', risk: 'Risk',
};
const LAYER_LABELS: Record<SystemLayer, string> = {
  model: 'Model', agent: 'Agent', tools_connectors: 'Tools & Connectors',
  data_context: 'Data & Context', evals: 'Evals',
  security_governance: 'Security & Governance', interface: 'Interface',
};
const TYPE_COLORS: Record<EntryType, string> = {
  news: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  tutorial: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  use_case: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
  tool: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  model_release: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  risk: 'border-red-500/30 bg-red-500/10 text-red-300',
};
const LAYER_COLORS: Record<SystemLayer, string> = {
  model: 'text-blue-400', agent: 'text-amber-400',
  tools_connectors: 'text-orange-400', data_context: 'text-emerald-400',
  evals: 'text-sky-400', security_governance: 'text-rose-400', interface: 'text-teal-400',
};

// ── Auth Gate ──────────────────────────────────────────
function AuthGate({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); }
    else { onSignedIn(); }
  };

  return (
    <div className="pt-20 min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center mx-auto mb-4">
            <Newspaper className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white mb-1">Signal Desk</h1>
          <p className="text-sm text-white/40">Sign in to manage AI signal entries</p>
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
      </div>
    </div>
  );
}

// ── Normalization helpers (defend against stringified JSON) ──
function normalizeSteps(raw: any): Array<{ text: string; prompt?: string }> {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((s: any) => {
      if (typeof s === 'string') return { text: s };
      if (s && typeof s === 'object' && typeof s.text === 'string')
        return { text: s.text, ...(s.prompt ? { prompt: String(s.prompt) } : {}) };
      return null;
    }).filter((s): s is { text: string; prompt?: string } => s !== null);
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return normalizeSteps(parsed);
    } catch { /* not JSON */ }
    const lines = raw.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length > 0) return lines.map((text) => ({ text }));
  }
  return [];
}

function normalizeStringArray(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((s): s is string => typeof s === 'string');
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return normalizeStringArray(parsed);
    } catch { /* not JSON */ }
    return [raw];
  }
  return [];
}

function normalizeSources(raw: any): SourceObj[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((s): s is SourceObj => s && typeof s === 'object');
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return normalizeSources(parsed);
    } catch { /* not JSON */ }
  }
  return [];
}

// ── Sources display helper ─────────────────────────────
function getSources(entry: SignalEntry): SourceObj[] {
  const fromSources = normalizeSources(entry.sources);
  if (fromSources.length > 0) return fromSources;
  if (entry.source_name || entry.source_url || entry.source_date) {
    return [{ name: entry.source_name, date: entry.source_date, url: entry.source_url }];
  }
  return [];
}

function getSourceDate(entry: SignalEntry): string | null {
  const sources = getSources(entry);
  if (sources.length > 0 && sources[0].date) return sources[0].date;
  return entry.source_date || null;
}

// ── Error Boundary ────────────────────────────────────
class EntryCardBoundary extends Component<
  { children: ReactNode; entryTitle: string },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: Error) { console.error('[EntryCardBoundary]', err); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs font-semibold text-red-400">Failed to render this entry</span>
          </div>
          <p className="text-xs text-white/40">{this.props.entryTitle}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Entry Card ─────────────────────────────────────────
function EntryCard({
  entry, onUpdate, onDelete, onMerge, onKeepSeparate, onDiscard, allEntries,
}: {
  entry: SignalEntry;
  onUpdate: (id: string, patch: Partial<SignalEntry>) => void;
  onDelete: (id: string) => void;
  onMerge: (id: string, targetId: string) => void;
  onKeepSeparate: (id: string) => void;
  onDiscard: (id: string) => void;
  allEntries: SignalEntry[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SignalEntry>(entry);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(entry), [entry]);

  const isPossibleDup = entry.duplicate_status === 'possible' && entry.duplicate_of;
  const dupTarget = isPossibleDup ? allEntries.find((e) => e.id === entry.duplicate_of) : null;
  const sources = getSources(entry);
  const sourceDate = getSourceDate(entry);
  const steps = normalizeSteps(entry.steps);
  const tags = normalizeStringArray(entry.tags);
  const roleTags = normalizeStringArray(entry.role_tags);
  const [showDupTarget, setShowDupTarget] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(entry.id, {
      title: draft.title, summary: draft.summary,
      why_it_matters: draft.why_it_matters, how_its_built: draft.how_its_built,
      business_angle: draft.business_angle, type: draft.type, system_layer: draft.system_layer,
      tags: draft.tags, role_tags: draft.role_tags, model_name: draft.model_name,
      vendor: draft.vendor, benchmark_score: draft.benchmark_score, benchmark_name: draft.benchmark_name,
      price_input: draft.price_input, price_output: draft.price_output, source_url: draft.source_url,
      source_name: draft.source_name, source_date: draft.source_date,
      result: draft.result,
      steps: draft.steps,
    });
    setEditing(false);
    setSaving(false);
  };

  return (
    <div className={`rounded-xl border bg-white/[0.02] overflow-hidden transition-all hover:border-white/[0.12] ${
      isPossibleDup ? 'border-amber-500/30' : 'border-white/[0.08]'
    }`}>
      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.05]">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${TYPE_COLORS[entry.type]}`}>
          {TYPE_LABELS[entry.type]}
        </span>
        {entry.origin === 'original' && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 flex items-center gap-1">
            <span className="inline-block w-1 h-1 rounded-full bg-emerald-400" />
            From the field
          </span>
        )}
        {entry.system_layer && (
          <span className={`text-[10px] font-medium flex items-center gap-1 ${LAYER_COLORS[entry.system_layer]}`}>
            <Layers className="w-2.5 h-2.5" />
            {LAYER_LABELS[entry.system_layer]}
          </span>
        )}
        {isPossibleDup && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-amber-500/30 bg-amber-500/10 text-amber-300">
            Possible duplicate
          </span>
        )}
        {entry.review_status === 'needs_attention' && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-orange-500/30 bg-orange-500/10 text-orange-300 flex items-center gap-1">
            <AlertTriangle className="w-2.5 h-2.5" />
            Needs attention
          </span>
        )}
        {entry.review_status === 'ready_for_review' && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-green-500/20 bg-green-500/5 text-green-400/70">
            Ready
          </span>
        )}
        {(!entry.review_status || entry.review_status === 'not_checked') && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-white/10 bg-white/[0.03] text-white/40">
            Not checked
          </span>
        )}
        <span className="text-[10px] text-white/25 ml-auto">
          {sourceDate || new Date(entry.created_at).toLocaleDateString()}
        </span>
        <button onClick={() => setExpanded(!expanded)} className="p-0.5 text-white/30 hover:text-white/70 transition-colors">
          <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Duplicate banner */}
      {isPossibleDup && (
        <div className="px-4 py-2.5 bg-amber-500/[0.06] border-b border-amber-500/10">
          <p className="text-xs text-amber-300/80 mb-2">
            Possible update to:{' '}
            {dupTarget ? (
              <button onClick={() => setShowDupTarget(!showDupTarget)} className="font-semibold text-amber-200 hover:text-amber-100 underline decoration-amber-500/30 underline-offset-2 transition-colors text-left">
                {dupTarget.title}
              </button>
            ) : (
              <span className="font-semibold">a previously published entry</span>
            )}
          </p>
          {showDupTarget && dupTarget && (
            <div className="mb-2 px-3 py-2 rounded-md bg-amber-500/[0.04] border border-amber-500/10">
              <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-0.5">Existing entry</p>
              <p className="text-xs text-white/60 leading-relaxed">{dupTarget.summary}</p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${TYPE_COLORS[dupTarget.type]}`}>{TYPE_LABELS[dupTarget.type]}</span>
                {dupTarget.system_layer && (
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${LAYER_COLORS[dupTarget.system_layer]}`}>{LAYER_LABELS[dupTarget.system_layer]}</span>
                )}
                {dupTarget.model_name && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-cyan-500/10 text-cyan-300">{dupTarget.model_name}</span>
                )}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button onClick={() => onMerge(entry.id, entry.duplicate_of!)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-500/20 border border-blue-500/30 text-blue-300 text-[10px] font-semibold hover:bg-blue-500/30 transition-all">
              <GitMerge className="w-3 h-3" /> Merge
            </button>
            <button onClick={() => onKeepSeparate(entry.id)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-white/10 text-white/50 text-[10px] hover:text-white/80 hover:bg-white/[0.05] transition-all">
              <Copy className="w-3 h-3" /> Keep separate
            </button>
            <button onClick={() => onDiscard(entry.id)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-red-500/20 text-red-400/60 text-[10px] hover:text-red-400 hover:bg-red-500/10 transition-all">
              <XCircle className="w-3 h-3" /> Discard
            </button>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="px-4 py-3">
        {editing ? (
          <div className="space-y-3">
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm font-semibold focus:outline-none focus:border-blue-500/50" />
            <textarea value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} rows={3}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50 resize-y" />
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[10px] text-white/40 mb-1 block">Type</span>
                <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as EntryType })}
                  className="w-full px-2.5 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500/50">
                  {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v} className="bg-[#0f1523]">{l}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] text-white/40 mb-1 block">System Layer</span>
                <select value={draft.system_layer || ''} onChange={(e) => setDraft({ ...draft, system_layer: (e.target.value || null) as SystemLayer | null })}
                  className="w-full px-2.5 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500/50">
                  <option value="" className="bg-[#0f1523]">— None (general news) —</option>
                  {Object.entries(LAYER_LABELS).map(([v, l]) => <option key={v} value={v} className="bg-[#0f1523]">{l}</option>)}
                </select>
              </label>
            </div>
            <textarea value={draft.why_it_matters || ''} onChange={(e) => setDraft({ ...draft, why_it_matters: e.target.value })} placeholder="Why it matters" rows={2}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50 resize-y" />
            <textarea value={draft.how_its_built || ''} onChange={(e) => setDraft({ ...draft, how_its_built: e.target.value })} placeholder="How it's built" rows={2}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50 resize-y" />
            <textarea value={draft.business_angle || ''} onChange={(e) => setDraft({ ...draft, business_angle: e.target.value })} placeholder="Business angle (finance/tax/ERP)" rows={2}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50 resize-y" />
            {draft.type === 'use_case' && (
              <textarea value={draft.result || ''} onChange={(e) => setDraft({ ...draft, result: e.target.value })} placeholder="Result (what happened when this was applied)" rows={2}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50 resize-y" />
            )}
            {/* Steps editor (tutorial & use_case) */}
            {(draft.type === 'tutorial' || draft.type === 'use_case') && (
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.08] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/40 uppercase tracking-wide font-semibold">Steps</span>
                  <button type="button" onClick={() => setDraft({ ...draft, steps: [...(draft.steps || []), { text: '' }] })}
                    className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5">
                    <Plus className="w-3 h-3" /> Add step
                  </button>
                </div>
                {(draft.steps || []).map((step, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-[10px] text-white/30 mt-2 flex-shrink-0">{i + 1}.</span>
                    <div className="flex-1 space-y-1">
                      <input value={step.text} onChange={(e) => {
                        const newSteps = [...(draft.steps || [])];
                        newSteps[i] = { ...newSteps[i], text: e.target.value };
                        setDraft({ ...draft, steps: newSteps });
                      }} placeholder={`Step ${i + 1} description`}
                        className="w-full px-2.5 py-1.5 rounded-md bg-white/[0.05] border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500/50" />
                      <input value={step.prompt || ''} onChange={(e) => {
                        const newSteps = [...(draft.steps || [])];
                        const prompt = e.target.value;
                        newSteps[i] = prompt ? { ...newSteps[i], prompt } : { text: newSteps[i].text };
                        setDraft({ ...draft, steps: newSteps });
                      }} placeholder="Optional prompt text"
                        className="w-full px-2.5 py-1.5 rounded-md bg-white/[0.03] border border-white/[0.06] text-cyan-300/80 text-[11px] font-mono focus:outline-none focus:border-cyan-500/30" />
                    </div>
                    <button type="button" onClick={() => {
                      const newSteps = (draft.steps || []).filter((_, idx) => idx !== i);
                      setDraft({ ...draft, steps: newSteps });
                    }} className="p-1 text-red-400/40 hover:text-red-400 mt-1">
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {(!draft.steps || draft.steps.length === 0) && (
                  <p className="text-[10px] text-white/25 py-1">No steps yet. Click "Add step" to begin.</p>
                )}
              </div>
            )}
            <input value={(draft.tags || []).join(', ')} onChange={(e) => setDraft({ ...draft, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} placeholder="Tags (comma separated)"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50" />
            <input value={(draft.role_tags || []).join(', ')} onChange={(e) => setDraft({ ...draft, role_tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} placeholder="Role tags (finance, legal, ops, marketing, IT)"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50" />
            {entry.type === 'model_release' && (
              <div className="grid grid-cols-2 gap-2">
                <input value={draft.model_name || ''} onChange={(e) => setDraft({ ...draft, model_name: e.target.value })} placeholder="Model name" className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-xs" />
                <input value={draft.vendor || ''} onChange={(e) => setDraft({ ...draft, vendor: e.target.value })} placeholder="Vendor" className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-xs" />
                <input type="number" step="any" value={draft.benchmark_score ?? ''} onChange={(e) => setDraft({ ...draft, benchmark_score: e.target.value === '' ? null : parseFloat(e.target.value) })} placeholder="Score (number)" className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-xs" />
                <input value={draft.benchmark_name || ''} onChange={(e) => setDraft({ ...draft, benchmark_name: e.target.value || null })} placeholder="Benchmark name" className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-xs" />
                <input value={draft.price_input || ''} onChange={(e) => setDraft({ ...draft, price_input: e.target.value })} placeholder="Price (input)" className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-xs" />
                <input value={draft.price_output || ''} onChange={(e) => setDraft({ ...draft, price_output: e.target.value })} placeholder="Price (output)" className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-xs" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <input value={draft.source_name || ''} onChange={(e) => setDraft({ ...draft, source_name: e.target.value || null })} placeholder="Source name (e.g. The Rundown AI)"
                className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500/50" />
              <input type="date" value={draft.source_date || ''} onChange={(e) => setDraft({ ...draft, source_date: e.target.value || null })}
                className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500/50" />
            </div>
            <input value={draft.source_url || ''} onChange={(e) => setDraft({ ...draft, source_url: e.target.value })} placeholder="Source URL"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50" />
            <div className="flex items-center gap-2">
              <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-semibold hover:bg-blue-500/30 transition-all disabled:opacity-50">
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button onClick={() => { setDraft(entry); setEditing(false); }} className="px-3 py-1.5 rounded-lg border border-white/10 text-white/50 text-xs hover:text-white/80 transition-all">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="text-sm font-bold text-white mb-1.5 leading-snug">{entry.title}</h3>
            <p className={`text-xs text-white/50 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>{entry.summary}</p>

            {expanded && (
              <div className="mt-3 space-y-2.5">
                {entry.why_it_matters && (
                  <div>
                    <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wide">Why it matters</span>
                    <p className="text-xs text-white/55 leading-relaxed mt-0.5">{entry.why_it_matters}</p>
                  </div>
                )}
                {entry.how_its_built && (
                  <div>
                    <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wide">How it's built</span>
                    <p className="text-xs text-white/55 leading-relaxed mt-0.5">{entry.how_its_built}</p>
                  </div>
                )}
                {entry.business_angle && (
                  <div className="flex items-start gap-1.5">
                    <Briefcase className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wide">Business angle</span>
                      <p className="text-xs text-white/55 leading-relaxed mt-0.5">{entry.business_angle}</p>
                    </div>
                  </div>
                )}
                {steps.length > 0 && (
                  <div>
                    <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wide">Steps</span>
                    <ol className="mt-1 space-y-1">
                      {steps.map((s, i) => (
                        <li key={i} className="text-xs text-white/55 leading-relaxed">
                          <span className="text-white/30 mr-1">{i + 1}.</span> {s.text}
                          {s.prompt && <code className="block mt-0.5 ml-4 px-2 py-1 rounded bg-white/[0.05] text-[10px] text-cyan-300/80">{s.prompt}</code>}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {entry.result && (
                  <div>
                    <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wide">Result</span>
                    <p className="text-xs text-white/55 leading-relaxed mt-0.5">{entry.result}</p>
                  </div>
                )}
                {entry.review_notes && (
                  <div className="px-2.5 py-2 rounded-lg bg-orange-500/[0.06] border border-orange-500/15">
                    <span className="text-[10px] font-semibold text-orange-300/80 uppercase tracking-wide flex items-center gap-1">
                      <AlertTriangle className="w-2.5 h-2.5" /> Review notes
                    </span>
                    <p className="text-xs text-orange-200/60 leading-relaxed mt-0.5">{entry.review_notes}</p>
                  </div>
                )}
                {entry.model_name && (
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300">{entry.model_name}</span>
                    {entry.vendor && <span className="px-2 py-0.5 rounded bg-white/[0.05] text-white/50">{entry.vendor}</span>}
                    {entry.benchmark_score != null && (
                      <span className="px-2 py-0.5 rounded bg-white/[0.05] text-white/50">
                        {entry.benchmark_name ? `${entry.benchmark_name}: ` : 'Score: '}{entry.benchmark_score}
                      </span>
                    )}
                    {entry.price_input && <span className="px-2 py-0.5 rounded bg-white/[0.05] text-white/50">In: {entry.price_input}</span>}
                    {entry.price_output && <span className="px-2 py-0.5 rounded bg-white/[0.05] text-white/50">Out: {entry.price_output}</span>}
                  </div>
                )}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {tags.map((t) => (
                      <span key={t} className="px-1.5 py-0.5 rounded bg-white/[0.06] text-[10px] text-white/45 flex items-center gap-0.5">
                        <Tag className="w-2 h-2" /> {t}
                      </span>
                    ))}
                  </div>
                )}
                {roleTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {roleTags.map((t) => (
                      <span key={t} className="px-1.5 py-0.5 rounded bg-amber-500/10 text-[10px] text-amber-300/80 flex items-center gap-0.5">
                        <Building2 className="w-2 h-2" /> {t}
                      </span>
                    ))}
                  </div>
                )}
                {/* Sources display */}
                {sources.length > 0 && (
                  <div>
                    <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wide">Sources</span>
                    <div className="mt-1 space-y-1">
                      {sources.map((s, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[10px] text-white/50">
                          <span>{s.name || 'Unknown'}</span>
                          {s.date && <span className="text-white/30">· {s.date}</span>}
                          {s.url && (
                            <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-cyan-400/70 hover:text-cyan-300 transition-colors">
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action bar */}
            <div className="mt-3 pt-2.5 border-t border-white/[0.05] flex items-center gap-2">
              <select value={entry.type} onChange={(e) => onUpdate(entry.id, { type: e.target.value as EntryType })}
                className="px-2 py-1 rounded-md bg-white/[0.05] border border-white/10 text-white text-[10px] focus:outline-none focus:border-blue-500/50">
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v} className="bg-[#0f1523]">{l}</option>)}
              </select>
              <select value={entry.system_layer || ''} onChange={(e) => onUpdate(entry.id, { system_layer: (e.target.value || null) as SystemLayer | null })}
                className="px-2 py-1 rounded-md bg-white/[0.05] border border-white/10 text-white text-[10px] focus:outline-none focus:border-blue-500/50">
                <option value="" className="bg-[#0f1523]">— None —</option>
                {Object.entries(LAYER_LABELS).map(([v, l]) => <option key={v} value={v} className="bg-[#0f1523]">{l}</option>)}
              </select>
              <button onClick={() => setEditing(true)} className="ml-auto px-2.5 py-1 rounded-md border border-white/10 text-white/50 text-[10px] hover:text-white/80 hover:bg-white/[0.05] transition-all">
                Edit
              </button>
              <button onClick={() => onDelete(entry.id)} className="p-1.5 rounded-md border border-red-500/20 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Delete">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Model Tracker Card ─────────────────────────────────
function ModelTrackerCard({ entry }: { entry: SignalEntry }) {
  const sources = getSources(entry);
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden hover:border-white/[0.12] transition-all">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.05]">
        <Cpu className="w-3.5 h-3.5 text-cyan-400" />
        <span className="text-sm font-bold text-white">{entry.model_name}</span>
        {entry.vendor && <span className="text-[10px] text-white/40">by {entry.vendor}</span>}
        <span className="text-[10px] text-white/25 ml-auto">
          {getSourceDate(entry) || new Date(entry.created_at).toLocaleDateString()}
        </span>
      </div>
      <div className="px-4 py-3">
        <p className="text-xs text-white/50 leading-relaxed mb-2">{entry.summary}</p>
        <div className="flex flex-wrap gap-2 text-[10px]">
          {entry.benchmark_score != null && (
            <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-semibold">
              {entry.benchmark_name ? `${entry.benchmark_name}: ` : 'Score: '}{entry.benchmark_score}
            </span>
          )}
          {entry.price_input && <span className="px-2 py-0.5 rounded bg-white/[0.05] text-white/50">In: {entry.price_input}</span>}
          {entry.price_output && <span className="px-2 py-0.5 rounded bg-white/[0.05] text-white/50">Out: {entry.price_output}</span>}
          <span className={`px-2 py-0.5 rounded ${entry.status === 'published' ? 'bg-green-500/10 text-green-300' : 'bg-white/[0.05] text-white/40'}`}>
            {entry.status}
          </span>
        </div>
        {sources.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-white/40">
            {sources.map((s, i) => (
              <span key={i} className="flex items-center gap-0.5">
                {s.name}
                {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-2.5 h-2.5" /></a>}
                {i < sources.length - 1 && <span className="text-white/20">·</span>}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Model Tracker Groups (rank by benchmark_name) ─────
function ModelTrackerGroups({ entries }: { entries: SignalEntry[] }) {
  const withScores = entries.filter((e) => e.benchmark_score != null && e.benchmark_name);
  const withoutScores = entries.filter((e) => e.benchmark_score == null || !e.benchmark_name);

  // Group scored entries by benchmark_name, sort each group by score descending
  const groups = new Map<string, SignalEntry[]>();
  for (const e of withScores) {
    const name = e.benchmark_name!;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name)!.push(e);
  }
  for (const [, list] of groups) {
    list.sort((a, b) => (b.benchmark_score ?? 0) - (a.benchmark_score ?? 0));
  }
  const sortedGroups = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="space-y-6">
      {sortedGroups.map(([benchName, models]) => (
        <div key={benchName}>
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <h4 className="text-xs font-bold text-white/70">{benchName}</h4>
            <span className="text-[10px] text-white/30">({models.length} models)</span>
          </div>
          <div className="space-y-3">
            {models.map((entry, idx) => (
              <div key={entry.id} className="relative">
                {idx === 0 && (
                  <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-amber-400/60" />
                )}
                <ModelTrackerCard key={entry.id} entry={entry} />
              </div>
            ))}
          </div>
        </div>
      ))}

      {withoutScores.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Cpu className="w-3.5 h-3.5 text-white/30" />
            <h4 className="text-xs font-bold text-white/40">No benchmark score</h4>
            <span className="text-[10px] text-white/30">({withoutScores.length} models)</span>
          </div>
          <div className="space-y-3">
            {withoutScores.map((entry) => (
              <ModelTrackerCard key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Recheck Modal ──────────────────────────────────────
function RecheckModal({
  proposals,
  onClose,
  onApply,
}: {
  proposals: ReviewProposal[];
  onClose: () => void;
  onApply: (selectedIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(proposals.map((p) => p.id)));
  const hasCorrections = proposals.some((p) => p.corrections.length > 0);
  const correctionsCount = proposals.filter((p) => p.corrections.length > 0 && selected.has(p.id)).length;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl border border-white/10 bg-[#0c1220] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.08]">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-cyan-400" />
            Quality Review Results
          </h3>
          <button onClick={onClose} className="p-1 text-white/40 hover:text-white/80 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 space-y-3">
          <p className="text-xs text-white/40 leading-relaxed">
            Proposed corrections are shown first (blue). Unresolved issues requiring your attention are shown below (orange). Select which entries to apply corrections to — manually edited fields will not be changed.
          </p>
          {proposals.map((p) => {
            const isSelected = selected.has(p.id);
            return (
              <div key={p.id} className={`rounded-lg border p-3 transition-all ${
                isSelected ? 'border-cyan-500/30 bg-cyan-500/[0.04]' : 'border-white/[0.06] bg-white/[0.01]'
              }`}>
                <div className="flex items-start gap-2.5">
                  <button onClick={() => toggle(p.id)} className="mt-0.5 flex-shrink-0">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                      isSelected ? 'border-cyan-400 bg-cyan-500/20' : 'border-white/20'
                    }`}>
                      {isSelected && <CheckCircle2 className="w-3 h-3 text-cyan-300" />}
                    </div>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white leading-snug">{p.title}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] text-white/30">{(p.current_review_status || 'none').replace(/_/g, ' ')}</span>
                      <span className="text-[10px] text-white/20">→</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        p.proposed_review_status === 'needs_attention'
                          ? 'bg-orange-500/15 text-orange-300'
                          : 'bg-green-500/15 text-green-300'
                      }`}>
                        {p.proposed_review_status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    {/* Proposed corrections (automatic) */}
                    {p.corrections.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        <span className="text-[9px] text-cyan-400/60 uppercase tracking-wide">Proposed corrections</span>
                        {p.corrections.map((c, i) => (
                          <div key={i} className="px-2 py-1.5 rounded bg-cyan-500/[0.06] border border-cyan-500/15">
                            <p className="text-[10px] text-cyan-300/70">{c.description}</p>
                            <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                              <span className="text-white/40 line-through truncate">{c.before}</span>
                              <span className="text-cyan-400/60">→</span>
                              <span className="text-cyan-300 truncate">{c.after}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Unresolved issues (need admin attention) */}
                    {p.issues.length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        <span className="text-[9px] text-orange-400/60 uppercase tracking-wide">Unresolved issues</span>
                        <ul className="space-y-0.5 mt-0.5">
                          {p.issues.map((issue, i) => (
                            <li key={i} className="text-[11px] text-orange-200/60 leading-relaxed flex items-start gap-1">
                              <AlertTriangle className="w-2.5 h-2.5 text-orange-400/50 flex-shrink-0 mt-0.5" />
                              <span><span className="text-orange-300/70 font-medium">{issue.field}:</span> {issue.message}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* No issues — all clear */}
                    {p.corrections.length === 0 && p.issues.length === 0 && (
                      <p className="mt-1.5 text-[11px] text-green-400/60 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> All checks passed.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.08]">
          <span className="text-[10px] text-white/35">
            {hasCorrections
              ? `${correctionsCount} correction${correctionsCount === 1 ? '' : 's'} to apply`
              : 'No corrections to apply — review issues and close'}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-white/10 text-white/50 text-xs hover:text-white/80 transition-all">
              Close
            </button>
            <button
              onClick={() => onApply(Array.from(selected))}
              disabled={!hasCorrections || correctionsCount === 0}
              className="px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/30 disabled:opacity-40 transition-all">
              Apply corrections {correctionsCount > 0 ? `(${correctionsCount})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Repair Modal ───────────────────────────────────────
interface RepairProposal {
  id: string;
  title: string;
  found: boolean;
  proposed_result: string | null;
  explanation: string;
}

function RepairModal({
  proposals,
  onClose,
  onApply,
}: {
  proposals: RepairProposal[];
  onClose: () => void;
  onApply: (selectedIds: string[], results: Map<string, string>) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(proposals.filter((p) => p.found).map((p) => p.id))
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const foundCount = proposals.filter((p) => p.found).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl border border-white/10 bg-[#0c1220] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.08]">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Wrench className="w-4 h-4 text-amber-400" />
            Source-Based Repair Results
          </h3>
          <button onClick={onClose} className="p-1 text-white/40 hover:text-white/80 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 space-y-3">
          <p className="text-xs text-white/40 leading-relaxed">
            Each entry was checked against its source newsletter for an explicit outcome. Select entries with found results to fill the result field. Entries with no outcome found will remain Needs attention.
          </p>
          {proposals.map((p) => {
            const isSelected = selected.has(p.id);
            const canSelect = p.found && p.proposed_result;
            return (
              <div key={p.id} className={`rounded-lg border p-3 transition-all ${
                isSelected ? 'border-amber-500/30 bg-amber-500/[0.04]' : 'border-white/[0.06] bg-white/[0.01]'
              }`}>
                <div className="flex items-start gap-2.5">
                  <button onClick={() => canSelect && toggle(p.id)} className="mt-0.5 flex-shrink-0" disabled={!canSelect}>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                      isSelected ? 'border-amber-400 bg-amber-500/20' : canSelect ? 'border-white/20' : 'border-white/10 opacity-30'
                    }`}>
                      {isSelected && <CheckCircle2 className="w-3 h-3 text-amber-300" />}
                    </div>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white leading-snug">{p.title}</p>
                    {p.found && p.proposed_result ? (
                      <div className="mt-2 px-2 py-1.5 rounded bg-amber-500/[0.06] border border-amber-500/15">
                        <span className="text-[9px] text-amber-400/60 uppercase tracking-wide">Proposed result</span>
                        <p className="text-[11px] text-amber-200/80 mt-0.5 leading-relaxed">{p.proposed_result}</p>
                        <p className="text-[10px] text-white/30 mt-1">{p.explanation}</p>
                      </div>
                    ) : (
                      <div className="mt-2 px-2 py-1.5 rounded bg-orange-500/[0.06] border border-orange-500/15">
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-orange-400/60" />
                          <span className="text-[11px] text-orange-300/70 font-medium">No outcome found in source</span>
                        </div>
                        <p className="text-[10px] text-white/30 mt-1">{p.explanation}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.08]">
          <span className="text-[10px] text-white/35">
            {foundCount} outcome{foundCount === 1 ? '' : 's'} found · {selected.size} selected to apply
          </span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-white/10 text-white/50 text-xs hover:text-white/80 transition-all">
              Close
            </button>
            <button
              onClick={() => {
                const results = new Map<string, string>();
                for (const p of proposals) {
                  if (selected.has(p.id) && p.proposed_result) {
                    results.set(p.id, p.proposed_result);
                  }
                }
                onApply(Array.from(selected), results);
              }}
              disabled={selected.size === 0}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold hover:bg-amber-500/30 disabled:opacity-40 transition-all">
              Apply results {selected.size > 0 ? `(${selected.size})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────
export default function AdminSignalDesk() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [entries, setEntries] = useState<SignalEntry[]>([]);
  const [modelEntries, setModelEntries] = useState<SignalEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [activeTab, setActiveTab] = useState<'review' | 'models' | 'new'>('review');
  const [processUrl, setProcessUrl] = useState('');
  const [processText, setProcessText] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [sourceDate, setSourceDate] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processMsg, setProcessMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [notesText, setNotesText] = useState('');
  const [notesProcessing, setNotesProcessing] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'needs_attention' | 'ready_for_review' | 'not_checked'>('all');
  const [recheckLoading, setRecheckLoading] = useState(false);
  const [recheckProgress, setRecheckProgress] = useState<{ done: number; total: number } | null>(null);
  const [recheckMsg, setRecheckMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [recheckProposals, setRecheckProposals] = useState<ReviewProposal[] | null>(null);
  const [recheckSummary, setRecheckSummary] = useState<ReviewSummary | null>(null);
  const [repairLoading, setRepairLoading] = useState(false);
  const [repairProposals, setRepairProposals] = useState<RepairProposal[] | null>(null);
  const [repairMsg, setRepairMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      if (data.session) {
        const role = data.session.user.app_metadata?.role;
        setIsAdmin(role === 'admin');
        setAdminEmail(data.session.user.email || '');
      }
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
      if (session) {
        const role = session.user.app_metadata?.role;
        setIsAdmin(role === 'admin');
        setAdminEmail(session.user.email || '');
      } else {
        setIsAdmin(false);
        setAdminEmail('');
      }
      setAuthChecked(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadEntries = useCallback(async () => {
    setLoadingEntries(true);
    const { data, error } = await supabase
      .from('signal_desk_entries')
      .select('*')
      .eq('status', 'draft')
      .order('created_at', { ascending: false });
    if (!error && data) {
      setEntries(data as SignalEntry[]);
    }
    setLoadingEntries(false);
  }, []);

  const loadModelEntries = useCallback(async () => {
    // Fetch all model_release entries, then deduplicate by model_name keeping newest
    const { data, error } = await supabase
      .from('signal_desk_entries')
      .select('*')
      .eq('type', 'model_release')
      .not('model_name', 'is', null)
      .order('created_at', { ascending: false });
    if (!error && data) {
      const all = data as SignalEntry[];
      const seen = new Set<string>();
      const deduped: SignalEntry[] = [];
      for (const e of all) {
        if (e.model_name && !seen.has(e.model_name)) {
          seen.add(e.model_name);
          deduped.push(e);
        }
      }
      setModelEntries(deduped);
    }
  }, []);

  useEffect(() => {
    if (authed) {
      loadEntries();
      loadModelEntries();
    }
  }, [authed, loadEntries, loadModelEntries]);

  const handleProcess = async () => {
    if (!processUrl.trim() && (!processText.trim() || processText.trim().length < 50)) {
      setProcessMsg({ type: 'error', text: 'Enter a newsletter URL or paste at least 50 characters of text.' });
      return;
    }
    setProcessing(true);
    setProcessMsg(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setProcessMsg({ type: 'error', text: 'Not authenticated.' });
        setProcessing(false);
        return;
      }
      const funcUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-newsletter`;
      const resp = await fetch(funcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          url: processUrl.trim() || null,
          text: processText.trim() || null,
          source_name: sourceName || null,
          source_date: sourceDate || null,
        }),
      });
      const result = await resp.json();
      if (!resp.ok) {
        setProcessMsg({ type: 'error', text: result.error || `Request failed (${resp.status})` });
      } else {
        const newCount = result.new_count ?? 0;
        const dupCount = result.duplicate_count ?? 0;
        const needsAttn = result.needs_attention_count ?? 0;
        const total = result.count ?? result.entries?.length ?? 0;
        if (total === 0) {
          const msg = result.message || result.validation_errors?.join('; ') || 'No valid entries found in the text.';
          setProcessMsg({ type: 'info', text: msg });
          // Preserve inputs on zero-entries so admin can adjust and retry
        } else {
          const parts: string[] = [`${newCount} new`];
          if (dupCount > 0) parts.push(`${dupCount} possible duplicate${dupCount > 1 ? 's' : ''}`);
          if (needsAttn > 0) parts.push(`${needsAttn} need${needsAttn > 1 ? '' : 's'} attention`);
          setProcessMsg({ type: 'success', text: `${parts.join(', ')} entries saved as drafts.` });
          setProcessText('');
          setProcessUrl('');
        }
        loadEntries();
        loadModelEntries();
      }
    } catch {
      setProcessMsg({ type: 'error', text: 'Network error. Please try again.' });
    }
    setProcessing(false);
  };

  const handleProcessNotes = async () => {
    if (notesText.trim().length < 20) {
      setProcessMsg({ type: 'error', text: 'Notes must be at least 20 characters.' });
      return;
    }
    setNotesProcessing(true);
    setProcessMsg(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setProcessMsg({ type: 'error', text: 'Not authenticated.' });
        setNotesProcessing(false);
        return;
      }
      const funcUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-newsletter`;
      const resp = await fetch(funcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ mode: 'notes', text: notesText.trim() }),
      });
      const result = await resp.json();
      if (!resp.ok) {
        setProcessMsg({ type: 'error', text: result.error || `Request failed (${resp.status})` });
      } else {
        setProcessMsg({ type: 'success', text: 'Draft created from your notes. Review and edit below.' });
        setNotesText('');
        loadEntries();
        setActiveTab('review');
      }
    } catch {
      setProcessMsg({ type: 'error', text: 'Network error. Please try again.' });
    }
    setNotesProcessing(false);
  };

  const handleRecheck = async () => {
    if (normalDrafts.length === 0) return;
    setRecheckLoading(true);
    setRecheckMsg(null);
    setRecheckProposals(null);
    setRecheckSummary(null);
    setRecheckProgress({ done: 0, total: normalDrafts.length });

    try {
      const allProposals: ReviewProposal[] = [];
      const BATCH = 3;
      for (let i = 0; i < normalDrafts.length; i += BATCH) {
        const batch = normalDrafts.slice(i, i + BATCH);
        for (const entry of batch) {
          allProposals.push(reviewDraft(entry));
        }
        setRecheckProgress({ done: Math.min(i + BATCH, normalDrafts.length), total: normalDrafts.length });
        await new Promise((r) => setTimeout(r, 50));
      }

      // Save check results to DB for ALL entries — not just those with changes
      let savedCount = 0;
      let failedCount = 0;
      for (const p of allProposals) {
        const patch = {
          review_status: p.proposed_review_status,
          review_notes: p.proposed_review_notes,
        };
        const { error } = await supabase
          .from('signal_desk_entries')
          .update(patch)
          .eq('id', p.id);
        if (error) {
          failedCount++;
        } else {
          savedCount++;
          setEntries((prev) => prev.map((e) =>
            e.id === p.id ? { ...e, review_status: p.proposed_review_status, review_notes: p.proposed_review_notes } : e
          ));
        }
      }

      const summary: ReviewSummary = {
        checked: allProposals.length,
        withCorrections: allProposals.filter((p) => p.corrections.length > 0).length,
        ready: allProposals.filter((p) => p.proposed_review_status === 'ready_for_review').length,
        needsAttention: allProposals.filter((p) => p.proposed_review_status === 'needs_attention').length,
        failed: failedCount,
      };
      setRecheckSummary(summary);

      // Show proposals for entries that have corrections OR issues
      const withProposals = allProposals.filter((p) => p.corrections.length > 0 || p.issues.length > 0);
      if (withProposals.length > 0) {
        setRecheckProposals(withProposals);
      }

      // Build completion message
      const parts: string[] = [`${summary.checked} checked`];
      if (summary.withCorrections > 0) parts.push(`${summary.withCorrections} with proposed corrections`);
      if (summary.ready > 0) parts.push(`${summary.ready} ready`);
      if (summary.needsAttention > 0) parts.push(`${summary.needsAttention} need attention`);
      if (summary.failed > 0) parts.push(`${summary.failed} failed to save`);

      if (summary.failed > 0) {
        setRecheckMsg({ type: 'error', text: `${parts.join(', ')}. Retry to re-save failed entries.` });
      } else if (summary.needsAttention > 0) {
        setRecheckMsg({ type: 'info', text: `${parts.join(', ')}. Review proposed changes below.` });
      } else {
        setRecheckMsg({ type: 'success', text: `${parts.join(', ')}. All drafts passed quality checks.` });
      }
    } catch (err) {
      setRecheckMsg({ type: 'error', text: `Recheck failed: ${(err as Error)?.message || 'Unknown error'}` });
    }
    setRecheckLoading(false);
    setRecheckProgress(null);
  };

  const handleApplyRecheck = async (selectedIds: string[]) => {
    const proposals = recheckProposals || [];
    const toApply = proposals.filter((p) => selectedIds.includes(p.id));
    if (toApply.length === 0) {
      setRecheckProposals(null);
      return;
    }

    setRecheckMsg(null);
    let applied = 0;
    let failed = 0;
    const failedIds: string[] = [];

    for (const p of toApply) {
      // Apply only the corrections the admin approved — don't touch other fields
      const patch: Partial<SignalEntry> = {};
      if (p.proposed_title) patch.title = p.proposed_title;

      // Only apply corrections that were proposed (title prefix removal)
      // Status and notes will be recalculated after applying corrections
      if (Object.keys(patch).length === 0) continue;

      const { error } = await supabase.from('signal_desk_entries').update(patch).eq('id', p.id);
      if (error) {
        failed++;
        failedIds.push(p.id);
      } else {
        applied++;
        // Update local state with the corrected title
        setEntries((prev) => prev.map((e) =>
          e.id === p.id ? { ...e, ...patch } : e
        ));

        // Re-review the entry with the corrected title to recalculate status
        const entry = entries.find((e) => e.id === p.id);
        if (entry) {
          const reReview = reReviewAfterApply(entry, patch.title);
          await supabase
            .from('signal_desk_entries')
            .update({ review_status: reReview.status, review_notes: reReview.notes })
            .eq('id', p.id);
          setEntries((prev) => prev.map((e) =>
            e.id === p.id ? { ...e, review_status: reReview.status, review_notes: reReview.notes } : e
          ));
        }
      }
    }

    if (failed > 0) {
      setRecheckMsg({ type: 'error', text: `${applied} corrections applied, ${failed} failed. Click Recheck again to retry.` });
      setRecheckProposals((prev) => prev?.filter((p) => failedIds.includes(p.id)) || null);
    } else {
      setRecheckMsg({ type: 'success', text: `Applied ${applied} correction${applied === 1 ? '' : 's'}. Status recalculated from remaining issues.` });
      setRecheckProposals(null);
      loadEntries();
    }
  };

  const handleRepair = async () => {
    const needsRepair = normalDrafts.filter(
      (e) => e.type === 'use_case' && e.review_status === 'needs_attention' && (!e.result || e.result.trim() === '')
    );
    if (needsRepair.length === 0) {
      setRepairMsg({ type: 'info', text: 'No use case entries need result repair.' });
      return;
    }

    setRepairLoading(true);
    setRepairMsg(null);
    setRepairProposals(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setRepairMsg({ type: 'error', text: 'Not authenticated.' });
        setRepairLoading(false);
        return;
      }

      const funcUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-newsletter`;
      const resp = await fetch(funcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          mode: 'repair',
          entry_ids: needsRepair.map((e) => e.id),
        }),
      });
      const result = await resp.json();
      if (!resp.ok) {
        setRepairMsg({ type: 'error', text: result.error || `Repair failed (${resp.status})` });
      } else {
        const proposals: RepairProposal[] = result.proposals || [];
        setRepairProposals(proposals);
        const found = proposals.filter((p) => p.found).length;
        const notFound = proposals.length - found;
        if (found > 0 && notFound > 0) {
          setRepairMsg({ type: 'info', text: `${found} outcome${found === 1 ? '' : 's'} found, ${notFound} not found in source. Review below.` });
        } else if (found > 0) {
          setRepairMsg({ type: 'success', text: `${found} outcome${found === 1 ? '' : 's'} found in source. Review below.` });
        } else {
          setRepairMsg({ type: 'info', text: 'No outcomes found in source for any entry. They remain Needs attention.' });
        }
      }
    } catch {
      setRepairMsg({ type: 'error', text: 'Network error during repair.' });
    }
    setRepairLoading(false);
  };

  const handleApplyRepair = async (selectedIds: string[], results: Map<string, string>) => {
    if (selectedIds.length === 0 || results.size === 0) {
      setRepairProposals(null);
      return;
    }

    setRepairMsg(null);
    let applied = 0;
    let failed = 0;

    for (const id of selectedIds) {
      const resultText = results.get(id);
      if (!resultText) continue;

      const entry = entries.find((e) => e.id === id);
      if (!entry) continue;

      // Apply the result field, then re-review to recalculate status
      const { error } = await supabase
        .from('signal_desk_entries')
        .update({ result: resultText })
        .eq('id', id);

      if (error) {
        failed++;
      } else {
        applied++;
        const updated = { ...entry, result: resultText };
        const reReview = reReviewAfterApply(updated, undefined);
        await supabase
          .from('signal_desk_entries')
          .update({ review_status: reReview.status, review_notes: reReview.notes })
          .eq('id', id);
        setEntries((prev) => prev.map((e) =>
          e.id === id ? { ...e, result: resultText, review_status: reReview.status, review_notes: reReview.notes } : e
        ));
      }
    }

    if (failed > 0) {
      setRepairMsg({ type: 'error', text: `${applied} results applied, ${failed} failed. Click Repair again to retry.` });
    } else {
      setRepairMsg({ type: 'success', text: `Applied ${applied} result${applied === 1 ? '' : 's'}. Status recalculated from remaining issues.` });
    }
    setRepairProposals(null);
    loadEntries();
  };

  const handleCreateBlankEntry = async () => {
    setProcessMsg(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) {
        setProcessMsg({ type: 'error', text: 'Not authenticated.' });
        return;
      }
      // Generate a temporary slug from timestamp
      const tempSlug = `entry-${Date.now()}`;
      const { error } = await supabase
        .from('signal_desk_entries')
        .insert({
          type: 'news',
          system_layer: null,
          title: 'Untitled entry',
          summary: '',
          why_it_matters: null,
          how_its_built: null,
          business_angle: null,
          steps: [],
          tags: [],
          role_tags: [],
          origin: 'original',
          source_name: 'Clarent Technologies',
          source_date: today,
          source_url: null,
          sources: [{ name: 'Clarent Technologies', date: today, url: null }],
          duplicate_of: null,
          duplicate_status: 'none',
          slug: tempSlug,
          status: 'draft',
          review_status: 'not_checked',
        })
        .select('id');
      if (error) {
        setProcessMsg({ type: 'error', text: `Create failed: ${error.message}` });
        return;
      }
      setProcessMsg({ type: 'success', text: 'Blank entry created. Edit it below.' });
      loadEntries();
      setActiveTab('review');
    } catch {
      setProcessMsg({ type: 'error', text: 'Failed to create blank entry.' });
    }
  };

  const handleUpdate = async (id: string, patch: Partial<SignalEntry>) => {
    // If source_date or source_name is being updated, sync into sources[0]
    // so public display (which reads sources[0].date) stays consistent.
    if (patch.source_date !== undefined || patch.source_name !== undefined) {
      const entry = entries.find((e) => e.id === id);
      if (entry) {
        const currentSources = getSources(entry);
        const updatedFirst = {
          name: patch.source_name !== undefined ? patch.source_name : (currentSources[0]?.name ?? entry.source_name ?? null),
          date: patch.source_date !== undefined ? patch.source_date : (currentSources[0]?.date ?? entry.source_date ?? null),
          url: currentSources[0]?.url ?? entry.source_url ?? null,
        };
        const remaining = currentSources.slice(1);
        patch.sources = [updatedFirst, ...remaining];
      }
    }
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    const { error } = await supabase.from('signal_desk_entries').update(patch).eq('id', id);
    if (error) {
      setProcessMsg({ type: 'error', text: `Update failed: ${error.message}` });
      loadEntries();
    }
  };

  const handlePublish = async (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    const { error } = await supabase.from('signal_desk_entries').update({ status: 'published' }).eq('id', id);
    if (error) {
      setProcessMsg({ type: 'error', text: `Publish failed: ${error.message}` });
      loadEntries();
    } else {
      loadModelEntries();
    }
  };

  const handleDelete = async (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    const { error } = await supabase.from('signal_desk_entries').delete().eq('id', id);
    if (error) {
      setProcessMsg({ type: 'error', text: `Delete failed: ${error.message}` });
      loadEntries();
    } else {
      loadModelEntries();
    }
  };

  // ── Duplicate resolution handlers ───────────────────
  const handleMerge = async (id: string, targetId: string) => {
    const dup = entries.find((e) => e.id === id);
    const target = entries.find((e) => e.id === targetId);
    if (!dup || !target) return;

    // Merge: add the new source to the target's sources array
    const dupSources = getSources(dup);
    const targetSources = getSources(target);
    const mergedSources = [...targetSources, ...dupSources];

    // Update target with merged sources and any new details if the dup has them
    const patch: Partial<SignalEntry> = { sources: mergedSources };
    if (dup.benchmark_score != null && target.benchmark_score == null) { patch.benchmark_score = dup.benchmark_score; patch.benchmark_name = dup.benchmark_name; }
    if (dup.price_input && !target.price_input) patch.price_input = dup.price_input;
    if (dup.price_output && !target.price_output) patch.price_output = dup.price_output;

    const { error: mergeError } = await supabase
      .from('signal_desk_entries')
      .update(patch)
      .eq('id', targetId);
    if (mergeError) {
      setProcessMsg({ type: 'error', text: `Merge failed: ${mergeError.message}` });
      loadEntries();
      return;
    }

    // Mark the duplicate as merged and remove from queue
    await supabase.from('signal_desk_entries').update({ duplicate_status: 'merged' }).eq('id', id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setProcessMsg({ type: 'success', text: `Merged into "${target.title}".` });
    loadModelEntries();
  };

  const handleKeepSeparate = async (id: string) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, duplicate_status: 'separate', duplicate_of: null } : e)));
    const { error } = await supabase.from('signal_desk_entries')
      .update({ duplicate_status: 'separate', duplicate_of: null }).eq('id', id);
    if (error) {
      setProcessMsg({ type: 'error', text: `Update failed: ${error.message}` });
      loadEntries();
    } else {
      setProcessMsg({ type: 'info', text: 'Kept as a separate entry.' });
    }
  };

  const handleDiscard = async (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    const { error } = await supabase.from('signal_desk_entries')
      .update({ duplicate_status: 'discarded' }).eq('id', id);
    if (error) {
      setProcessMsg({ type: 'error', text: `Discard failed: ${error.message}` });
      loadEntries();
    } else {
      setProcessMsg({ type: 'info', text: 'Duplicate discarded.' });
    }
  };

  const handleSignOut = () => supabase.auth.signOut();

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#080c14] text-white">
        <NavBar />
        <div className="pt-20 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#080c14] text-white font-sans antialiased">
        <NavBar />
        <AuthGate onSignedIn={() => setAuthed(true)} />
      </div>
    );
  }

  // Non-admins are redirected to /learn
  if (authChecked && !isAdmin) {
    navigate('/learn');
    return (
      <div className="min-h-screen bg-[#080c14] text-white">
        <NavBar />
        <div className="pt-20 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
        </div>
      </div>
    );
  }

  // Separate drafts and possible duplicates
  const normalDrafts = entries.filter((e) => e.duplicate_status !== 'possible');
  const possibleDups = entries.filter((e) => e.duplicate_status === 'possible');
  const needsAttentionCount = normalDrafts.filter((e) => e.review_status === 'needs_attention').length;
  const filteredDrafts = reviewFilter === 'all' ? normalDrafts
    : reviewFilter === 'not_checked' ? normalDrafts.filter((e) => !e.review_status || e.review_status === 'not_checked')
    : normalDrafts.filter((e) => e.review_status === reviewFilter);

  return (
    <div className="min-h-screen bg-[#080c14] text-white font-sans antialiased">
      <NavBar />

      <div className="pt-14 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <Newspaper className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Signal Desk</h1>
              <p className="text-[11px] text-white/35">Turn AI news into learning content</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-white/40">
              Signed in as <span className="text-white/60 font-medium">{adminEmail}</span>
            </span>
            <button onClick={handleSignOut} className="text-xs text-white/40 hover:text-white/70 transition-colors">
              Sign out
            </button>
          </div>
        </div>

        {/* Process form */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 mb-6">
          <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Send className="w-3.5 h-3.5 text-cyan-400" />
            Process Newsletter
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <input value={sourceName} onChange={(e) => setSourceName(e.target.value)}
              placeholder="Source name (auto-filled from URL, override as needed)"
              className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-all" />
            <input type="date" value={sourceDate} onChange={(e) => setSourceDate(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-all" />
          </div>
          <div className="relative mb-3">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
            <input value={processUrl} onChange={(e) => setProcessUrl(e.target.value)}
              placeholder="Newsletter URL (optional — we'll fetch and extract the text)"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-all" />
          </div>
          <textarea value={processText} onChange={(e) => setProcessText(e.target.value)}
            placeholder="Paste newsletter text here…" rows={8}
            className="w-full px-3 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-all resize-y font-mono" />
          <div className="mt-3 flex items-center gap-3">
            <button onClick={handleProcess} disabled={processing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-semibold hover:from-blue-400 hover:to-cyan-400 disabled:opacity-60 transition-all">
              {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {processing ? 'Processing…' : 'Process'}
            </button>
            {processMsg && (
              <div className={`flex items-center gap-1.5 text-xs ${
                processMsg.type === 'success' ? 'text-green-400'
                : processMsg.type === 'error' ? 'text-red-400' : 'text-white/50'
              }`}>
                {processMsg.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" />
                 : processMsg.type === 'error' ? <AlertCircle className="w-3.5 h-3.5" /> : null}
                {processMsg.text}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-4 border-b border-white/[0.06]">
          <button onClick={() => setActiveTab('review')}
            className={`px-3 py-2 text-xs font-semibold transition-all border-b-2 -mb-px ${
              activeTab === 'review' ? 'text-white border-blue-500' : 'text-white/40 border-transparent hover:text-white/70'
            }`}>
            Review Queue
            {possibleDups.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[9px]">
                {possibleDups.length} dup
              </span>
            )}
          </button>
          <button onClick={() => setActiveTab('models')}
            className={`px-3 py-2 text-xs font-semibold transition-all border-b-2 -mb-px ${
              activeTab === 'models' ? 'text-white border-blue-500' : 'text-white/40 border-transparent hover:text-white/70'
            }`}>
            Model Tracker
          </button>
          <button onClick={() => setActiveTab('new')}
            className={`px-3 py-2 text-xs font-semibold transition-all border-b-2 -mb-px ${
              activeTab === 'new' ? 'text-white border-emerald-500' : 'text-white/40 border-transparent hover:text-white/70'
            }`}>
            New Entry
          </button>
        </div>

        {/* Review Queue tab */}
        {activeTab === 'review' && (
          <>
            {/* Possible duplicates first */}
            {possibleDups.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-bold text-amber-300/80 mb-3 flex items-center gap-1.5">
                  <GitMerge className="w-3.5 h-3.5" />
                  Possible Duplicates ({possibleDups.length})
                </h3>
                <div className="space-y-3">
                  {possibleDups.map((entry) => (
                    <div key={entry.id}>
                      <EntryCardBoundary entryTitle={entry.title}>
                      <EntryCard entry={entry} onUpdate={handleUpdate} onDelete={handleDelete}
                        onMerge={handleMerge} onKeepSeparate={handleKeepSeparate} onDiscard={handleDiscard}
                        allEntries={entries} />
                      </EntryCardBoundary>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Normal drafts */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-white/60 flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 text-white/40" />
                  Drafts
                  <span className="text-[10px] text-white/30 font-normal">({normalDrafts.length})</span>
                </h3>
                {/* Filter pills */}
                <div className="flex items-center gap-1 ml-2">
                  {(['all', 'needs_attention', 'ready_for_review', 'not_checked'] as const).map((f) => {
                    const label = f === 'all' ? 'All' : f === 'needs_attention' ? 'Needs attention' : f === 'ready_for_review' ? 'Ready' : 'Not checked';
                    const count = f === 'all' ? normalDrafts.length : normalDrafts.filter((e) => e.review_status === f || (!e.review_status && f === 'not_checked')).length;
                    return (
                      <button key={f} onClick={() => setReviewFilter(f)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all ${
                          reviewFilter === f
                            ? f === 'needs_attention' ? 'border-orange-500/40 bg-orange-500/15 text-orange-300'
                              : f === 'ready_for_review' ? 'border-green-500/30 bg-green-500/10 text-green-400'
                              : f === 'not_checked' ? 'border-white/20 bg-white/[0.08] text-white/60'
                              : 'border-white/20 bg-white/[0.08] text-white/70'
                            : 'border-white/10 text-white/35 hover:text-white/60'
                        }`}>
                        {label}{count > 0 && f !== 'all' ? ` ${count}` : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <button onClick={handleRecheck} disabled={recheckLoading || normalDrafts.length === 0}
                    className="text-[10px] text-white/40 hover:text-white/70 transition-colors flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
                    {recheckLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ScanLine className="w-3 h-3" />}
                    Recheck drafts
                  </button>
                  {recheckProgress && (
                    <span className="text-[10px] text-white/30">
                      {recheckProgress.done}/{recheckProgress.total}
                    </span>
                  )}
                  {recheckMsg && (
                    <span className={`flex items-center gap-1 text-[10px] ${
                      recheckMsg.type === 'success' ? 'text-green-400'
                      : recheckMsg.type === 'error' ? 'text-red-400' : 'text-white/50'
                    }`}>
                      {recheckMsg.type === 'success' ? <CheckCircle2 className="w-3 h-3" />
                       : recheckMsg.type === 'error' ? <AlertCircle className="w-3 h-3" /> : null}
                      {recheckMsg.text}
                    </span>
                  )}
                  {recheckSummary && !recheckMsg && (
                    <span className="text-[10px] text-white/30">
                      {recheckSummary.checked} checked · {recheckSummary.ready} ready · {recheckSummary.needsAttention} need attention · {recheckSummary.withCorrections} corrections
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleRepair} disabled={repairLoading || needsAttentionCount === 0}
                    className="text-[10px] text-white/40 hover:text-white/70 transition-colors flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
                    {repairLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wrench className="w-3 h-3" />}
                    Repair incomplete
                  </button>
                  {repairMsg && (
                    <span className={`flex items-center gap-1 text-[10px] ${
                      repairMsg.type === 'success' ? 'text-green-400'
                      : repairMsg.type === 'error' ? 'text-red-400' : 'text-white/50'
                    }`}>
                      {repairMsg.type === 'success' ? <CheckCircle2 className="w-3 h-3" />
                       : repairMsg.type === 'error' ? <AlertCircle className="w-3 h-3" /> : null}
                      {repairMsg.text}
                    </span>
                  )}
                </div>
                <button onClick={loadEntries} className="text-[10px] text-white/40 hover:text-white/70 transition-colors flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>
            </div>

            {loadingEntries ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
              </div>
            ) : normalDrafts.length === 0 && possibleDups.length === 0 ? (
              <div className="text-center py-12 rounded-xl border border-white/[0.05] bg-white/[0.01]">
                <Newspaper className="w-8 h-8 text-white/15 mx-auto mb-3" />
                <p className="text-sm text-white/30">No drafts to review. Process a newsletter to get started.</p>
              </div>
            ) : filteredDrafts.length === 0 ? (
              <p className="text-xs text-white/30 text-center py-6">
                {reviewFilter === 'needs_attention' ? 'No drafts need attention. All clear!' : reviewFilter === 'ready_for_review' ? 'No drafts are ready for review yet.' : reviewFilter === 'not_checked' ? 'No unchecked drafts.' : 'No non-duplicate drafts.'}
              </p>
            ) : (
              <div className="space-y-3">
                {filteredDrafts.map((entry) => (
                  <div key={entry.id}>
                    <EntryCardBoundary entryTitle={entry.title}>
                    <EntryCard entry={entry} onUpdate={handleUpdate} onDelete={handleDelete}
                      onMerge={handleMerge} onKeepSeparate={handleKeepSeparate} onDiscard={handleDiscard}
                      allEntries={entries} />
                    </EntryCardBoundary>
                    <div className="flex items-center gap-2 mt-1.5 px-1">
                      <button onClick={() => handlePublish(entry.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/15 border border-green-500/30 text-green-300 text-xs font-semibold hover:bg-green-500/25 transition-all">
                        <CheckCircle2 className="w-3 h-3" /> Publish
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* New Entry tab */}
        {activeTab === 'new' && (
          <div className="space-y-6">
            {/* Option 1: Draft from notes */}
            <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.03] p-5">
              <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                <PenLine className="w-4 h-4 text-emerald-400" />
                Draft from my notes
              </h3>
              <p className="text-xs text-white/40 leading-relaxed mb-4">
                Paste rough notes — a client lesson, an observation, a how-to. Claude will structure them into a draft entry, keeping your wording and writing the business angle from a finance/tax/ERP perspective.
              </p>
              <textarea
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                placeholder="Paste your notes here. Example: A client tried to automate AP invoice matching with an AI agent. The agent kept hallucinating vendor names because the ERP's vendor master had 40k records and the retrieval was too broad. We fixed it by scoping retrieval to the vendor's recent invoices first, then falling back to the full master. Lesson: context window isn't the issue — retrieval scope is."
                rows={8}
                className="w-full px-3 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-emerald-500/50 transition-all resize-y" />
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={handleProcessNotes}
                  disabled={notesProcessing || notesText.trim().length < 20}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-green-500 text-white text-sm font-semibold hover:from-emerald-400 hover:to-green-400 disabled:opacity-60 transition-all">
                  {notesProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PenLine className="w-3.5 h-3.5" />}
                  {notesProcessing ? 'Drafting…' : 'Draft from notes'}
                </button>
                <span className="text-[10px] text-white/25">Creates one draft with origin "original" and source "Clarent Technologies". No duplicate detection.</span>
              </div>
            </div>

            {/* Option 2: Blank entry */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
              <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-white/50" />
                Blank entry
              </h3>
              <p className="text-xs text-white/40 leading-relaxed mb-4">
                Start from scratch with an empty draft. You'll fill in all fields yourself in the editor.
              </p>
              <button
                onClick={handleCreateBlankEntry}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-white/[0.05] text-white text-sm font-semibold hover:bg-white/[0.08] transition-all">
                <Plus className="w-3.5 h-3.5" />
                Create blank entry
              </button>
            </div>

            {processMsg && (
              <div className={`flex items-center gap-1.5 text-xs ${
                processMsg.type === 'success' ? 'text-green-400'
                : processMsg.type === 'error' ? 'text-red-400' : 'text-white/50'
              }`}>
                {processMsg.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" />
                 : processMsg.type === 'error' ? <AlertCircle className="w-3.5 h-3.5" /> : null}
                {processMsg.text}
              </div>
            )}
          </div>
        )}

        {/* Model Tracker tab */}
        {activeTab === 'models' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-white/60 flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                Most Recent Entry Per Model
                <span className="text-[10px] text-white/30 font-normal">({modelEntries.length})</span>
              </h3>
              <button onClick={loadModelEntries} className="text-[10px] text-white/40 hover:text-white/70 transition-colors flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>
            {modelEntries.length === 0 ? (
              <div className="text-center py-12 rounded-xl border border-white/[0.05] bg-white/[0.01]">
                <Cpu className="w-8 h-8 text-white/15 mx-auto mb-3" />
                <p className="text-sm text-white/30">No model releases yet. Process a newsletter that covers model releases.</p>
              </div>
            ) : (
              <ModelTrackerGroups entries={modelEntries} />
            )}
          </>
        )}

        {/* Back link */}
        <div className="mt-10 pt-6 border-t border-white/[0.05]">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors group">
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            Back to site
          </Link>
        </div>
      </div>

      {/* Recheck modal */}
      {recheckProposals && recheckProposals.length > 0 && (
        <RecheckModal
          proposals={recheckProposals}
          onClose={() => setRecheckProposals(null)}
          onApply={handleApplyRecheck}
        />
      )}

      {/* Repair modal */}
      {repairProposals && repairProposals.length > 0 && (
        <RepairModal
          proposals={repairProposals}
          onClose={() => setRepairProposals(null)}
          onApply={handleApplyRepair}
        />
      )}
    </div>
  );
}
