import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Clock, AlertTriangle, ArrowRight, ArrowUpRight, BookOpen, Newspaper,
} from 'lucide-react';
import { loadContent, type ContentData } from '../lib/contentService';
import { CONCEPTS, EDGES, CLUSTER_META } from '../data/concepts';
import { LEARNING_PATH_DEFS } from '../data/learningPaths';
import { ROADMAPS } from '../data/roadmaps';
import type { ProgressStatus, NextStep } from '../data/roadmaps';
import NavBar from './NavBar';
import { setPageMeta } from '../lib/seo';
import { getAllArticleMetas, getQuizSlugs, type ArticleMeta } from '../lib/articles';
import { fetchLatestByConcept, getSourceDate, TYPE_LABELS, type SignalEntry } from '../lib/signalDesk';

const STORAGE_KEY = 'ai-systems-dna-progress';

function loadProgress(): Record<string, ProgressStatus> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveProgress(p: Record<string, ProgressStatus>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* no-op */ }
}

const PROGRESS_LABELS: Record<ProgressStatus, string> = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  'completed': 'Completed',
};

const PROGRESS_STYLES: Record<ProgressStatus, { active: string; dot: string }> = {
  'not-started': { active: 'border-white/20 bg-white/[0.08] text-white/70', dot: 'bg-white/30' },
  'in-progress': { active: 'border-amber-500/50 bg-amber-500/15 text-amber-300', dot: 'bg-amber-400' },
  'completed': { active: 'border-green-500/50 bg-green-500/15 text-green-300', dot: 'bg-green-400' },
};

const fallbackContent: ContentData = {
  concepts: CONCEPTS,
  edges: EDGES,
  learningPathDefs: LEARNING_PATH_DEFS,
  conceptsMap: Object.fromEntries(CONCEPTS.map((c) => [c.id, c])),
};

