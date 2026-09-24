import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FlaskConical, ChevronDown, Copy, Check, Loader2 } from 'lucide-react';
import NavBar from '../components/NavBar';
import {
  fetchPublishedByType, normalizeSteps, getSourceDate, TypeBadge, LayerBadge, SourcesList,
  type SignalEntry, PageErrorBoundary,
} from '../lib/signalDesk';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'ai-systems-dna-labs-progress';

function loadLocalProgress(): Record<string, number[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveLocalProgress(progress: Record<string, number[]>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch { /* no-op */ }
}

function LabCard({
  entry, expanded, onToggle, progress, onToggleStep, isLoggedIn,
}: {
  entry: SignalEntry;
  expanded: boolean;
  onToggle: () => void;
  progress: number[];
  onToggleStep: (stepIdx: number) => void;
  isLoggedIn: boolean;
}) {
  const [copiedStep, setCopiedStep] = useState<number | null>(null);
  const steps = normalizeSteps(entry.steps);
  const date = getSourceDate(entry);
  const completedCount = progress.length;
  const pct = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  const handleCopy = (text: string, stepIdx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedStep(stepIdx);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden transition-all hover:border-white/[0.12]">
      {/* Header */}
      <button onClick={onToggle} className="w-full flex items-center gap-2 px-4 py-3 text-left">
        <span className="flex-shrink-0"><TypeBadge type={entry.type} /></span>
        <LayerBadge layer={entry.system_layer} />
        <Link to={`/signal-desk/${entry.slug}`} onClick={(e) => e.stopPropagation()} className="text-sm font-bold text-white flex-1 truncate hover:text-cyan-300 transition-colors">{entry.title}</Link>
        {date && <span className="text-[10px] text-white/25 hidden sm:block">{date}</span>}
        {steps.length > 0 && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${pct === 100 ? 'bg-green-500/15 text-green-300' : 'bg-white/[0.05] text-white/40'}`}>
            {completedCount}/{steps.length}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 text-white/30 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Progress bar */}
      {steps.length > 0 && (
        <div className="h-0.5 bg-white/[0.04]">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-green-400 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* Body */}
      {expanded && (
        <div className="px-4 py-3 space-y-3">
          <p className="text-xs text-white/50 leading-relaxed">{entry.summary}</p>
          {entry.why_it_matters && (
            <div>
              <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wide">Why it matters</span>
              <p className="text-xs text-white/55 leading-relaxed mt-0.5">{entry.why_it_matters}</p>
            </div>
          )}
          {steps.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wide">Steps</span>
              {!isLoggedIn && (
                <p className="text-[10px] text-white/25 mt-0.5 mb-1">Sign in to save progress across devices. Using local storage for now.</p>
              )}
              <ol className="mt-1.5 space-y-2">
                {steps.map((s, i) => {
                  const done = progress.includes(i);
                  return (
                    <li key={i} className="flex items-start gap-2.5">
                      <button
                        onClick={() => onToggleStep(i)}
                        className={`flex-shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                          done ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'border-white/15 text-white/20 hover:border-white/30'
                        }`}
                      >
                        {done && <Check className="w-3 h-3" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <span className={`text-xs leading-relaxed block ${done ? 'text-white/35 line-through' : 'text-white/65'}`}>
                          <span className="text-white/30 mr-1">{i + 1}.</span>{s.text}
                        </span>
                        {s.prompt && (
                          <div className="mt-1.5 flex items-start gap-2">
                            <code className="block flex-1 px-2.5 py-1.5 rounded-md bg-cyan-500/[0.06] border border-cyan-500/15 text-[10px] text-cyan-200/80 font-mono whitespace-pre-wrap">
                              {s.prompt}
                            </code>
                            <button
                              onClick={() => handleCopy(s.prompt!, i)}
                              className="flex-shrink-0 p-1.5 rounded-md border border-white/10 text-white/40 hover:text-white hover:bg-white/[0.05] transition-all"
                              title="Copy prompt"
                            >
                              {copiedStep === i ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
          <SourcesList entry={entry} />
        </div>
      )}
    </div>
  );
}

function LabsInner() {
  const [entries, setEntries] = useState<SignalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [localProgress, setLocalProgress] = useState<Record<string, number[]>>(loadLocalProgress);
  const [dbProgress, setDbProgress] = useState<Record<string, number[]>>({});
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Labs — AI Systems DNA';
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(!!data.session);
      setUserId(data.session?.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
      setUserId(session?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    fetchPublishedByType('tutorial')
      .then((data) => { setEntries(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  // Load DB progress when logged in
  useEffect(() => {
    if (!isLoggedIn || !userId) return;
    supabase
      .from('labs_progress')
      .select('entry_id, completed_steps')
      .eq('user_id', userId)
      .then(({ data }) => {
        if (data) {
          const map: Record<string, number[]> = {};
          for (const row of data) {
            map[row.entry_id] = row.completed_steps || [];
          }
          setDbProgress(map);
        }
      });
  }, [isLoggedIn, userId]);

  const getProgress = (entryId: string): number[] => {
    if (isLoggedIn) return dbProgress[entryId] || [];
    return localProgress[entryId] || [];
  };

  const handleToggleStep = useCallback((entryId: string, stepIdx: number) => {
    if (isLoggedIn) {
      setDbProgress((prev) => {
        const current = prev[entryId] || [];
        const next = current.includes(stepIdx)
          ? current.filter((i) => i !== stepIdx)
          : [...current, stepIdx].sort((a, b) => a - b);
        // Persist to DB
        supabase
          .from('labs_progress')
          .upsert({ entry_id: entryId, completed_steps: next, user_id: userId }, { onConflict: 'user_id,entry_id' })
          .then(() => {});
        return { ...prev, [entryId]: next };
      });
    } else {
      setLocalProgress((prev) => {
        const current = prev[entryId] || [];
        const next = current.includes(stepIdx)
          ? current.filter((i) => i !== stepIdx)
          : [...current, stepIdx].sort((a, b) => a - b);
        const newProgress = { ...prev, [entryId]: next };
        saveLocalProgress(newProgress);
        return newProgress;
      });
    }
  }, [isLoggedIn, userId]);

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
      <div className="pt-14 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-green-400 flex items-center justify-center">
            <FlaskConical className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Labs</h1>
            <p className="text-[11px] text-white/35">Hands-on tutorials with step-by-step checklists</p>
          </div>
        </div>

        {error ? (
          <p className="text-sm text-white/40 text-center py-12">Failed to load labs. Please try again later.</p>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-white/[0.05] bg-white/[0.01]">
            <FlaskConical className="w-8 h-8 text-white/15 mx-auto mb-3" />
            <p className="text-sm text-white/30">No labs published yet. Check back soon.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <LabCard
                key={entry.id}
                entry={entry}
                expanded={expandedId === entry.id}
                onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                progress={getProgress(entry.id)}
                onToggleStep={(stepIdx) => handleToggleStep(entry.id, stepIdx)}
                isLoggedIn={isLoggedIn}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LabsPage() {
  return (
    <PageErrorBoundary pageName="Labs">
      <LabsInner />
    </PageErrorBoundary>
  );
}
