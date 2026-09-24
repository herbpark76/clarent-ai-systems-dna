import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Trash2, Send, RefreshCw,
  Newspaper, AlertCircle, CheckCircle2, ExternalLink,
  Layers, Tag, Briefcase, Building2, ChevronDown,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import NavBar from '../components/NavBar';

// ── Types ──────────────────────────────────────────────
type EntryType = 'news' | 'tutorial' | 'use_case' | 'tool' | 'model_release' | 'risk';
type SystemLayer = 'model' | 'agent' | 'tools_connectors' | 'data_context' | 'evals' | 'security_governance' | 'interface';

interface SignalEntry {
  id: string;
  created_at: string;
  type: EntryType;
  system_layer: SystemLayer;
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
  status: 'draft' | 'published';
}

const TYPE_LABELS: Record<EntryType, string> = {
  news: 'News',
  tutorial: 'Tutorial',
  use_case: 'Use Case',
  tool: 'Tool',
  model_release: 'Model Release',
  risk: 'Risk',
};

const LAYER_LABELS: Record<SystemLayer, string> = {
  model: 'Model',
  agent: 'Agent',
  tools_connectors: 'Tools & Connectors',
  data_context: 'Data & Context',
  evals: 'Evals',
  security_governance: 'Security & Governance',
  interface: 'Interface',
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
  model: 'text-blue-400',
  agent: 'text-amber-400',
  tools_connectors: 'text-orange-400',
  data_context: 'text-emerald-400',
  evals: 'text-sky-400',
  security_governance: 'text-rose-400',
  interface: 'text-teal-400',
};

// ── Auth Gate Component ────────────────────────────────
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
            <Newspaper className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white mb-1">Signal Desk</h1>
          <p className="text-sm text-white/40">Sign in to manage AI signal entries</p>
        </div>
        <form onSubmit={handleSignIn} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-4 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-blue-500/50 transition-all"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-blue-500/50 transition-all"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold text-sm hover:from-blue-400 hover:to-cyan-400 disabled:opacity-60 transition-all"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Entry Card Component ───────────────────────────────