function computeReadTime(concept: typeof CONCEPTS[0]): number {
  const text = [concept.description, concept.whyItMatters, concept.whyShouldICare, concept.commonMistakes.join(' ')].join(' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}


export default function ConceptPage() {
  const { slug } = useParams<{ slug: string }>();
  const [content, setContent] = useState<ContentData>(fallbackContent);
  const [progress, setProgress] = useState<Record<string, ProgressStatus>>(loadProgress);
  const [articleMetas, setArticleMetas] = useState<ArticleMeta[]>([]);
  const [quizSlugs, setQuizSlugs] = useState<Set<string>>(new Set());
  const [signalEntries, setSignalEntries] = useState<SignalEntry[]>([]);

  useEffect(() => {
    loadContent().then(setContent);
    getAllArticleMetas().then(setArticleMetas);
    setQuizSlugs(getQuizSlugs());
  }, []);

  useEffect(() => { saveProgress(progress); }, [progress]);

  const concept = slug ? (content.conceptsMap[slug] ?? null) : null;
  const readTime = concept ? computeReadTime(concept) : 1;

  // Load Signal Desk entries for this concept
  useEffect(() => {
    if (!slug) return;
    fetchLatestByConcept(slug, 3)
      .then(setSignalEntries)
      .catch(() => setSignalEntries([]));
  }, [slug]);

  useEffect(() => {
    if (concept) {
      setPageMeta({
        title: `${concept.label} | AI Systems DNA`,
        description: concept.description,
        path: `/concepts/${concept.id}`,
      });
    } else if (slug && !concept) {
      setPageMeta({ title: 'Concept Not Found | AI Systems DNA', path: `/concepts/${slug}`, noindex: true });
    }
  }, [concept, slug]);

  const handleSetProgress = (id: string, status: ProgressStatus) => {
    setProgress((prev) => ({ ...prev, [id]: status }));
  };

  if (!concept) {
    return (
      <div className="min-h-screen bg-[#080c14] text-white">
        <NavBar />
        <div className="pt-20 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <BookOpen className="w-10 h-10 text-white/20 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Concept not found</h1>
          <p className="text-white/40 text-sm mb-6">This concept doesn't exist in the map.</p>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-cyan-400 hover:text-cyan-300 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to System Map
          </Link>
        </div>
      </div>
    );
  }

  const meta = CLUSTER_META[concept.cluster];
  const currentProgress = progress[concept.id] ?? 'not-started';
  const getLabel = (id: string) => content.conceptsMap[id]?.label ?? id;

  const nextStep: (NextStep & { label: string }) | null = (() => {
    for (const roadmap of ROADMAPS) {
      const ns = roadmap.nextSteps[concept.id];
      if (ns) {
        const nextConcept = content.conceptsMap[ns.id];
        if (nextConcept) return { ...ns, label: nextConcept.label };
      }
    }
    return null;
  })();

  return (
    <div className="min-h-screen bg-[#080c14] text-white font-sans antialiased">
      <NavBar />

      <div className="absolute inset-0 opacity-[0.025] pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

      <div className="relative pt-14">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24">
          {/* Back link */}
          <Link
            to="/#system-map"
            className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors mb-8 group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            System Map
          </Link>

          {/* Header */}
          <div className="mb-8">
            <div
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide mb-3"
              style={{ background: `${meta.glow}22`, color: meta.stroke, border: `1px solid ${meta.glow}44` }}
            >
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: meta.stroke }} />
              {meta.label}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-2">{concept.label}</h1>
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-white/25" />
              <span className="text-xs text-white/30">~{readTime} min read</span>
            </div>
          </div>

          {/* Progress tracker */}
          <div className="mb-8">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-white/35 mb-2">
              Your Progress
            </div>
            <div className="flex gap-2">
              {(['not-started', 'in-progress', 'completed'] as ProgressStatus[]).map((status) => {
                const isActive = currentProgress === status;
                const styles = PROGRESS_STYLES[status];
                return (
                  <button
                    key={status}
                    onClick={() => handleSetProgress(concept.id, status)}
                    className={`flex-1 flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium border transition-all ${isActive ? styles.active : 'border-white/[0.08] bg-white/[0.03] text-white/35 hover:text-white/60 hover:bg-white/[0.06]'}`}
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? styles.dot : 'bg-white/20'}`} />
                    <span className="truncate">{PROGRESS_LABELS[status]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div className="mb-6">
            <p className="text-base text-white/65 leading-relaxed">{concept.description}</p>
          </div>

          {/* Why It Matters (merged) */}
          <div
            className="p-4 rounded-xl mb-5"
            style={{ background: `${meta.glow}10`, border: `1px solid ${meta.glow}25` }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: meta.stroke }}>
              Why It Matters
            </div>
            <p className="text-sm text-white/60 leading-relaxed">{concept.whyItMatters}</p>
            <p className="text-sm text-white/55 leading-relaxed mt-2">{concept.whyShouldICare}</p>
          </div>

          {/* Common Mistakes */}
          <div className="mb-6">
            <div className="flex items-center gap-1.5 mb-2.5">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-400/70" />
              <div className="text-[10px] font-semibold uppercase tracking-widest text-white/35">
                Common Mistakes
              </div>
            </div>
            <div className="space-y-2">
              {concept.commonMistakes.map((mistake, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-1 h-1 rounded-full bg-orange-400/50 mt-2 flex-shrink-0" />
                  <p className="text-sm text-white/50 leading-relaxed">{mistake}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Next Recommended Step */}
          {nextStep && (
            <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] mb-6">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400/80 mb-2">
                Next Recommended Step
              </div>
              <Link
                to={`/concepts/${nextStep.id}`}
                className="w-full flex items-center justify-between gap-2 mb-2 group"
              >
                <span className="text-sm font-semibold text-emerald-300 group-hover:text-emerald-200 transition-colors">
                  {nextStep.label}
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400/60 group-hover:text-emerald-300 flex-shrink-0 transition-colors" />
              </Link>
              <p className="text-xs text-white/45 leading-relaxed italic">"{nextStep.reason}"</p>
            </div>
          )}

          {/* Prerequisites */}
          {concept.prerequisites.length > 0 && (
            <div className="mb-6">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-white/35 mb-2">
                Requires Understanding
              </div>
              <div className="flex flex-wrap gap-1.5">
                {concept.prerequisites.map((id) => {
                  const prereqConcept = content.conceptsMap[id];
                  const prereqMeta = prereqConcept ? CLUSTER_META[prereqConcept.cluster] : CLUSTER_META.foundation;
                  return (
                    <Link
                      key={id}
                      to={`/concepts/${id}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all hover:scale-105"
                      style={{ background: `${prereqMeta.glow}15`, border: `1px solid ${prereqMeta.glow}35`, color: prereqMeta.stroke }}
                    >
                      {getLabel(id)}
                      <ArrowRight className="w-2.5 h-2.5 opacity-60" />
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Unlocks Next */}
          {concept.unlocksNext.length > 0 && (
            <div className="mb-6">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-white/35 mb-2">
                Unlocks Next
              </div>
              <div className="flex flex-wrap gap-1.5">
                {concept.unlocksNext.map((id) => {
                  const nextConcept = content.conceptsMap[id];
                  const nextMeta = nextConcept ? CLUSTER_META[nextConcept.cluster] : CLUSTER_META.foundation;
                  return (
                    <Link
                      key={id}
                      to={`/concepts/${id}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all hover:scale-105"
                      style={{ background: `${nextMeta.glow}15`, border: `1px solid ${nextMeta.glow}35`, color: nextMeta.stroke }}
                    >
                      <ArrowRight className="w-2.5 h-2.5 opacity-60" />
                      {getLabel(id)}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Related tech */}
          <div className="mb-6">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-white/35 mb-2">
              Related Technologies
            </div>
            <div className="flex flex-wrap gap-1.5">
              {concept.relatedTech.map((tech) => (
                <span key={tech} className="px-2 py-0.5 rounded-md text-xs text-white/45 border border-white/[0.08] bg-white/[0.04]">
                  {tech}
                </span>
              ))}
            </div>
          </div>

          {/* Go deeper: related articles */}
          {(() => {
            const relatedArticles = articleMetas.filter((m) =>
              m.concepts && m.concepts.includes(concept.id)
            );
            if (relatedArticles.length === 0) return null;
            return (
              <div className="mb-6 p-4 rounded-xl border border-white/[0.08] bg-white/[0.03]">
                <div className="flex items-center gap-1.5 mb-3">
                  <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
                    Go Deeper
                  </div>
                </div>
                <div className="space-y-2">
                  {relatedArticles.map((article) => (
                    <Link
                      key={article.slug}
                      to={`/articles/${article.slug}`}
                      className="flex items-center justify-between gap-2 group"
                    >
                      <span className="text-sm text-white/65 group-hover:text-white transition-colors">{article.title}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {quizSlugs.has(article.slug) && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">Quiz</span>
                        )}
                        <ArrowUpRight className="w-3 h-3 text-white/30 group-hover:text-white/60 transition-colors" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Latest from Signal Desk */}
          {signalEntries.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-1.5 mb-3">
                <Newspaper className="w-3.5 h-3.5 text-cyan-400" />
                <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
                  Latest from Signal Desk
                </div>
              </div>
              <div className="space-y-2">
                {signalEntries.map((entry) => {
                  const date = getSourceDate(entry);
                  return (
                    <Link
                      key={entry.id}
                      to={`/signal-desk/${entry.slug}`}
                      className="block p-3 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12] transition-all group"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-white/[0.06] text-white/50">{TYPE_LABELS[entry.type]}</span>
                        {date && <span className="text-[10px] text-white/25">{date}</span>}
                      </div>
                      <span className="text-sm font-medium text-white/70 group-hover:text-white transition-colors leading-snug line-clamp-2">{entry.title}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer back link */}
          <div className="mt-12 pt-8 border-t border-white/[0.05]">
            <Link
              to="/#system-map"
              className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Back to System Map
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
