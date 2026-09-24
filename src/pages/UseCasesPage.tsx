import { useState, useEffect, useMemo } from 'react';
import { Lightbulb, Search, Loader2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import NavBar from '../components/NavBar';
import {
  fetchPublishedByType, normalizeSteps, normalizeStringArray, getSourceDate,
  TypeBadge, LayerBadge, SourcesList, LAYER_LABELS,
  type SignalEntry, type SystemLayer, PageErrorBoundary,
} from '../lib/signalDesk';

const ALL_LAYERS: (SystemLayer | 'all')[] = ['all', 'model', 'agent', 'tools_connectors', 'data_context', 'evals', 'security_governance', 'interface'];

function UseCaseCard({ entry }: { entry: SignalEntry }) {
  const steps = normalizeSteps(entry.steps);
  const tags = normalizeStringArray(entry.tags);
  const roleTags = normalizeStringArray(entry.role_tags);
  const date = getSourceDate(entry);

  return (
    <Link to={`/signal-desk/${entry.slug}`} className="group block rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 hover:border-white/[0.15] transition-all">
      <div className="flex items-center gap-2 mb-2">
        <TypeBadge type={entry.type} />
        <LayerBadge layer={entry.system_layer} />
        {date && <span className="text-[10px] text-white/25 ml-auto">{date}</span>}
      </div>
      <h3 className="text-sm font-bold text-white mb-2 leading-snug group-hover:text-cyan-300 transition-colors">{entry.title}</h3>

      <div className="space-y-2 mb-3">
        {entry.summary && (
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-bold text-blue-400 flex-shrink-0 mt-0.5 w-16">Problem</span>
            <p className="text-xs text-white/55 leading-relaxed flex-1">{entry.summary}</p>
          </div>
        )}
        {entry.how_its_built && (
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-bold text-orange-400 flex-shrink-0 mt-0.5 w-16">Tool</span>
            <p className="text-xs text-white/55 leading-relaxed flex-1">{entry.how_its_built}</p>
          </div>
        )}
        {steps.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-bold text-emerald-400 flex-shrink-0 mt-0.5 w-16">Steps</span>
            <ol className="text-xs text-white/55 leading-relaxed flex-1 space-y-0.5">
              {steps.map((s, i) => (
                <li key={i}><span className="text-white/30">{i + 1}.</span> {s.text}</li>
              ))}
            </ol>
          </div>
        )}
        {entry.why_it_matters && (
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-bold text-cyan-400 flex-shrink-0 mt-0.5 w-16">Result</span>
            <p className="text-xs text-white/55 leading-relaxed flex-1">{entry.why_it_matters}</p>
          </div>
        )}
      </div>

      {(roleTags.length > 0 || tags.length > 0) && (
        <div className="flex flex-wrap gap-1 mb-2">
          {roleTags.map((t) => (
            <span key={`r-${t}`} className="px-1.5 py-0.5 rounded bg-amber-500/10 text-[10px] text-amber-300/80">{t}</span>
          ))}
          {tags.map((t) => (
            <span key={`t-${t}`} className="px-1.5 py-0.5 rounded bg-white/[0.06] text-[10px] text-white/45">{t}</span>
          ))}
        </div>
      )}

      <SourcesList entry={entry} />
    </Link>
  );
}

function UseCasesInner() {
  const [entries, setEntries] = useState<SignalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [layerFilter, setLayerFilter] = useState<SystemLayer | 'all'>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    document.title = 'Use-Case Library — AI Systems DNA';
  }, []);

  useEffect(() => {
    fetchPublishedByType('use_case')
      .then((data) => { setEntries(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const allRoleTags = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => normalizeStringArray(e.role_tags).forEach((t) => set.add(t)));
    return [...set].sort();
  }, [entries]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => normalizeStringArray(e.tags).forEach((t) => set.add(t)));
    return [...set].sort();
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (layerFilter !== 'all' && e.system_layer !== layerFilter) return false;
      if (roleFilter !== 'all' && !normalizeStringArray(e.role_tags).includes(roleFilter)) return false;
      if (tagFilter !== 'all' && !normalizeStringArray(e.tags).includes(tagFilter)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!e.title.toLowerCase().includes(q) && !e.summary.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [entries, layerFilter, roleFilter, tagFilter, search]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080c14] text-white">
        <NavBar />
        <div className="pt-20 flex items-center justify-center"><Loader2 className="w-5 h-5 text-white/30 animate-spin" /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080c14] text-white font-sans antialiased">
      <NavBar />
      <div className="pt-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-fuchsia-400 flex items-center justify-center">
            <Lightbulb className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Use-Case Library</h1>
            <p className="text-[11px] text-white/35">Real-world AI applications, broken down by problem, tool, steps, and result</p>
          </div>
        </div>

        {error ? (
          <p className="text-sm text-white/40 text-center py-12">Failed to load use cases. Please try again later.</p>
        ) : (
          <>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search use cases..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-all"
                />
              </div>
              <select value={layerFilter} onChange={(e) => setLayerFilter(e.target.value as SystemLayer | 'all')}
                className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500/50">
                {ALL_LAYERS.map((l) => (
                  <option key={l} value={l} className="bg-[#0f1523]">{l === 'all' ? 'All layers' : LAYER_LABELS[l]}</option>
                ))}
              </select>
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500/50">
                <option value="all" className="bg-[#0f1523]">All roles</option>
                {allRoleTags.map((t) => <option key={t} value={t} className="bg-[#0f1523]">{t}</option>)}
              </select>
              <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500/50">
                <option value="all" className="bg-[#0f1523]">All tags</option>
                {allTags.map((t) => <option key={t} value={t} className="bg-[#0f1523]">{t}</option>)}
              </select>
            </div>

            {(layerFilter !== 'all' || roleFilter !== 'all' || tagFilter !== 'all' || search.trim()) && (
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs text-white/40">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
                <button onClick={() => { setLayerFilter('all'); setRoleFilter('all'); setTagFilter('all'); setSearch(''); }}
                  className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors">
                  <X className="w-3 h-3" /> Clear filters
                </button>
              </div>
            )}

            {filtered.length === 0 ? (
              <div className="text-center py-12 rounded-xl border border-white/[0.05] bg-white/[0.01]">
                <Lightbulb className="w-8 h-8 text-white/15 mx-auto mb-3" />
                <p className="text-sm text-white/30">No use cases match your filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((entry) => <UseCaseCard key={entry.id} entry={entry} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function UseCasesPage() {
  return (
    <PageErrorBoundary pageName="Use-Case Library">
      <UseCasesInner />
    </PageErrorBoundary>
  );
}
