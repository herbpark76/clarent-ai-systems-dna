import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Trash2, Send, RefreshCw,
  Newspaper, AlertCircle, CheckCircle2, ExternalLink,
  Layers, Tag, Briefcase, Building2, ChevronDown, Link2,
  GitMerge, XCircle, Copy, Cpu,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import NavBar from '../components/NavBar';

// ── Types ──────────────────────────────────────────────
type EntryType = 'news' | 'tutorial' | 'use_case' | 'tool' | 'model_release' | 'risk' | 'industry';
type SystemLayer = 'model' | 'agent' | 'tools_connectors' | 'data_context' | 'evals' | 'security_governance' | 'interface';
type DuplicateStatus = 'none' | 'possible' | 'merged' | 'separate' | 'discarded';

interface SourceObj {
  name: string | null;
  date: string | null;
  url: string | null;
}

interface SignalEntry {
  id: string;
  created_at: string;
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
  benchmark_score: string | null;
  price_input: string | null;
  price_output: string | null;
  source_name: string | null;
  source_date: string | null;
  source_url: string | null;
  sources: SourceObj[] | null;
  duplicate_of: string | null;
  duplicate_status: DuplicateStatus;
  status: 'draft' | 'published';
}

const TYPE_LABELS: Record<EntryType, string> = {
  news: 'News', tutorial: 'Tutorial', use_case: 'Use Case',
  tool: 'Tool', model_release: 'Model Release', risk: 'Risk', industry: 'Industry',
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
  industry: 'border-slate-400/30 bg-slate-400/10 text-slate-300',
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

// ── Sources display helper ─────────────────────────────
function getSources(entry: SignalEntry): SourceObj[] {
  if (entry.sources && entry.sources.length > 0) return entry.sources;
  if (entry.source_name || entry.source_url || entry.source_date) {
    return [{ name: entry.source_name, date: entry.source_date, url: entry.source_url }];
  }
  return [];
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

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(entry.id, {
      title: draft.title, summary: draft.summary,
      why_it_matters: draft.why_it_matters, how_its_built: draft.how_its_built,
      business_angle: draft.business_angle, type: draft.type, system_layer: draft.system_layer,
      tags: draft.tags, role_tags: draft.role_tags, model_name: draft.model_name,
      vendor: draft.vendor, benchmark_score: draft.benchmark_score,
      price_input: draft.price_input, price_output: draft.price_output, source_url: draft.source_url,
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
        <span className="text-[10px] text-white/25 ml-auto">
          {new Date(entry.created_at).toLocaleDateString()}
        </span>
        <button onClick={() => setExpanded(!expanded)} className="p-0.5 text-white/30 hover:text-white/70 transition-colors">
          <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Duplicate banner */}
      {isPossibleDup && (
        <div className="px-4 py-2.5 bg-amber-500/[0.06] border-b border-amber-500/10">
          <p className="text-xs text-amber-300/80 mb-2">
            Possible update to: <span className="font-semibold">{dupTarget?.title || 'existing entry'}</span>
          </p>
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
                  <option value="" className="bg-[#0f1523]">— None (industry) —</option>
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
            <input value={(draft.tags || []).join(', ')} onChange={(e) => setDraft({ ...draft, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} placeholder="Tags (comma separated)"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50" />
            <input value={(draft.role_tags || []).join(', ')} onChange={(e) => setDraft({ ...draft, role_tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} placeholder="Role tags (finance, legal, ops, marketing, IT)"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50" />
            {entry.type === 'model_release' && (
              <div className="grid grid-cols-2 gap-2">
                <input value={draft.model_name || ''} onChange={(e) => setDraft({ ...draft, model_name: e.target.value })} placeholder="Model name" className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-xs" />
                <input value={draft.vendor || ''} onChange={(e) => setDraft({ ...draft, vendor: e.target.value })} placeholder="Vendor" className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-xs" />
                <input value={draft.benchmark_score || ''} onChange={(e) => setDraft({ ...draft, benchmark_score: e.target.value })} placeholder="Benchmark score" className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-xs" />
                <input value={draft.price_input || ''} onChange={(e) => setDraft({ ...draft, price_input: e.target.value })} placeholder="Price (input)" className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-xs" />
                <input value={draft.price_output || ''} onChange={(e) => setDraft({ ...draft, price_output: e.target.value })} placeholder="Price (output)" className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-xs" />
              </div>
            )}
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
            <p className="text-xs text-white/50 leading-relaxed line-clamp-2">{entry.summary}</p>

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
                {entry.steps && entry.steps.length > 0 && (
                  <div>
                    <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wide">Steps</span>
                    <ol className="mt-1 space-y-1">
                      {entry.steps.map((s, i) => (
                        <li key={i} className="text-xs text-white/55 leading-relaxed">
                          <span className="text-white/30 mr-1">{i + 1}.</span> {s.text}
                          {s.prompt && <code className="block mt-0.5 ml-4 px-2 py-1 rounded bg-white/[0.05] text-[10px] text-cyan-300/80">{s.prompt}</code>}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {entry.model_name && (
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300">{entry.model_name}</span>
                    {entry.vendor && <span className="px-2 py-0.5 rounded bg-white/[0.05] text-white/50">{entry.vendor}</span>}
                    {entry.benchmark_score && <span className="px-2 py-0.5 rounded bg-white/[0.05] text-white/50">Score: {entry.benchmark_score}</span>}
                    {entry.price_input && <span className="px-2 py-0.5 rounded bg-white/[0.05] text-white/50">In: {entry.price_input}</span>}
                    {entry.price_output && <span className="px-2 py-0.5 rounded bg-white/[0.05] text-white/50">Out: {entry.price_output}</span>}
                  </div>
                )}
                {entry.tags && entry.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {entry.tags.map((t) => (
                      <span key={t} className="px-1.5 py-0.5 rounded bg-white/[0.06] text-[10px] text-white/45 flex items-center gap-0.5">
                        <Tag className="w-2 h-2" /> {t}
                      </span>
                    ))}
                  </div>
                )}
                {entry.role_tags && entry.role_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {entry.role_tags.map((t) => (
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
          {new Date(entry.created_at).toLocaleDateString()}
        </span>
      </div>
      <div className="px-4 py-3">
        <p className="text-xs text-white/50 leading-relaxed mb-2">{entry.summary}</p>
        <div className="flex flex-wrap gap-2 text-[10px]">
          {entry.benchmark_score && <span className="px-2 py-0.5 rounded bg-white/[0.05] text-white/50">Score: {entry.benchmark_score}</span>}
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

// ── Main Page ──────────────────────────────────────────
export default function AdminSignalDesk() {
  const [authed, setAuthed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [entries, setEntries] = useState<SignalEntry[]>([]);
  const [modelEntries, setModelEntries] = useState<SignalEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [activeTab, setActiveTab] = useState<'review' | 'models'>('review');
  const [processUrl, setProcessUrl] = useState('');
  const [processText, setProcessText] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [sourceDate, setSourceDate] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processMsg, setProcessMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
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
        const total = result.count ?? result.entries?.length ?? 0;
        if (total === 0) {
          setProcessMsg({ type: 'info', text: 'No valid entries found in the text.' });
        } else {
          const parts: string[] = [`${newCount} new`];
          if (dupCount > 0) parts.push(`${dupCount} possible duplicate${dupCount > 1 ? 's' : ''}`);
          setProcessMsg({ type: 'success', text: `${parts.join(', ')} entries saved as drafts.` });
        }
        setProcessText('');
        setProcessUrl('');
        loadEntries();
        loadModelEntries();
      }
    } catch {
      setProcessMsg({ type: 'error', text: 'Network error. Please try again.' });
    }
    setProcessing(false);
  };

  const handleUpdate = async (id: string, patch: Partial<SignalEntry>) => {
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
    if (dup.benchmark_score && !target.benchmark_score) patch.benchmark_score = dup.benchmark_score;
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

  // Separate drafts and possible duplicates
  const normalDrafts = entries.filter((e) => e.duplicate_status !== 'possible');
  const possibleDups = entries.filter((e) => e.duplicate_status === 'possible');

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
          <button onClick={handleSignOut} className="text-xs text-white/40 hover:text-white/70 transition-colors">
            Sign out
          </button>
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
                      <EntryCard entry={entry} onUpdate={handleUpdate} onDelete={handleDelete}
                        onMerge={handleMerge} onKeepSeparate={handleKeepSeparate} onDiscard={handleDiscard}
                        allEntries={entries} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Normal drafts */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-white/60 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 text-white/40" />
                Drafts
                <span className="text-[10px] text-white/30 font-normal">({normalDrafts.length})</span>
              </h3>
              <button onClick={loadEntries} className="text-[10px] text-white/40 hover:text-white/70 transition-colors flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
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
            ) : normalDrafts.length === 0 ? (
              <p className="text-xs text-white/30 text-center py-6">No non-duplicate drafts. All items flagged as possible duplicates above.</p>
            ) : (
              <div className="space-y-3">
                {normalDrafts.map((entry) => (
                  <div key={entry.id}>
                    <EntryCard entry={entry} onUpdate={handleUpdate} onDelete={handleDelete}
                      onMerge={handleMerge} onKeepSeparate={handleKeepSeparate} onDiscard={handleDiscard}
                      allEntries={entries} />
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
              <div className="space-y-3">
                {modelEntries.map((entry) => (
                  <ModelTrackerCard key={entry.id} entry={entry} />
                ))}
              </div>
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
    </div>
  );
}
