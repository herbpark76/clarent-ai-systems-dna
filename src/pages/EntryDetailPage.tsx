import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Check, Link2, Loader2, Tag } from 'lucide-react';
import NavBar from '../components/NavBar';
import {
  fetchPublishedBySlug, fetchPublishedEntries, normalizeSteps, normalizeStringArray,
  getSources, getSourceDate, TypeBadge, LayerBadge, FromTheFieldBadge,
  type SignalEntry, PageErrorBoundary,
} from '../lib/signalDesk';
import { supabase } from '../lib/supabase';

function EntryLink({ entry }: { entry: SignalEntry }) {
  return (
    <Link to={`/signal-desk/${entry.slug}`} className="group block p-3 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12] transition-all">
      <div className="flex items-center gap-2 mb-1">
        <TypeBadge type={entry.type} />
        <LayerBadge layer={entry.system_layer} />
      </div>
      <span className="text-sm font-medium text-white/70 group-hover:text-white transition-colors leading-snug line-clamp-2">{entry.title}</span>
    </Link>
  );
}

function EntryDetailInner() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<SignalEntry | null>(null);
  const [allEntries, setAllEntries] = useState<SignalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [stepProgress, setStepProgress] = useState<number[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

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
    if (!slug) return;
    setLoading(true);
    setNotFound(false);
    Promise.all([
      fetchPublishedBySlug(slug),
      fetchPublishedEntries(),
    ])
      .then(([entryData, allData]) => {
        if (!entryData) {
          setNotFound(true);
        } else {
          setEntry(entryData);
          setAllEntries(allData);
          // Load progress for tutorials
          if (entryData.type === 'tutorial' && isLoggedIn && userId) {
            supabase
              .from('labs_progress')
              .select('completed_steps')
              .eq('entry_id', entryData.id)
              .eq('user_id', userId)
              .maybeSingle()
              .then(({ data: progData }) => {
                if (progData) setStepProgress(progData.completed_steps || []);
              });
          } else if (entryData.type === 'tutorial') {
            try {
              const raw = localStorage.getItem('ai-systems-dna-labs-progress');
              if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed[entryData.id]) setStepProgress(parsed[entryData.id]);
              }
            } catch { /* no-op */ }
          }
        }
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [slug, isLoggedIn, userId]);

  // Set page title and meta tags
  useEffect(() => {
    if (entry) {
      document.title = `${entry.title} — AI Systems DNA`;
      setMetaTag('description', entry.summary);
      setMetaProperty('og:title', `${entry.title} — AI Systems DNA`);
      setMetaProperty('og:description', entry.summary);
      setMetaProperty('og:url', `${window.location.origin}/signal-desk/${entry.slug}`);
      setMetaProperty('og:type', 'article');
      setMetaProperty('twitter:card', 'summary_large_image');
      setMetaProperty('twitter:title', `${entry.title} — AI Systems DNA`);
      setMetaProperty('twitter:description', entry.summary);
    }
    return () => {
      // Clean up meta tags when leaving
      document.title = 'AI Systems DNA';
      removeMetaTag('description');
      ['og:title', 'og:description', 'og:url', 'og:type', 'twitter:card', 'twitter:title', 'twitter:description'].forEach(removeMetaProperty);
    };
  }, [entry]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleToggleStep = useCallback((stepIdx: number) => {
    if (!entry) return;
    setStepProgress((prev) => {
      const next = prev.includes(stepIdx)
        ? prev.filter((i) => i !== stepIdx)
        : [...prev, stepIdx].sort((a, b) => a - b);
      if (isLoggedIn && userId) {
        supabase
          .from('labs_progress')
          .upsert({ entry_id: entry.id, completed_steps: next, user_id: userId }, { onConflict: 'user_id,entry_id' })
          .then(() => {});
      } else {
        try {
          const raw = localStorage.getItem('ai-systems-dna-labs-progress');
          const parsed = raw ? JSON.parse(raw) : {};
          parsed[entry.id] = next;
          localStorage.setItem('ai-systems-dna-labs-progress', JSON.stringify(parsed));
        } catch { /* no-op */ }
      }
      return next;
    });
  }, [entry, isLoggedIn, userId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080c14] text-white">
        <NavBar />
        <div className="pt-20 flex items-center justify-center"><Loader2 className="w-5 h-5 text-white/30 animate-spin" /></div>
      </div>
    );
  }

  if (notFound || !entry) {
    return (
      <div className="min-h-screen bg-[#080c14] text-white font-sans antialiased">
        <NavBar />
        <div className="pt-20 max-w-lg mx-auto px-4 text-center">
          <div className="w-12 h-12 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-white/40 text-xl">?</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Page not found</h1>
          <p className="text-sm text-white/40 mb-6">This entry doesn't exist or hasn't been published yet.</p>
          <Link to="/signal-desk" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-semibold hover:from-blue-400 hover:to-cyan-400 transition-all">
            Back to Signal Desk
          </Link>
        </div>
      </div>
    );
  }

  const date = getSourceDate(entry);
  const steps = normalizeSteps(entry.steps);
  const tags = normalizeStringArray(entry.tags);
  const roleTags = normalizeStringArray(entry.role_tags);
  const sources = getSources(entry);

  // Related entries: same system_layer or shared tags, up to 4
  const related = allEntries
    .filter((e) => e.id !== entry.id)
    .map((e) => {
      let score = 0;
      if (entry.system_layer && e.system_layer === entry.system_layer) score += 2;
      const sharedTags = normalizeStringArray(e.tags).filter((t) => tags.includes(t));
      score += sharedTags.length;
      return { entry: e, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((r) => r.entry);

  return (
    <div className="min-h-screen bg-[#080c14] text-white font-sans antialiased">
      <NavBar />
      <div className="pt-14 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-24">
        {/* Back link */}
        <button onClick={() => navigate('/signal-desk')} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 mb-6 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Signal Desk
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <TypeBadge type={entry.type} />
          <FromTheFieldBadge origin={entry.origin} />
          <LayerBadge layer={entry.system_layer} />
          {date && <span className="text-[10px] text-white/25">{date}</span>}
        </div>

        <h1 className="text-2xl font-bold text-white mb-4 leading-tight">{entry.title}</h1>

        {/* Copy link button */}
        <button
          onClick={handleCopyLink}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-xs text-white/50 hover:text-white hover:bg-white/[0.06] transition-all mb-6"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Link2 className="w-3.5 h-3.5" />}
          {copied ? 'Link copied' : 'Copy link'}
        </button>

        {/* Summary */}
        <p className="text-sm text-white/60 leading-relaxed mb-6">{entry.summary}</p>

        {/* Content sections */}
        {entry.why_it_matters && (
          <div className="mb-5 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <h2 className="text-xs font-bold text-white/40 uppercase tracking-wide mb-2">Why it matters</h2>
            <p className="text-sm text-white/60 leading-relaxed">{entry.why_it_matters}</p>
          </div>
        )}

        {entry.how_its_built && (
          <div className="mb-5 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <h2 className="text-xs font-bold text-white/40 uppercase tracking-wide mb-2">How it's built</h2>
            <p className="text-sm text-white/60 leading-relaxed">{entry.how_its_built}</p>
          </div>
        )}

        {entry.business_angle && (
          <div className="mb-5 p-4 rounded-xl border border-amber-500/10 bg-amber-500/[0.03]">
            <h2 className="text-xs font-bold text-amber-300/60 uppercase tracking-wide mb-2">Business angle</h2>
            <p className="text-sm text-white/60 leading-relaxed">{entry.business_angle}</p>
          </div>
        )}

        {/* Steps (for tutorials) */}
        {steps.length > 0 && (
          <div className="mb-5 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-white/40 uppercase tracking-wide">Steps</h2>
              <span className="text-[10px] text-white/30">{stepProgress.length}/{steps.length} done</span>
            </div>
            {/* Progress bar */}
            <div className="h-1 rounded-full bg-white/[0.04] mb-3">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-400 transition-all duration-500"
                style={{ width: `${steps.length > 0 ? Math.round((stepProgress.length / steps.length) * 100) : 0}%` }}
              />
            </div>
            <ol className="space-y-2.5">
              {steps.map((s, i) => (
                <StepItem
                  key={i}
                  stepIdx={i}
                  text={s.text}
                  prompt={s.prompt}
                  done={stepProgress.includes(i)}
                  onToggle={() => handleToggleStep(i)}
                />
              ))}
            </ol>
          </div>
        )}

        {/* Model details */}
        {(entry.model_name || entry.vendor || entry.benchmark_score != null || entry.price_input || entry.price_output) && (
          <div className="mb-5 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <h2 className="text-xs font-bold text-white/40 uppercase tracking-wide mb-3">Model details</h2>
            <div className="grid grid-cols-2 gap-3">
              {entry.model_name && (
                <div>
                  <span className="text-[10px] text-white/30">Model</span>
                  <p className="text-sm text-white/70">{entry.model_name}</p>
                </div>
              )}
              {entry.vendor && (
                <div>
                  <span className="text-[10px] text-white/30">Vendor</span>
                  <p className="text-sm text-white/70">{entry.vendor}</p>
                </div>
              )}
              {entry.benchmark_score != null && (
                <div>
                  <span className="text-[10px] text-white/30">Benchmark</span>
                  <p className="text-sm text-white/70">{entry.benchmark_score}{entry.benchmark_name ? ` on ${entry.benchmark_name}` : ''}</p>
                </div>
              )}
              {entry.price_input && (
                <div>
                  <span className="text-[10px] text-white/30">Input $/M</span>
                  <p className="text-sm text-white/70">{entry.price_input}</p>
                </div>
              )}
              {entry.price_output && (
                <div>
                  <span className="text-[10px] text-white/30">Output $/M</span>
                  <p className="text-sm text-white/70">{entry.price_output}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tags */}
        {(tags.length > 0 || roleTags.length > 0) && (
          <div className="mb-5">
            <div className="flex flex-wrap gap-1.5">
              {roleTags.map((t) => (
                <span key={`r-${t}`} className="px-2 py-0.5 rounded-md bg-amber-500/10 text-[10px] text-amber-300/80 border border-amber-500/20">{t}</span>
              ))}
              {tags.map((t) => (
                <span key={`t-${t}`} className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.05] text-[10px] text-white/45 border border-white/10">
                  <Tag className="w-2.5 h-2.5" />{t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Sources */}
        {sources.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-bold text-white/40 uppercase tracking-wide mb-2">Sources</h2>
            <div className="space-y-1.5">
              {sources.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 transition-colors">
                      {s.name || s.url}
                    </a>
                  ) : (
                    <span className="text-white/50">{s.name || 'Source'}</span>
                  )}
                  {s.date && <span className="text-[10px] text-white/25">· {s.date}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Related entries */}
        {related.length > 0 && (
          <div>
            <h2 className="text-xs font-bold text-white/40 uppercase tracking-wide mb-3">Related entries</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {related.map((r) => <EntryLink key={r.id} entry={r} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Meta tag helpers ───────────────────────────────────
function setMetaTag(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setMetaProperty(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function removeMetaTag(name: string) {
  document.querySelector(`meta[name="${name}"]`)?.remove();
}

function removeMetaProperty(property: string) {
  document.querySelector(`meta[property="${property}"]`)?.remove();
}

// ── Per-step copy state (must be a component, not inline in map) ──
function StepItem({
  stepIdx, text, prompt, done, onToggle,
}: {
  stepIdx: number; text: string; prompt?: string; done: boolean; onToggle: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <li className="flex items-start gap-2.5">
      <button
        onClick={onToggle}
        className={`flex-shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
          done ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'border-white/15 text-white/20 hover:border-white/30'
        }`}
      >
        {done && <Check className="w-3 h-3" />}
      </button>
      <div className="flex-1 min-w-0">
        <span className={`text-sm leading-relaxed block ${done ? 'text-white/35 line-through' : 'text-white/70'}`}>
          <span className="text-white/30 mr-1">{stepIdx + 1}.</span>{text}
        </span>
        {prompt && (
          <div className="mt-1.5 flex items-start gap-2">
            <code className="block flex-1 px-2.5 py-1.5 rounded-md bg-cyan-500/[0.06] border border-cyan-500/15 text-xs text-cyan-200/80 font-mono whitespace-pre-wrap">
              {prompt}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(prompt);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="flex-shrink-0 p-1.5 rounded-md border border-white/10 text-white/40 hover:text-white hover:bg-white/[0.05] transition-all"
              title="Copy prompt"
            >
              {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        )}
      </div>
    </li>
  );
}


export default function EntryDetailPage() {
  return (
    <PageErrorBoundary pageName="Entry">
      <EntryDetailInner />
    </PageErrorBoundary>
  );
}
