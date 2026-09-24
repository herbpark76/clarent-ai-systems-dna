import { useState, useEffect } from 'react';
import { ShieldAlert, Loader2, Briefcase } from 'lucide-react';
import { Link } from 'react-router-dom';
import NavBar from '../components/NavBar';
import {
  fetchPublishedByType, getSourceDate, TypeBadge, LayerBadge, SourcesList,
  type SignalEntry, PageErrorBoundary,
} from '../lib/signalDesk';

const PINNED_QUESTIONS = [
  'What identity does the agent use and is it logged?',
  'Where are credentials stored and who can see them?',
  'What actions can it take without human approval?',
  'How are its changes audited and reversible?',
  'What happens when the target system blocks or changes on it?',
];

function RiskCard({ entry }: { entry: SignalEntry }) {
  const date = getSourceDate(entry);
  return (
    <div className="relative pl-6 pb-6">
      {/* Timeline dot */}
      <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full bg-red-500/40 border-2 border-[#080c14]" />
      {/* Timeline line */}
      <div className="absolute left-[5px] top-5 bottom-0 w-px bg-white/[0.06]" />

      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 hover:border-white/[0.15] transition-all">
        <div className="flex items-center gap-2 mb-2">
          <TypeBadge type={entry.type} />
          <LayerBadge layer={entry.system_layer} />
          {date && <span className="text-[10px] text-white/25 ml-auto">{date}</span>}
        </div>
        <h3 className="text-sm font-bold text-white mb-2 leading-snug hover:text-cyan-300 transition-colors"><Link to={`/signal-desk/${entry.slug}`}>{entry.title}</Link></h3>
        <p className="text-xs text-white/50 leading-relaxed mb-3">{entry.summary}</p>

        {entry.why_it_matters && (
          <div className="mb-2">
            <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wide">Why it matters</span>
            <p className="text-xs text-white/55 leading-relaxed mt-0.5">{entry.why_it_matters}</p>
          </div>
        )}
        {entry.how_its_built && (
          <div className="mb-2">
            <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wide">How it's built</span>
            <p className="text-xs text-white/55 leading-relaxed mt-0.5">{entry.how_its_built}</p>
          </div>
        )}
        {entry.business_angle && (
          <div className="flex items-start gap-1.5 mb-2">
            <Briefcase className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wide">Business angle</span>
              <p className="text-xs text-white/55 leading-relaxed mt-0.5">{entry.business_angle}</p>
            </div>
          </div>
        )}
        <SourcesList entry={entry} />
      </div>
    </div>
  );
}

function RiskInner() {
  const [entries, setEntries] = useState<SignalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    document.title = 'AI Risk & Governance — AI Systems DNA';
  }, []);

  useEffect(() => {
    fetchPublishedByType('risk')
      .then((data) => { setEntries(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

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
      <div className="pt-14 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-rose-400 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">AI Risk & Governance</h1>
            <p className="text-[11px] text-white/35">Risks, controls, and governance for AI in production</p>
          </div>
        </div>

        {/* Pinned card: 5 questions */}
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-6 mb-8">
          <h2 className="text-sm font-bold text-amber-200 mb-1">5 questions before an AI agent touches your ERP</h2>
          <p className="text-[11px] text-amber-300/50 mb-4">A practical checklist for finance, tax, and operations leaders.</p>
          <ol className="space-y-2.5">
            {PINNED_QUESTIONS.map((q, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-md bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-[10px] font-bold text-amber-300">
                  {i + 1}
                </span>
                <span className="text-sm text-white/70 leading-relaxed">{q}</span>
              </li>
            ))}
          </ol>
        </div>

        {error ? (
          <p className="text-sm text-white/40 text-center py-12">Failed to load risk entries. Please try again later.</p>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-white/[0.05] bg-white/[0.01]">
            <ShieldAlert className="w-8 h-8 text-white/15 mx-auto mb-3" />
            <p className="text-sm text-white/30">No risk entries published yet.</p>
          </div>
        ) : (
          <div>
            <h2 className="text-xs font-bold text-white/50 uppercase tracking-wide mb-4">Latest risks</h2>
            {entries.map((entry) => <RiskCard key={entry.id} entry={entry} />)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RiskPage() {
  return (
    <PageErrorBoundary pageName="AI Risk & Governance">
      <RiskInner />
    </PageErrorBoundary>
  );
}
