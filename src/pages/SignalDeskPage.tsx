import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Newspaper, ChevronRight, Layers, Loader2, ArrowLeft } from 'lucide-react';
import NavBar from '../components/NavBar';
import {
  fetchPublishedEntries, getSourceDate, TypeBadge, LayerBadge, SourcesList,
  LAYER_LABELS, LAYER_COLORS, type SignalEntry, type SystemLayer, PageErrorBoundary,
} from '../lib/signalDesk';

const LAYER_ORDER: SystemLayer[] = [
  'model', 'agent', 'tools_connectors', 'data_context', 'evals', 'security_governance', 'interface',
];

function EntryMiniCard({ entry }: { entry: SignalEntry }) {
  const date = getSourceDate(entry);
  return (
    <Link to={`/signal-desk/${entry.slug}`} className="block group">
      <div className="flex items-start gap-2 py-1.5">
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <span className="text-xs font-medium text-white/80 group-hover:text-white transition-colors leading-snug line-clamp-2">{entry.title}</span>
          {date && <span className="text-[10px] text-white/25">{date}</span>}
        </div>
      </div>
    </Link>
  );
}

function LayerCard({
  label, count, entries, color, layer, onFilter,
}: {
  label: string; count: number; entries: SignalEntry[]; color: string;
  layer: SystemLayer | null; onFilter: (layer: SystemLayer | null) => void;
}) {
  return (
    <button
      onClick={() => onFilter(layer)}
      className="group p-5 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.15] transition-all duration-200 text-left"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Layers className={`w-4 h-4 ${color}`} />
          <span className="text-sm font-bold text-white">{label}</span>
        </div>
        <span className="text-xs text-white/30 font-medium">{count}</span>
      </div>
      {entries.length > 0 ? (
        <div className="space-y-0.5 mb-2">
          {entries.slice(0, 3).map((e) => <EntryMiniCard key={e.id} entry={e} />)}
        </div>
      ) : (
        <p className="text-xs text-white/25 mb-2">No entries yet.</p>
      )}
      <div className="flex items-center gap-1 text-[10px] text-white/30 group-hover:text-white/60 transition-colors">
        View all <ChevronRight className="w-2.5 h-2.5" />
      </div>
    </button>
  );
}

function EntryDetailCard({ entry }: { entry: SignalEntry }) {
  const date = getSourceDate(entry);
  return (
    <Link to={`/signal-desk/${entry.slug}`} className="block rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 hover:bg-white/[0.05] hover:border-white/[0.15] transition-all">
      <div className="flex items-center gap-2 mb-2">
        <TypeBadge type={entry.type} />
        <LayerBadge layer={entry.system_layer} />
        {date && <span className="text-[10px] text-white/25 ml-auto">{date}</span>}
      </div>
      <h3 className="text-sm font-bold text-white mb-2 leading-snug">{entry.title}</h3>
      <p className="text-xs text-white/50 leading-relaxed mb-3">{entry.summary}</p>
      {entry.why_it_matters && (
        <div className="mb-2">
          <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wide">Why it matters</span>
          <p className="text-xs text-white/55 leading-relaxed mt-0.5">{entry.why_it_matters}</p>
        </div>
      )}
      {entry.business_angle && (
        <div className="mb-2">
          <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wide">Business angle</span>
          <p className="text-xs text-white/55 leading-relaxed mt-0.5">{entry.business_angle}</p>
        </div>
      )}
      <SourcesList entry={entry} />
    </Link>
  );
}

function SignalDeskInner() {
  const [entries, setEntries] = useState<SignalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SystemLayer | null | 'all'>('all');
  const [error, setError] = useState(false);

  useEffect(() => {
    document.title = 'Signal Desk — AI Systems DNA';
  }, []);

  useEffect(() => {
    fetchPublishedEntries()
      .then((data) => { setEntries(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const layerGroups = LAYER_ORDER.map((layer) => ({
    layer,
    label: LAYER_LABELS[layer],
    color: LAYER_COLORS[layer],
    entries: entries.filter((e) => e.system_layer === layer),
  }));

  const industryEntries = entries.filter((e) => !e.system_layer);

  const filtered = filter === 'all'
    ? entries
    : filter === null
      ? industryEntries
      : entries.filter((e) => e.system_layer === filter);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080c14] text-white">
        <NavBar />
        <div className="pt-20 flex items-center justify-center"><Loader2 className="w-5 h-5 text-white/30 animate-spin" /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#080c14] text-white">
        <NavBar />
        <div className="pt-20 max-w-lg mx-auto px-4 text-center">
          <p className="text-sm text-white/40">Failed to load entries. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080c14] text-white font-sans antialiased">
      <NavBar />

      <div className="pt-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
            <Newspaper className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Signal Desk</h1>
            <p className="text-[11px] text-white/35">AI news, sorted by system layer</p>
          </div>
        </div>

        {/* Intro */}
        <p className="text-sm text-white/45 leading-relaxed max-w-2xl mb-8">
          Every AI headline is a clue about how these systems are built. Here's the latest news, sorted by the part of the system it touches.
        </p>

        {filter !== 'all' ? (
          <>
            <button onClick={() => setFilter('all')} className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 mb-4 transition-colors">
              <ArrowLeft className="w-3 h-3" /> All layers
            </button>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filtered.map((entry) => (
                <EntryDetailCard key={entry.id} entry={entry} />
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Layer grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              {layerGroups.map((g) => (
                <LayerCard
                  key={g.layer}
                  label={g.label}
                  count={g.entries.length}
                  entries={g.entries}
                  color={g.color}
                  layer={g.layer}
                  onFilter={(l) => setFilter(l)}
                />
              ))}
            </div>
            {/* Industry group */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <LayerCard
                label="Industry"
                count={industryEntries.length}
                entries={industryEntries}
                color="text-slate-400"
                layer={null}
                onFilter={(l) => setFilter(l)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function SignalDeskPage() {
  return (
    <PageErrorBoundary pageName="Signal Desk">
      <SignalDeskInner />
    </PageErrorBoundary>
  );
}
