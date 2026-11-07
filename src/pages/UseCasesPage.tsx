import { useState, useEffect, useMemo } from 'react';
import { Lightbulb, Search, Loader2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import NavBar from '../components/NavBar';
import {
  fetchPublishedByType, normalizeSteps, normalizeStringArray, getSourceDate,
  TypeBadge, LayerBadge, SourcesList, FromTheFieldBadge, LAYER_LABELS,
  type SignalEntry, type SystemLayer, PageErrorBoundary,
} from '../lib/signalDesk';
import { setPageMeta } from '../lib/seo';

const ALL_LAYERS: (SystemLayer | 'all')[] = ['all', 'model', 'agent', 'tools_connectors', 'data_context', 'evals', 'security_governance', 'interface'];

const ROLE_CANONICAL: Record<string, string> = {
  it: 'IT',
  finance: 'Finance',
  legal: 'Legal',
  marketing: 'Marketing',
  ops: 'Ops',
  operations: 'Ops',
  tax: 'Tax',
};

function canonicalizeRole(raw: string): string {
  const key = raw.toLowerCase().trim();
  if (ROLE_CANONICAL[key]) return ROLE_CANONICAL[key];
  if (!key) return '';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function canonicalizeTag(raw: string): string {
  let key = raw.toLowerCase().trim();
  if (!key) return '';
  if (key.length > 3 && key.endsWith('s') && !key.endsWith('ss')) {
    key = key.slice(0, -1);
  }
  return key;
}

function UseCaseCard({ entry }: { entry: SignalEntry }) {
  const steps = normalizeSteps(entry.steps);
  const tags = normalizeStringArray(entry.tags).map(canonicalizeTag).filter(Boolean);
  const roleTags = normalizeStringArray(entry.role_tags).map(canonicalizeRole).filter(Boolean);
  const date = getSourceDate(entry);

  return (
    <Link to={`/signal-desk/${entry.slug}`} className="group block rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 hover:border-white/[0.15] transition-all">
      <div className="flex items-center gap-2 mb-2">
        <TypeBadge type={entry.type} />
        <FromTheFieldBadge origin={entry.origin} />
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
        {entry.result && (
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-bold text-cyan-400 flex-shrink-0 mt-0.5 w-16">Result</span>
            <p className="text-xs text-white/55 leading-relaxed flex-1">{entry.result}</p>
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

interface TagInfo {
  canonical: string;
  count: number;
}

function buildNormalizedTagMap(entries: SignalEntry[], field: 'tags' | 'role_tags'): TagInfo[] {
  const canonFn = field === 'role_tags' ? canonicalizeRole : canonicalizeTag;
  const counts = new Map<string, { canonical: string; count: number }>();
  for (const e of entries) {
    const raw = normalizeStringArray(e[field]);
    for (const t of raw) {
      const canonical = canonFn(t);
      if (!canonical) continue;
      const existing = counts.get(canonical);
      if (existing) {
        existing.count++;
      } else {
        counts.set(canonical, { canonical, count: 1 });
      }
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.canonical.localeCompare(b.canonical));
}

function entryMatchesNormalizedTag(entry: SignalEntry, field: 'tags' | 'role_tags', canonicalTag: string): boolean {
  const canonFn = field === 'role_tags' ? canonicalizeRole : canonicalizeTag;
  const raw = normalizeStringArray(entry[field]);
  return raw.some((t) => canonFn(t) === canonicalTag);
}

function UseCasesInner() {
  const [entries, setEntries] = useState<SignalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [layerFilter, setLayerFilter] = useState<SystemLayer | 'all'>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showAllTags, setShowAllTags] = useState(false);
  const [showAllRoles, setShowAllRoles] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [roleSearch, setRoleSearch] = useState('');

  useEffect(() => {
    setPageMeta({ title: 'Use-Case Library — AI Systems DNA', path: '/use-cases' });
  }, []);

  useEffect(() => {
    fetchPublishedByType('use_case')
      .then((data) => { setEntries(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const allRoleTags = useMemo(() => buildNormalizedTagMap(entries, 'role_tags'), [entries]);
  const allTags = useMemo(() => buildNormalizedTagMap(entries, 'tags'), [entries]);

  const TOP_N = 20;

  const visibleTags = useMemo(() => {
    let list = allTags;
    if (tagSearch.trim()) {
      const q = tagSearch.toLowerCase();
      list = list.filter((t) => t.canonical.includes(q));
    }
    if (!showAllTags && !tagSearch.trim()) {
      return list.slice(0, TOP_N);
    }
    return list;
  }, [allTags, showAllTags, tagSearch]);

  const visibleRoles = useMemo(() => {
    let list = allRoleTags;
    if (roleSearch.trim()) {
      const q = roleSearch.toLowerCase();
      list = list.filter((t) => t.canonical.includes(q));
    }
    if (!showAllRoles && !roleSearch.trim()) {
      return list.slice(0, TOP_N);
    }
    return list;
  }, [allRoleTags, showAllRoles, roleSearch]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (layerFilter !== 'all' && e.system_layer !== layerFilter) return false;
      if (roleFilter !== 'all' && !entryMatchesNormalizedTag(e, 'role_tags', roleFilter)) return false;
      if (tagFilter !== 'all' && !entryMatchesNormalizedTag(e, 'tags', tagFilter)) return false;
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
            </div>

            {/* Tag and role filter panels */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {/* Tags panel */}
              <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-wide">Tags</span>
                  {tagFilter !== 'all' && (
                    <button onClick={() => setTagFilter('all')} className="text-[10px] text-cyan-400/70 hover:text-cyan-300 transition-colors">Clear</button>
                  )}
                </div>
                <input
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  placeholder="Filter tags..."
                  className="w-full mb-2 px-2 py-1 rounded bg-white/[0.05] border border-white/10 text-white text-[11px] placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-all"
                />
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                  {visibleTags.length === 0 && <span className="text-[10px] text-white/25">No tags found.</span>}
                  {visibleTags.map((t) => (
                    <button
                      key={t.canonical}
                      onClick={() => setTagFilter(tagFilter === t.canonical ? 'all' : t.canonical)}
                      className={`px-1.5 py-0.5 rounded text-[10px] transition-all ${
                        tagFilter === t.canonical
                          ? 'bg-blue-500/30 text-blue-200 border border-blue-500/40'
                          : 'bg-white/[0.06] text-white/45 hover:bg-white/[0.12] hover:text-white/70 border border-transparent'
                      }`}
                    >
                      {t.canonical} <span className="text-white/25">{t.count}</span>
                    </button>
                  ))}
                </div>
                {allTags.length > TOP_N && !tagSearch.trim() && (
                  <button
                    onClick={() => setShowAllTags(!showAllTags)}
                    className="mt-2 inline-flex items-center gap-1 text-[10px] text-white/35 hover:text-white/60 transition-colors"
                  >
                    {showAllTags ? <><ChevronUp className="w-3 h-3" /> Show fewer</> : <><ChevronDown className="w-3 h-3" /> Show all {allTags.length} tags</>}
                  </button>
                )}
              </div>

              {/* Roles panel */}
              <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-wide">Roles</span>
                  {roleFilter !== 'all' && (
                    <button onClick={() => setRoleFilter('all')} className="text-[10px] text-cyan-400/70 hover:text-cyan-300 transition-colors">Clear</button>
                  )}
                </div>
                <input
                  value={roleSearch}
                  onChange={(e) => setRoleSearch(e.target.value)}
                  placeholder="Filter roles..."
                  className="w-full mb-2 px-2 py-1 rounded bg-white/[0.05] border border-white/10 text-white text-[11px] placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-all"
                />
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                  {visibleRoles.length === 0 && <span className="text-[10px] text-white/25">No roles found.</span>}
                  {visibleRoles.map((t) => (
                    <button
                      key={t.canonical}
                      onClick={() => setRoleFilter(roleFilter === t.canonical ? 'all' : t.canonical)}
                      className={`px-1.5 py-0.5 rounded text-[10px] transition-all ${
                        roleFilter === t.canonical
                          ? 'bg-amber-500/30 text-amber-200 border border-amber-500/40'
                          : 'bg-amber-500/10 text-amber-300/60 hover:bg-amber-500/20 hover:text-amber-300/90 border border-transparent'
                      }`}
                    >
                      {t.canonical} <span className="text-white/25">{t.count}</span>
                    </button>
                  ))}
                </div>
                {allRoleTags.length > TOP_N && !roleSearch.trim() && (
                  <button
                    onClick={() => setShowAllRoles(!showAllRoles)}
                    className="mt-2 inline-flex items-center gap-1 text-[10px] text-white/35 hover:text-white/60 transition-colors"
                  >
                    {showAllRoles ? <><ChevronUp className="w-3 h-3" /> Show fewer</> : <><ChevronDown className="w-3 h-3" /> Show all {allRoleTags.length} roles</>}
                  </button>
                )}
              </div>
            </div>

            {(layerFilter !== 'all' || roleFilter !== 'all' || tagFilter !== 'all' || search.trim()) && (
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs text-white/40">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
                <button onClick={() => { setLayerFilter('all'); setRoleFilter('all'); setTagFilter('all'); setSearch(''); setTagSearch(''); setRoleSearch(''); }}
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
