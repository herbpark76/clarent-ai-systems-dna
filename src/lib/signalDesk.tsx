import { Component } from 'react';
import type { ReactNode } from 'react';
import { supabase } from './supabase';
import NavBar from '../components/NavBar';

// ── Types ──────────────────────────────────────────────
export type EntryType = 'news' | 'tutorial' | 'use_case' | 'tool' | 'model_release' | 'risk' | 'industry';
export type SystemLayer = 'model' | 'agent' | 'tools_connectors' | 'data_context' | 'evals' | 'security_governance' | 'interface';
export type DuplicateStatus = 'none' | 'possible' | 'merged' | 'separate' | 'discarded';

export interface SourceObj {
  name: string | null;
  date: string | null;
  url: string | null;
}

export type EntryOrigin = 'newsletter' | 'original';

export interface SignalEntry {
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
}

export const TYPE_LABELS: Record<EntryType, string> = {
  news: 'News', tutorial: 'Tutorial', use_case: 'Use Case',
  tool: 'Tool', model_release: 'Model Release', risk: 'Risk', industry: 'Industry',
};

export const LAYER_LABELS: Record<SystemLayer, string> = {
  model: 'Model', agent: 'Agent', tools_connectors: 'Tools & Connectors',
  data_context: 'Data & Context', evals: 'Evals',
  security_governance: 'Security & Governance', interface: 'Interface',
};

export const TYPE_COLORS: Record<EntryType, string> = {
  news: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  tutorial: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  use_case: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
  tool: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  model_release: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  risk: 'border-red-500/30 bg-red-500/10 text-red-300',
  industry: 'border-slate-400/30 bg-slate-400/10 text-slate-300',
};

export const LAYER_COLORS: Record<SystemLayer, string> = {
  model: 'text-blue-400', agent: 'text-amber-400',
  tools_connectors: 'text-orange-400', data_context: 'text-emerald-400',
  evals: 'text-sky-400', security_governance: 'text-rose-400', interface: 'text-teal-400',
};

export const LAYER_ICONS: Record<SystemLayer, string> = {
  model: '🧠', agent: '🤖', tools_connectors: '🔧',
  data_context: '📊', evals: '✅', security_governance: '🔒', interface: '🖥️',
};

// ── Normalizers (defend against stringified JSON) ──────
export function normalizeSteps(raw: any): Array<{ text: string; prompt?: string }> {
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

export function normalizeStringArray(raw: any): string[] {
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

export function normalizeSources(raw: any): SourceObj[] {
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

export function getSources(entry: SignalEntry): SourceObj[] {
  const fromSources = normalizeSources(entry.sources);
  if (fromSources.length > 0) return fromSources;
  if (entry.source_name || entry.source_url || entry.source_date) {
    return [{ name: entry.source_name, date: entry.source_date, url: entry.source_url }];
  }
  return [];
}

export function getSourceDate(entry: SignalEntry): string | null {
  const sources = getSources(entry);
  if (sources.length > 0 && sources[0].date) return sources[0].date;
  return entry.source_date || null;
}

// ── Fetch helpers ──────────────────────────────────────
const VISIBLE_STATUSES: DuplicateStatus[] = ['none', 'separate'];

export async function fetchPublishedEntries(): Promise<SignalEntry[]> {
  const { data, error } = await supabase
    .from('signal_desk_entries')
    .select('*')
    .eq('status', 'published')
    .in('duplicate_status', VISIBLE_STATUSES)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as SignalEntry[];
}

export async function fetchPublishedByType(type: EntryType): Promise<SignalEntry[]> {
  const { data, error } = await supabase
    .from('signal_desk_entries')
    .select('*')
    .eq('status', 'published')
    .eq('type', type)
    .in('duplicate_status', VISIBLE_STATUSES)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as SignalEntry[];
}

export async function fetchLatestPublished(limit: number = 6): Promise<SignalEntry[]> {
  const { data, error } = await supabase
    .from('signal_desk_entries')
    .select('*')
    .eq('status', 'published')
    .in('duplicate_status', VISIBLE_STATUSES)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as SignalEntry[];
}

export async function fetchPublishedBySlug(slug: string): Promise<SignalEntry | null> {
  const { data, error } = await supabase
    .from('signal_desk_entries')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .in('duplicate_status', VISIBLE_STATUSES)
    .maybeSingle();
  if (error) throw error;
  return data as SignalEntry | null;
}

export function dedupeByModelName(entries: SignalEntry[]): SignalEntry[] {
  const seen = new Set<string>();
  const deduped: SignalEntry[] = [];
  for (const e of entries) {
    if (e.model_name && !seen.has(e.model_name)) {
      seen.add(e.model_name);
      deduped.push(e);
    }
  }
  return deduped;
}

// ── Error Boundary ─────────────────────────────────────
export class PageErrorBoundary extends Component<
  { children: ReactNode; pageName: string },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: Error) { console.error('[PageErrorBoundary]', this.props.pageName, err); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#080c14] text-white font-sans antialiased">
          <NavBar />
          <div className="pt-20 max-w-lg mx-auto px-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-red-400 text-xl">!</span>
            </div>
            <h1 className="text-lg font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-sm text-white/40 mb-6">We couldn't load {this.props.pageName}. Please try again.</p>
            <a href="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm hover:bg-white/[0.08] transition-all">
              Back to home
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Shared UI helpers ──────────────────────────────────
export function TypeBadge({ type }: { type: EntryType }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${TYPE_COLORS[type]}`}>
      {TYPE_LABELS[type]}
    </span>
  );
}

export function LayerBadge({ layer }: { layer: SystemLayer | null }) {
  if (!layer) return null;
  return (
    <span className={`text-[10px] font-medium flex items-center gap-1 ${LAYER_COLORS[layer]}`}>
      {LAYER_LABELS[layer]}
    </span>
  );
}

export function SourcesList({ entry }: { entry: SignalEntry }) {
  const sources = getSources(entry);
  if (sources.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-white/40">
      {sources.map((s, i) => (
        <span key={i} className="flex items-center gap-0.5">
          {s.url ? (
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-cyan-400/70 hover:text-cyan-300 transition-colors">
              {s.name || 'Source'}
            </a>
          ) : (
            <span>{s.name || 'Source'}</span>
          )}
          {s.date && <span className="text-white/25">· {s.date}</span>}
          {i < sources.length - 1 && <span className="text-white/15">·</span>}
        </span>
      ))}
    </div>
  );
}

export function FromTheFieldBadge({ origin, size = 'sm' }: { origin: EntryOrigin; size?: 'sm' | 'xs' }) {
  if (origin !== 'original') return null;
  const sizeClasses = size === 'xs' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]';
  return (
    <span className={`${sizeClasses} rounded-full font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 flex items-center gap-1 whitespace-nowrap`}>
      <span className="inline-block w-1 h-1 rounded-full bg-emerald-400" />
      From the field
    </span>
  );
}
