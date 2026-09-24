import { useState, useEffect, useMemo } from 'react';
import { Cpu, Loader2, ArrowUpDown, Trophy, DollarSign, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import NavBar from '../components/NavBar';
import {
  fetchPublishedByType, dedupeByModelName, getSourceDate,
  type SignalEntry, PageErrorBoundary,
} from '../lib/signalDesk';

type SortKey = 'model_name' | 'vendor' | 'benchmark_score' | 'price_input' | 'price_output' | 'date';

function parsePrice(price: string | null): number | null {
  if (!price) return null;
  const match = price.match(/([0-9]+(?:\.[0-9]+)?)/);
  return match ? parseFloat(match[1]) : null;
}

function ModelTable({ entries, sortKey, sortDir, onSort }: {
  entries: SignalEntry[];
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
}) {
  const sorted = useMemo(() => {
    const sorted2 = [...entries];
    sorted2.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'model_name': cmp = (a.model_name || '').localeCompare(b.model_name || ''); break;
        case 'vendor': cmp = (a.vendor || '').localeCompare(b.vendor || ''); break;
        case 'benchmark_score': cmp = (a.benchmark_score ?? -1) - (b.benchmark_score ?? -1); break;
        case 'price_input': cmp = (parsePrice(a.price_input) ?? Infinity) - (parsePrice(b.price_input) ?? Infinity); break;
        case 'price_output': cmp = (parsePrice(a.price_output) ?? Infinity) - (parsePrice(b.price_output) ?? Infinity); break;
        case 'date': cmp = (getSourceDate(a) || a.created_at).localeCompare(getSourceDate(b) || b.created_at); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted2;
  }, [entries, sortKey, sortDir]);

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => (
    <th className="px-3 py-2 text-left">
      <button onClick={() => onSort(k)} className="flex items-center gap-1 text-[10px] font-semibold text-white/40 hover:text-white/70 transition-colors">
        {label}
        <ArrowUpDown className={`w-2.5 h-2.5 ${sortKey === k ? 'text-cyan-400' : 'text-white/20'}`} />
      </button>
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.02]">
      <table className="w-full min-w-[700px]">
        <thead className="border-b border-white/[0.06]">
          <tr>
            <SortHeader label="Model" k="model_name" />
            <SortHeader label="Vendor" k="vendor" />
            <SortHeader label="Benchmark" k="benchmark_score" />
            <SortHeader label="Input $/M" k="price_input" />
            <SortHeader label="Output $/M" k="price_output" />
            <SortHeader label="Date" k="date" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry) => {
            const date = getSourceDate(entry);
            return (
              <tr key={entry.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                <td className="px-3 py-2.5 text-sm font-medium text-white">{entry.model_name ? <Link to={`/signal-desk/${entry.slug}`} className="hover:text-cyan-300 transition-colors">{entry.model_name}</Link> : '—'}</td>
                <td className="px-3 py-2.5 text-xs text-white/50">{entry.vendor || '—'}</td>
                <td className="px-3 py-2.5">
                  {entry.benchmark_score != null ? (
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-cyan-300">{entry.benchmark_score}</span>
                      {entry.benchmark_name && <span className="text-[9px] text-white/30">{entry.benchmark_name}</span>}
                    </div>
                  ) : <span className="text-xs text-white/20">—</span>}
                </td>
                <td className="px-3 py-2.5 text-xs text-white/50">{entry.price_input || '—'}</td>
                <td className="px-3 py-2.5 text-xs text-white/50">{entry.price_output || '—'}</td>
                <td className="px-3 py-2.5 text-[10px] text-white/30">{date || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RecommendationCard({ entries }: { entries: SignalEntry[] }) {
  const withScores = entries.filter((e) => e.benchmark_score != null);
  const withInputPrices = entries.filter((e) => parsePrice(e.price_input) != null);

  // Best overall: highest benchmark_score (only meaningful if same benchmark_name, but we pick the highest)
  const bestOverall = withScores.length > 0
    ? [...withScores].sort((a, b) => (b.benchmark_score ?? 0) - (a.benchmark_score ?? 0))[0]
    : null;

  // Best value: highest score per dollar (input price)
  const bestValue = (() => {
    const candidates = entries.filter((e) => e.benchmark_score != null && parsePrice(e.price_input) != null);
    if (candidates.length === 0) return null;
    return [...candidates].sort((a, b) => {
      const aRatio = (a.benchmark_score ?? 0) / (parsePrice(a.price_input) || 1);
      const bRatio = (b.benchmark_score ?? 0) / (parsePrice(b.price_input) || 1);
      return bRatio - aRatio;
    })[0];
  })();

  // Cheapest: lowest input price
  const cheapest = withInputPrices.length > 0
    ? [...withInputPrices].sort((a, b) => (parsePrice(a.price_input) ?? Infinity) - (parsePrice(b.price_input) ?? Infinity))[0]
    : null;

  const Card = ({ icon: Icon, title, model, detail, color }: {
    icon: typeof Trophy; title: string; model: SignalEntry | null; detail: string; color: string;
  }) => (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs font-bold text-white">{title}</span>
      </div>
      {model ? (
        <>
          <div className="text-sm font-bold text-white mb-0.5"><Link to={`/signal-desk/${model.slug}`} className="hover:text-cyan-300 transition-colors">{model.model_name}</Link></div>
          <div className="text-[10px] text-white/35">{detail}</div>
        </>
      ) : (
        <div className="text-xs text-white/25">Not enough data.</div>
      )}
    </div>
  );

  return (
    <div className="mb-6">
      <h3 className="text-xs font-bold text-white/60 mb-3 flex items-center gap-2">
        <Trophy className="w-3.5 h-3.5 text-amber-400" />
        Which model for which job?
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card
          icon={Trophy}
          title="Best overall"
          model={bestOverall}
          detail={bestOverall ? `Score: ${bestOverall.benchmark_score} on ${bestOverall.benchmark_name || 'benchmark'}` : ''}
          color="text-amber-400"
        />
        <Card
          icon={TrendingUp}
          title="Best value"
          model={bestValue}
          detail={bestValue ? `Score ${bestValue.benchmark_score} at $${parsePrice(bestValue.price_input)}/M input` : ''}
          color="text-emerald-400"
        />
        <Card
          icon={DollarSign}
          title="Cheapest"
          model={cheapest}
          detail={cheapest ? `$${parsePrice(cheapest.price_input)}/M input, $${parsePrice(cheapest.price_output)}/M output` : ''}
          color="text-cyan-400"
        />
      </div>
      {bestOverall && bestOverall.benchmark_name && (
        <p className="text-[10px] text-white/25 mt-2">
          Scores are only comparable within the same benchmark. "{bestOverall.benchmark_name}" may not cover all models listed.
        </p>
      )}
    </div>
  );
}

function ModelsInner() {
  const [allEntries, setAllEntries] = useState<SignalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    document.title = 'Model Tracker — AI Systems DNA';
  }, []);

  useEffect(() => {
    fetchPublishedByType('model_release')
      .then((data) => {
        setAllEntries(dedupeByModelName(data));
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

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
      <div className="pt-14 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-400 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Model Tracker</h1>
            <p className="text-[11px] text-white/35">Compare AI models — most recent entry per model</p>
          </div>
        </div>

        {error ? (
          <p className="text-sm text-white/40 text-center py-12">Failed to load models. Please try again later.</p>
        ) : allEntries.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-white/[0.05] bg-white/[0.01]">
            <Cpu className="w-8 h-8 text-white/15 mx-auto mb-3" />
            <p className="text-sm text-white/30">No models published yet.</p>
          </div>
        ) : (
          <>
            <RecommendationCard entries={allEntries} />
            <ModelTable
              entries={allEntries}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default function ModelsPage() {
  return (
    <PageErrorBoundary pageName="Model Tracker">
      <ModelsInner />
    </PageErrorBoundary>
  );
}