function EntryCard({
  entry,
  onUpdate,
  onDelete,
}: {
  entry: SignalEntry;
  onUpdate: (id: string, patch: Partial<SignalEntry>) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SignalEntry>(entry);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(entry), [entry]);

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(entry.id, {
      title: draft.title,
      summary: draft.summary,
      why_it_matters: draft.why_it_matters,
      how_its_built: draft.how_its_built,
      business_angle: draft.business_angle,
      type: draft.type,
      system_layer: draft.system_layer,
      tags: draft.tags,
      role_tags: draft.role_tags,
      model_name: draft.model_name,
      vendor: draft.vendor,
      benchmark_score: draft.benchmark_score,
      price_input: draft.price_input,
      price_output: draft.price_output,
      source_url: draft.source_url,
    });
    setEditing(false);
    setSaving(false);
  };

  const tagsStr = (draft.tags || []).join(', ');
  const roleTagsStr = (draft.role_tags || []).join(', ');

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden transition-all hover:border-white/[0.12]">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.05]">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${TYPE_COLORS[entry.type]}`}>
          {TYPE_LABELS[entry.type]}
        </span>
        <span className={`text-[10px] font-medium flex items-center gap-1 ${LAYER_COLORS[entry.system_layer]}`}>
          <Layers className="w-2.5 h-2.5" />
          {LAYER_LABELS[entry.system_layer]}
        </span>
        <span className="text-[10px] text-white/25 ml-auto">
          {new Date(entry.created_at).toLocaleDateString()}
        </span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-0.5 text-white/30 hover:text-white/70 transition-colors"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {editing ? (
          <div className="space-y-3">
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm font-semibold focus:outline-none focus:border-blue-500/50"
            />
            <textarea
              value={draft.summary}
              onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50 resize-y"
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[10px] text-white/40 mb-1 block">Type</span>
                <select
                  value={draft.type}
                  onChange={(e) => setDraft({ ...draft, type: e.target.value as EntryType })}
                  className="w-full px-2.5 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500/50"
                >
                  {Object.entries(TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v} className="bg-[#0f1523]">{l}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] text-white/40 mb-1 block">System Layer</span>
                <select
                  value={draft.system_layer}
                  onChange={(e) => setDraft({ ...draft, system_layer: e.target.value as SystemLayer })}
                  className="w-full px-2.5 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500/50"
                >
                  {Object.entries(LAYER_LABELS).map(([v, l]) => (
                    <option key={v} value={v} className="bg-[#0f1523]">{l}</option>
                  ))}
                </select>
              </label>
            </div>
            <textarea
              value={draft.why_it_matters || ''}
              onChange={(e) => setDraft({ ...draft, why_it_matters: e.target.value })}
              placeholder="Why it matters"
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50 resize-y"
            />
            <textarea
              value={draft.how_its_built || ''}
              onChange={(e) => setDraft({ ...draft, how_its_built: e.target.value })}
              placeholder="How it's built"
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50 resize-y"
            />
            <textarea
              value={draft.business_angle || ''}
              onChange={(e) => setDraft({ ...draft, business_angle: e.target.value })}
              placeholder="Business angle (finance/tax/ERP)"
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50 resize-y"
            />
            <input
              value={tagsStr}
              onChange={(e) => setDraft({ ...draft, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
              placeholder="Tags (comma separated)"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50"
            />
            <input
              value={roleTagsStr}
              onChange={(e) => setDraft({ ...draft, role_tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
              placeholder="Role tags (finance, legal, ops, marketing, IT)"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50"
            />
            {entry.type === 'model_release' && (
              <div className="grid grid-cols-2 gap-2">
                <input value={draft.model_name || ''} onChange={(e) => setDraft({ ...draft, model_name: e.target.value })} placeholder="Model name" className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-xs" />
                <input value={draft.vendor || ''} onChange={(e) => setDraft({ ...draft, vendor: e.target.value })} placeholder="Vendor" className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-xs" />
                <input value={draft.benchmark_score || ''} onChange={(e) => setDraft({ ...draft, benchmark_score: e.target.value })} placeholder="Benchmark score" className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-xs" />
                <input value={draft.price_input || ''} onChange={(e) => setDraft({ ...draft, price_input: e.target.value })} placeholder="Price (input)" className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-xs" />
                <input value={draft.price_output || ''} onChange={(e) => setDraft({ ...draft, price_output: e.target.value })} placeholder="Price (output)" className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-xs" />
              </div>
            )}
            <input
              value={draft.source_url || ''}
              onChange={(e) => setDraft({ ...draft, source_url: e.target.value })}
              placeholder="Source URL"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50"
            />
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
                {entry.source_url && (
                  <a href={entry.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-cyan-400/70 hover:text-cyan-300 transition-colors">
                    Source <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            )}

            {/* Action bar */}
            <div className="mt-3 pt-2.5 border-t border-white/[0.05] flex items-center gap-2">
              <select
                value={entry.type}
                onChange={(e) => onUpdate(entry.id, { type: e.target.value as EntryType })}
                className="px-2 py-1 rounded-md bg-white/[0.05] border border-white/10 text-white text-[10px] focus:outline-none focus:border-blue-500/50"
              >
                {Object.entries(TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v} className="bg-[#0f1523]">{l}</option>
                ))}
              </select>
              <select
                value={entry.system_layer}
                onChange={(e) => onUpdate(entry.id, { system_layer: e.target.value as SystemLayer })}
                className="px-2 py-1 rounded-md bg-white/[0.05] border border-white/10 text-white text-[10px] focus:outline-none focus:border-blue-500/50"
              >
                {Object.entries(LAYER_LABELS).map(([v, l]) => (
                  <option key={v} value={v} className="bg-[#0f1523]">{l}</option>
                ))}
              </select>
              <button onClick={() => setEditing(true)} className="ml-auto px-2.5 py-1 rounded-md border border-white/10 text-white/50 text-[10px] hover:text-white/80 hover:bg-white/[0.05] transition-all">
                Edit
              </button>
              <button
                onClick={() => onDelete(entry.id)}
                className="p-1.5 rounded-md border border-red-500/20 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all"
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </>
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
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [processText, setProcessText] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [sourceDate, setSourceDate] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processMsg, setProcessMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // ── Auth check ───────────────────────────────────────
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

  // ── Load draft entries ───────────────────────────────
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

  useEffect(() => {
    if (authed) loadEntries();
  }, [authed, loadEntries]);

  // ── Process newsletter ───────────────────────────────
  const handleProcess = async () => {
    if (!processText.trim() || processText.trim().length < 50) {
      setProcessMsg({ type: 'error', text: 'Paste at least 50 characters of newsletter text.' });
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
          text: processText,
          source_name: sourceName || null,
          source_date: sourceDate || null,
        }),
      });
      const result = await resp.json();
      if (!resp.ok) {
        setProcessMsg({ type: 'error', text: result.error || `Request failed (${resp.status})` });
      } else {
        const count = result.count ?? result.entries?.length ?? 0;
        setProcessMsg({
          type: count > 0 ? 'success' : 'info',
          text: count > 0 ? `${count} entries extracted and saved as drafts.` : 'No valid entries found in the text.',
        });
        setProcessText('');
        loadEntries();
      }
    } catch {
      setProcessMsg({ type: 'error', text: 'Network error. Please try again.' });
    }
    setProcessing(false);
  };

  // ── Update entry ─────────────────────────────────────
  const handleUpdate = async (id: string, patch: Partial<SignalEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    const { error } = await supabase.from('signal_desk_entries').update(patch).eq('id', id);
    if (error) {
      setProcessMsg({ type: 'error', text: `Update failed: ${error.message}` });
      loadEntries();
    }
  };

  // ── Publish entry ────────────────────────────────────
  const handlePublish = async (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    const { error } = await supabase.from('signal_desk_entries').update({ status: 'published' }).eq('id', id);
    if (error) {
      setProcessMsg({ type: 'error', text: `Publish failed: ${error.message}` });
      loadEntries();
    }
  };

  // ── Delete entry ─────────────────────────────────────
  const handleDelete = async (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    const { error } = await supabase.from('signal_desk_entries').delete().eq('id', id);
    if (error) {
      setProcessMsg({ type: 'error', text: `Delete failed: ${error.message}` });
      loadEntries();
    }
  };

  // ── Sign out ─────────────────────────────────────────
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
            <input
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="Source name (e.g. TLDR AI, The Batch)"
              className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-all"
            />
            <input
              type="date"
              value={sourceDate}
              onChange={(e) => setSourceDate(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-all"
            />
          </div>
          <textarea
            value={processText}
            onChange={(e) => setProcessText(e.target.value)}
            placeholder="Paste newsletter text here…"
            rows={8}
            className="w-full px-3 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-all resize-y font-mono"
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={handleProcess}
              disabled={processing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-semibold hover:from-blue-400 hover:to-cyan-400 disabled:opacity-60 transition-all"
            >
              {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {processing ? 'Processing…' : 'Process'}
            </button>
            {processMsg && (
              <div className={`flex items-center gap-1.5 text-xs ${
                processMsg.type === 'success' ? 'text-green-400'
                : processMsg.type === 'error' ? 'text-red-400'
                : 'text-white/50'
              }`}>
                {processMsg.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" />
                 : processMsg.type === 'error' ? <AlertCircle className="w-3.5 h-3.5" />
                 : null}
                {processMsg.text}
              </div>
            )}
          </div>
        </div>

        {/* Review queue */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 text-white/40" />
            Review Queue
            <span className="text-[10px] text-white/30 font-normal">({entries.length} drafts)</span>
          </h2>
          <button onClick={loadEntries} className="text-[10px] text-white/40 hover:text-white/70 transition-colors flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>

        {loadingEntries ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-white/[0.05] bg-white/[0.01]">
            <Newspaper className="w-8 h-8 text-white/15 mx-auto mb-3" />
            <p className="text-sm text-white/30">No drafts to review. Process a newsletter to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div key={entry.id}>
                <EntryCard entry={entry} onUpdate={handleUpdate} onDelete={handleDelete} />
                <div className="flex items-center gap-2 mt-1.5 px-1">
                  <button
                    onClick={() => handlePublish(entry.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/15 border border-green-500/30 text-green-300 text-xs font-semibold hover:bg-green-500/25 transition-all"
                  >
                    <CheckCircle2 className="w-3 h-3" /> Publish
                  </button>
                  <Link to="/" className="text-[10px] text-white/20 ml-auto">Back to site</Link>
                </div>
              </div>
            ))}
          </div>
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
