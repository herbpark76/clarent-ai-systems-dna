import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronRight, ArrowRight,
  BookOpen, GraduationCap, Wrench, Layers, Building2, Briefcase,
  Zap, Brain, Map, Compass, Newspaper, Clock,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { loadContent, type ContentData } from '../lib/contentService';
import ConceptMap from '../components/ConceptMap';
import SidePanel from '../components/SidePanel';
import RoadmapPanel from '../components/RoadmapPanel';
import GoalSelector from '../components/GoalSelector';
import LearningPathSidebar from '../components/LearningPathSidebar';
import CompletionScreen from '../components/CompletionScreen';
import NavBar from '../components/NavBar';
import { CONCEPTS, EDGES, CLUSTER_META, type ClusterType } from '../data/concepts';
import { PLAIN_ENGLISH } from '../data/plainEnglish';
import { startLessonUrl } from '../lib/lessonNav';
import { ROADMAPS, type ProgressStatus, type NextStep } from '../data/roadmaps';
import { LEARNING_PATH_DEFS } from '../data/learningPaths';
import { getAllArticleMetas, type ArticleMeta } from '../lib/articles';
import { fetchLatestPublished, getSourceDate, TYPE_LABELS, TYPE_COLORS, FromTheFieldBadge, type SignalEntry as SignalEntryType } from '../lib/signalDesk';
import { setPageMeta } from '../lib/seo';

type AppMode = 'explore' | 'roadmap';

const CATEGORY_COLORS: Record<string, { color: string; tag: string }> = {
  Foundation:  { color: 'border-blue-500/30', tag: 'bg-blue-500/15 text-blue-300' },
  Retrieval:   { color: 'border-emerald-500/30', tag: 'bg-emerald-500/15 text-emerald-300' },
  Protocols:   { color: 'border-orange-500/30', tag: 'bg-orange-500/15 text-orange-300' },
  Agents:      { color: 'border-yellow-500/30', tag: 'bg-yellow-500/15 text-yellow-300' },
  Data:        { color: 'border-teal-500/30', tag: 'bg-teal-500/15 text-teal-300' },
  Integration: { color: 'border-red-500/30', tag: 'bg-red-500/15 text-red-300' },
  Evaluation:  { color: 'border-sky-500/30', tag: 'bg-sky-500/15 text-sky-300' },
  Domain:      { color: 'border-rose-500/30', tag: 'bg-rose-500/15 text-rose-300' },
};

function getCategoryStyle(category: string) {
  return CATEGORY_COLORS[category] ?? { color: 'border-white/15', tag: 'bg-white/10 text-white/50' };
}

// New readers should meet the Foundation guides first.
const DEEP_DIVE_ORDER = [
  'what-is-an-llm',
  'what-are-tokens',
  'what-is-a-context-window',
  'what-are-embeddings',
  'what-is-rag',
  'what-are-ai-agents',
];

function sortDeepDives(metas: ArticleMeta[]): ArticleMeta[] {
  const rank = (slug: string) => {
    const i = DEEP_DIVE_ORDER.indexOf(slug);
    return i === -1 ? DEEP_DIVE_ORDER.length : i;
  };
  return [...metas].sort((a, b) => rank(a.slug) - rank(b.slug) || a.title.localeCompare(b.title));
}

const CLUSTER_ORDER: ClusterType[] = ['foundation', 'knowledge', 'intelligence', 'production'];

/** On phones the graph is too small to read, so show the same concepts as a simple list. */
function MobileConceptList() {
  return (
    <div className="md:hidden px-4 pb-10 space-y-6">
      {CLUSTER_ORDER.map((cluster) => {
        const meta = CLUSTER_META[cluster];
        const items = CONCEPTS.filter((c) => c.cluster === cluster);
        return (
          <div key={cluster}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full" style={{ background: meta.stroke }} />
              <span className={`text-xs font-semibold uppercase tracking-widest ${meta.color}`}>{meta.label}</span>
            </div>
            <div className="space-y-2">
              {items.map((c) => (
                <Link
                  key={c.id}
                  to={`/concepts/${c.id}`}
                  className="block p-3 rounded-xl border border-white/[0.08] bg-white/[0.03] active:bg-white/[0.07]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-white">{c.label}</span>
                    <ChevronRight className="w-4 h-4 text-white/40 flex-shrink-0" />
                  </div>
                  {PLAIN_ENGLISH[c.id] && (
                    <p className="text-xs text-white/55 leading-relaxed mt-1">{PLAIN_ENGLISH[c.id].plain}</p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const DOMAIN_TRACK_ORDER = [
  'building-a-domain-intelligence-platform',
  'modeling-a-domain-knowledge-graph',
  'rag-for-vertical-data',
  'mcp-for-domain-tools',
];

const LEARNING_PATHS = [
  {
    id: 'beginner',
    icon: GraduationCap,
    level: 'Beginner',
    label: 'Understand the Basics',
    color: 'from-sky-500/20 to-sky-400/5',
    border: 'border-sky-500/30',
    accent: 'text-sky-400',
    badge: 'bg-sky-500/20 text-sky-300',
    topics: ['What is an LLM?', 'How AI reads text', 'Why chats "forget"', 'Answers from your own data'],
    description: 'Start here if you\'re new. Seven short lessons on what tools like ChatGPT and Claude are doing, in plain English.',
  },
  {
    id: 'leader',
    icon: Briefcase,
    level: 'Business Leader',
    label: 'Make Good Decisions About AI',
    color: 'from-violet-500/20 to-violet-400/5',
    border: 'border-violet-500/30',
    accent: 'text-violet-400',
    badge: 'bg-violet-500/20 text-violet-300',
    topics: ['What AI can and can\'t do', 'Answers from your own data', 'Agents and tools', 'Testing and risk'],
    description: 'For managers and finance, tax and operations leaders. Learn where AI helps, where it goes wrong, and what to ask before it touches your systems.',
  },
  {
    id: 'builder',
    icon: Wrench,
    level: 'Builder',
    label: 'Build AI-Powered Workflows',
    color: 'from-emerald-500/20 to-emerald-400/5',
    border: 'border-emerald-500/30',
    accent: 'text-emerald-400',
    badge: 'bg-emerald-500/20 text-emerald-300',
    topics: ['RAG pipelines', 'Tool calling', 'Agent loops', 'Memory patterns'],
    description: 'For developers ready to ship. Build your first RAG pipeline, wire up tool-calling agents, and handle memory.',
  },
  {
    id: 'architect',
    icon: Layers,
    level: 'Architect',
    label: 'Design Production AI Systems',
    color: 'from-orange-500/20 to-orange-400/5',
    border: 'border-orange-500/30',
    accent: 'text-orange-400',
    badge: 'bg-orange-500/20 text-orange-300',
    topics: ['System evaluation', 'Guardrails', 'Orchestration', 'Scalable architecture'],
    description: 'For engineers designing systems at scale. Covers evaluation, observability, orchestration, and production hardening.',
  },
  {
    id: 'domain-builder',
    icon: Building2,
    level: 'Domain Platform Builder',
    label: 'Apply AI to Specialized Domains',
    color: 'from-rose-500/20 to-rose-400/5',
    border: 'border-rose-500/30',
    accent: 'text-rose-400',
    badge: 'bg-rose-500/20 text-rose-300',
    topics: ['Domain knowledge graphs', 'RAG for vertical data', 'MCP for domain tools', 'AI DNA Framework'],
    description: 'For teams building domain intelligence platforms. Connects AI systems architecture to the AI DNA Framework.',
  },
];

const INTEREST_OPTIONS = [
  'Just exploring', 'LLMs & Prompt Engineering', 'Building RAG systems',
  'AI Agents & Orchestration', 'Production AI Architecture',
  'Domain Platform Building', 'AI Evaluation & Safety',
];

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

function LatestSignalDeskStrip() {
  const [entries, setEntries] = useState<SignalEntryType[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchLatestPublished(6, true)
      .then((data) => { setEntries(data); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded || entries.length === 0) return null;

  return (
    <section className="py-16 border-t border-white/[0.05]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="inline-flex items-center gap-2 mb-2 px-3 py-1 rounded-full border border-white/10 bg-white/[0.03] text-xs text-white/45">
              <Newspaper className="w-3 h-3" />
              Signal Desk
            </div>
            <h2 className="text-2xl font-bold text-white">Latest AI news</h2>
            <p className="text-sm text-white/40 mt-1">What changed this week, tagged to the concepts it touches.</p>
          </div>
          <Link to="/signal-desk" className="hidden sm:flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors">
            View all <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {entries.map((entry) => {
            const date = getSourceDate(entry);
            return (
              <Link key={entry.id} to={`/signal-desk/${entry.slug}`} className="group p-4 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.15] transition-all duration-200 flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${TYPE_COLORS[entry.type]}`}>
                    {TYPE_LABELS[entry.type]}
                  </span>
                  <FromTheFieldBadge origin={entry.origin} size="xs" />
                  {date && <span className="text-[10px] text-white/25 ml-auto">{date}</span>}
                </div>
                <h3 className="text-sm font-bold text-white mb-1.5 leading-snug line-clamp-2 group-hover:text-white transition-colors">{entry.title}</h3>
                <p className="text-xs text-white/40 leading-relaxed line-clamp-2 flex-1">{entry.summary}</p>
              </Link>
            );
          })}
        </div>
        <div className="mt-4 text-center sm:hidden">
          <Link to="/signal-desk" className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors">
            View all <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  // Start on the goal picker: it is the easiest way in for someone new.
  const [mode, setMode] = useState<AppMode>('roadmap');
  const [showAllDeepDives, setShowAllDeepDives] = useState(false);
  const [selectedRoadmapId, setSelectedRoadmapId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activePath, setActivePath] = useState<{ id: string; index: number } | null>(null);
  const [progress, setProgress] = useState<Record<string, ProgressStatus>>(loadProgress);
  const [form, setForm] = useState({ name: '', email: '', learning_interest: '' });
  const [formState, setFormState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [formError, setFormError] = useState('');
  const [showCompletion, setShowCompletion] = useState(false);

  const [articleMetas, setArticleMetas] = useState<ArticleMeta[]>([]);

  const [content, setContent] = useState<ContentData>({
    concepts: CONCEPTS,
    edges: EDGES,
    learningPathDefs: LEARNING_PATH_DEFS,
    conceptsMap: Object.fromEntries(CONCEPTS.map((c) => [c.id, c])),
  });

  useEffect(() => {
    setPageMeta({ path: '/' });
  }, []);

  useEffect(() => {
    loadContent().then(setContent);
    getAllArticleMetas().then(setArticleMetas);
  }, []);

  const selectedRoadmap = selectedRoadmapId ? ROADMAPS.find((r) => r.id === selectedRoadmapId) ?? null : null;
  const activePathDef = activePath ? content.learningPathDefs.find((p) => p.id === activePath.id) ?? null : null;
  const currentLessonId = activePathDef ? activePathDef.conceptIds[activePath!.index] ?? null : null;

  const completionSource = activePathDef ?? selectedRoadmap;
  const completionConceptIds = completionSource
    ? ('conceptIds' in completionSource ? completionSource.conceptIds : [])
    : [];
  const completionName = completionSource
    ? ('label' in completionSource ? completionSource.label : '')
    : '';
  const completionTotalMinutes = completionConceptIds.reduce((sum, id) => {
    const c = content.conceptsMap[id];
    return sum + (c?.estimatedMinutes ?? 0);
  }, 0);

  useEffect(() => { saveProgress(progress); }, [progress]);

  const handleSetProgress = (id: string, status: ProgressStatus) => {
    const newProgress = { ...progress, [id]: status };
    setProgress(newProgress);

    if (status === 'completed') {
      if (activePath) {
        const pathDef = content.learningPathDefs.find((p) => p.id === activePath.id);
        if (pathDef) {
          const allDone = pathDef.conceptIds.every((cid) => (cid === id ? true : newProgress[cid] === 'completed'));
          if (allDone) {
            setTimeout(() => setShowCompletion(true), 600);
            return;
          }
          if (pathDef.conceptIds[activePath.index] === id) {
            const nextIdx = activePath.index + 1;
            if (nextIdx < pathDef.conceptIds.length) {
              setTimeout(() => {
                setActivePath((prev) => prev ? { ...prev, index: nextIdx } : null);
                setSelectedId(null);
              }, 700);
            }
          }
        }
      } else if (selectedRoadmap) {
        const allDone = selectedRoadmap.conceptIds.every((cid) => (cid === id ? true : newProgress[cid] === 'completed'));
        if (allDone) {
          setTimeout(() => setShowCompletion(true), 600);
        }
      }
    }
  };

  const handleSelectMode = (m: AppMode) => {
    setMode(m);
    if (m === 'explore') {
      setSelectedRoadmapId(null);
    }
    setActivePath(null);
    setSelectedId(null);
  };

  // Paths open as a series of lesson pages, starting at the first lesson not yet done.
  const handleStartPath = (pathId: string) => {
    navigate(startLessonUrl(pathId, progress));
  };

  const handlePathNavigate = (index: number) => {
    if (!activePath) return;
    setActivePath({ ...activePath, index });
    setSelectedId(null);
  };

  const getNextRecommended = (): (NextStep & { label: string }) | null => {
    if (!selectedRoadmap || !selectedId) return null;
    const nextStep = selectedRoadmap.nextSteps[selectedId];
    if (!nextStep) return null;
    const nextConcept = content.conceptsMap[nextStep.id];
    return nextConcept ? { ...nextStep, label: nextConcept.label } : null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email) return;
    setFormState('loading');
    setFormError('');
    const { error } = await supabase.from('ai_systems_waitlist').insert({
      name: form.name || null,
      email: form.email,
      learning_interest: form.learning_interest || null,
    });
    if (error) {
      setFormState('error');
      setFormError('Something went wrong. Please try again.');
    } else {
      setFormState('success');
      setForm({ name: '', email: '', learning_interest: '' });
    }
  };

  const showRoadmapPanel = mode === 'roadmap' && selectedRoadmap !== null && selectedId === null;
  const roadmapConceptIds = activePathDef
    ? activePathDef.conceptIds
    : (selectedRoadmap ? selectedRoadmap.conceptIds : null);

  return (
    <div className="min-h-screen bg-[#080c14] text-white font-sans antialiased">
      <NavBar />

      {/* HERO + MAP */}
      <section id="system-map" className="pt-14 relative">
        <div className="absolute inset-0 opacity-[0.025] pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

        {/* Hero text */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-4 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight mb-4">
            <span className="text-white">Understand AI.</span>{' '}
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
              Then put it to work.
            </span>
          </h1>
          <p className="max-w-2xl mx-auto text-base sm:text-lg text-white/60 leading-relaxed mb-7">
            Short lessons on the {CONCEPTS.length} ideas behind tools like ChatGPT and Claude, in plain English. No background needed.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
            <button
              onClick={() => handleStartPath('beginner')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-semibold hover:from-blue-400 hover:to-cyan-400 transition-all shadow-lg shadow-blue-500/25"
            >
              <GraduationCap className="w-4 h-4" />
              {progress['llms'] ? 'Continue the basics' : 'Start with the basics'}
            </button>
            <a
              href="#learning-paths"
              onClick={(e) => { e.preventDefault(); document.getElementById('learning-paths')?.scrollIntoView({ behavior: 'smooth' }); }}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-white/15 bg-white/[0.04] text-white/80 text-sm font-semibold hover:bg-white/[0.08] transition-all"
            >
              Choose a learning path <ChevronRight className="w-4 h-4" />
            </a>
          </div>
          <p className="text-sm text-white/50 mb-3">Or start from what you want to build:</p>

          {/* Mode Toggle */}
          <div className="inline-flex items-center gap-1 p-1 rounded-xl border border-white/10 bg-white/[0.04]">
            <button
              onClick={() => handleSelectMode('roadmap')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                mode === 'roadmap'
                  ? 'bg-gradient-to-r from-blue-500/30 to-cyan-500/20 text-white border border-blue-500/30 shadow-sm'
                  : 'text-white/45 hover:text-white/70'
              }`}
            >
              <Map className={`w-3.5 h-3.5 ${mode === 'roadmap' ? 'text-blue-400' : 'text-white/30'}`} />
              Pick a goal
            </button>
            <button
              onClick={() => handleSelectMode('explore')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                mode === 'explore'
                  ? 'bg-white/[0.1] text-white shadow-sm'
                  : 'text-white/45 hover:text-white/70'
              }`}
            >
              <Compass className={`w-3.5 h-3.5 ${mode === 'explore' ? 'text-cyan-400' : 'text-white/30'}`} />
              Explore the whole map
            </button>
          </div>
        </div>

        {/* Goal Selector (roadmap mode, no roadmap selected) */}
        {mode === 'roadmap' && !selectedRoadmap && (
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
            <GoalSelector onSelect={(id) => { setSelectedRoadmapId(id); setSelectedId(null); }} />
          </div>
        )}

        {/* Active roadmap badge */}
        {mode === 'roadmap' && selectedRoadmap && (
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-3 flex items-center justify-center gap-3">
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl border border-blue-500/30 bg-blue-500/[0.08]">
              <Map className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-sm font-semibold text-white">{selectedRoadmap.label}</span>
              <span className="text-xs text-white/35">{selectedRoadmap.conceptIds.length} concepts</span>
              <button
                onClick={() => { setSelectedRoadmapId(null); setSelectedId(null); }}
                className="ml-1 text-white/30 hover:text-white/70 transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5 rotate-90" />
              </button>
            </div>
          </div>
        )}

        {/* Interactive Map */}
        <MobileConceptList />
        <div
          className="relative mx-auto hidden md:block"
          style={{ maxWidth: '1400px', height: 'calc(100vh - 200px)', minHeight: '520px', maxHeight: '760px' }}
        >
          <ConceptMap
            concepts={content.concepts}
            edges={content.edges}
            selectedId={selectedId}
            onSelect={setSelectedId}
            roadmapConceptIds={roadmapConceptIds}
            progress={progress}
            currentLessonId={currentLessonId}
          />
        </div>
      </section>

      {/* Roadmap Panel (right side, behind SidePanel) */}
      {showRoadmapPanel && (
        <RoadmapPanel
          roadmap={selectedRoadmap!}
          conceptsMap={content.conceptsMap}
          progress={progress}
          onSetProgress={handleSetProgress}
          onSelectConcept={(id) => setSelectedId(id)}
          onBack={() => setSelectedRoadmapId(null)}
        />
      )}

      {/* Learning Path Sidebar (right side, behind SidePanel) */}
      {activePathDef && !showRoadmapPanel && (
        <LearningPathSidebar
          path={activePathDef}
          conceptsMap={content.conceptsMap}
          currentIndex={activePath!.index}
          progress={progress}
          onSetProgress={handleSetProgress}
          onNavigate={handlePathNavigate}
          onExit={() => { setActivePath(null); setSelectedId(null); }}
        />
      )}

      {/* Concept Side Panel */}
      <SidePanel
        conceptsMap={content.conceptsMap}
        selectedId={selectedId}
        onClose={() => setSelectedId(null)}
        onNavigate={(id) => setSelectedId(id)}
        progress={progress}
        onSetProgress={handleSetProgress}
        nextRecommended={getNextRecommended()}
        showProgressControls={(mode === 'roadmap' && selectedRoadmap !== null) || activePath !== null}
      />

      {/* LEARNING PATHS */}
      <section id="learning-paths" className="py-20 border-t border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full border border-white/10 bg-white/[0.03] text-xs text-white/45">
              <GraduationCap className="w-3 h-3" />
              Learning Paths
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">Where are you starting?</h2>
            <p className="text-white/50 max-w-lg mx-auto text-sm">Each path is a short series of lessons. Pick the one that sounds like you. Your progress is saved in this browser.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {LEARNING_PATHS.map(({ id, icon: Icon, level, label, color, border, accent, badge, topics, description }, idx) => {
              const pathDef = content.learningPathDefs.find((p) => p.id === id);
              const totalMinutes = pathDef
                ? pathDef.conceptIds.reduce((sum, cid) => sum + (content.conceptsMap[cid]?.estimatedMinutes ?? 0), 0)
                : 0;
              return (
                <button
                  key={id}
                  onClick={() => handleStartPath(id)}
                  className={`group p-6 rounded-2xl border ${border} bg-gradient-to-br ${color} hover:shadow-xl hover:shadow-black/30 transition-all duration-300 text-left relative ${idx < 2 ? 'lg:col-span-3' : 'lg:col-span-2'}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${badge}`}>
                      <Icon className="w-3 h-3" />{level}
                    </div>
                    <ChevronRight className={`w-4 h-4 ${accent} opacity-0 group-hover:opacity-100 transition-opacity`} />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">{label}</h3>
                  <p className="text-sm text-white/45 leading-relaxed mb-4">{description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {topics.map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded-md bg-white/[0.07] border border-white/[0.07] text-xs text-white/55">{t}</span>
                    ))}
                  </div>
                  {pathDef && (() => {
                    const completed = pathDef.conceptIds.filter((cid) => progress[cid] === 'completed').length;
                    const pct = Math.round((completed / pathDef.conceptIds.length) * 100);
                    return (
                      <div className="mt-4 pt-3 border-t border-white/[0.07]">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="flex items-center gap-1 text-xs text-white/45"><Clock className="w-3 h-3" />{pathDef.conceptIds.length} lessons · about {Math.max(1, Math.round(totalMinutes / 5) * 5)} min</span>
                          <span className={`text-xs font-medium ${accent}`}>
                            {pct === 100 ? 'Review →' : pct > 0 ? `${pct}% done · Continue →` : 'Start →'}
                          </span>
                        </div>
                        {pct > 0 && (
                          <div className="h-1 rounded-full bg-white/[0.08] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* DEEP DIVES */}
      <section id="deep-dives" className="py-20 border-t border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full border border-white/10 bg-white/[0.03] text-xs text-white/45">
              <BookOpen className="w-3 h-3" />
              Featured Deep Dives
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">Go deeper on one topic</h2>
            <p className="text-white/50 max-w-lg mx-auto text-sm">5–7 minute guides with a worked example and a short quiz at the end. New to AI? Start with the first three.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(() => {
              const all = sortDeepDives(articleMetas.filter((m) => !m.track));
              return showAllDeepDives ? all : all.slice(0, 6);
            })().map((meta) => {
              const { color, tag } = getCategoryStyle(meta.category);
              return (
                <Link
                  key={meta.slug}
                  to={`/articles/${meta.slug}`}
                  className={`group p-5 rounded-xl border ${color} bg-white/[0.02] hover:bg-white/[0.05] hover:shadow-lg hover:shadow-black/20 transition-all duration-200 flex flex-col`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${tag}`}>{meta.category}</span>
                    <span className="text-[10px] text-white/25">{meta.readTime}</span>
                  </div>
                  <h3 className="text-sm font-bold text-white mb-2 leading-snug">{meta.title}</h3>
                  <p className="text-xs text-white/40 leading-relaxed flex-1">{meta.description}</p>
                  <div className="mt-4 flex items-center gap-1 text-[10px] text-white/25 group-hover:text-white/55 transition-colors">
                    Read article <ChevronRight className="w-2.5 h-2.5" />
                  </div>
                </Link>
              );
            })}
          </div>
          {!showAllDeepDives && articleMetas.filter((m) => !m.track).length > 6 && (
            <div className="mt-6 text-center">
              <button
                onClick={() => setShowAllDeepDives(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/15 bg-white/[0.04] text-sm text-white/70 hover:text-white hover:bg-white/[0.08] transition-all"
              >
                Show all {articleMetas.filter((m) => !m.track).length} deep dives <ChevronRight className="w-3.5 h-3.5 rotate-90" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* DOMAIN TRACK */}
      <section id="domain-track" className="py-20 border-t border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full border border-rose-500/20 bg-rose-500/[0.06] text-xs text-rose-300">
              <Building2 className="w-3 h-3" />
              Domain Platform Builder Track
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">Build a domain intelligence platform</h2>
            <p className="text-white/40 max-w-lg mx-auto text-sm">A four-part series taking you from the platform concept through knowledge graphs, vertical RAG, and domain tools.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DOMAIN_TRACK_ORDER.map((slug, idx) => {
              const meta = articleMetas.find((m) => m.slug === slug);
              if (!meta) return null;
              const { color, tag } = getCategoryStyle(meta.category);
              return (
                <Link
                  key={slug}
                  to={`/articles/${slug}`}
                  className={`group p-6 rounded-xl border ${color} bg-white/[0.02] hover:bg-white/[0.05] hover:shadow-lg hover:shadow-black/20 transition-all duration-200 flex items-start gap-4`}
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg border border-rose-500/30 bg-rose-500/10 flex items-center justify-center text-sm font-bold text-rose-300">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${tag}`}>{meta.category}</span>
                      <span className="text-[10px] text-white/25">{meta.readTime}</span>
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1.5 leading-snug">{meta.title}</h3>
                    <p className="text-xs text-white/40 leading-relaxed">{meta.description}</p>
                    <div className="mt-3 flex items-center gap-1 text-[10px] text-white/25 group-hover:text-white/55 transition-colors">
                      Read article <ChevronRight className="w-2.5 h-2.5" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* LATEST FROM SIGNAL DESK */}
      <LatestSignalDeskStrip />

      {/* AI DNA CALLOUT */}
      <section id="ai-dna" className="py-16 border-t border-white/[0.05]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/[0.07] to-cyan-500/[0.03] p-8 lg:p-12 text-center">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full border border-blue-500/25 bg-blue-500/10 text-xs text-blue-300">
              Two layers. One framework.
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">Part of Clarent's AI DNA framework</h2>
            <p className="text-white/50 text-sm leading-relaxed max-w-xl mx-auto mb-3">
              <span className="text-white font-semibold">AI DNA</span> is the framework for building domain intelligence platforms — the strategic architecture connecting knowledge, data, and AI to a specific industry or problem.
            </p>
            <p className="text-white/50 text-sm leading-relaxed max-w-xl mx-auto mb-8">
              <span className="text-white font-semibold">AI Systems DNA</span> is the technical knowledge base explaining the AI components underneath — the LLMs, retrieval systems, agents, and orchestration patterns that make domain intelligence possible.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04]">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                  <Brain className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-[9px] text-white/35">Strategic layer</div>
                  <div className="text-xs font-semibold text-white">AI DNA Framework</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-white/20 rotate-90 sm:rotate-0" />
              <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.06]">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-400 flex items-center justify-center">
                  <Compass className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-[9px] text-white/35">Technical layer</div>
                  <div className="text-xs font-semibold text-white">AI Systems DNA</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* WAITLIST */}
      <section id="waitlist" className="py-20 border-t border-white/[0.05]">
        <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full border border-white/10 bg-white/[0.03] text-xs text-white/45">
              <Zap className="w-3 h-3" />
              Stay in the Loop
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">Get updates as we build</h2>
            <p className="text-white/40 text-sm leading-relaxed">New concept guides, deep dives, and learning paths — delivered as we ship them.</p>
          </div>

          {formState === 'success' ? (
            <div className="p-7 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.07] text-center">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/25 flex items-center justify-center mx-auto mb-3">
                <Zap className="w-4 h-4 text-emerald-400" />
              </div>
              <h3 className="text-base font-bold text-white mb-1.5">You're on the list</h3>
              <p className="text-sm text-white/45">We'll reach out as new content and features go live.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-white/45 mb-1.5">Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" className="w-full px-4 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.07] transition-all" />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/45 mb-1.5">Email <span className="text-white/25">(required)</span></label>
                <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" className="w-full px-4 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.07] transition-all" />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/45 mb-1.5">What are you most interested in learning?</label>
                <select value={form.learning_interest} onChange={(e) => setForm({ ...form, learning_interest: e.target.value })} className="w-full px-4 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all appearance-none">
                  <option value="" className="bg-[#0f1523] text-white/40">Select an area...</option>
                  {INTEREST_OPTIONS.map((o) => <option key={o} value={o} className="bg-[#0f1523] text-white">{o}</option>)}
                </select>
              </div>
              {formError && <p className="text-xs text-red-400">{formError}</p>}
              <button type="submit" disabled={formState === 'loading'} className="w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold text-sm hover:from-blue-400 hover:to-cyan-400 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/20">
                {formState === 'loading' ? 'Submitting...' : 'Get Updates'}
              </button>
              <p className="text-center text-xs text-white/20">No spam. Unsubscribe any time. See our <Link to="/privacy" className="text-cyan-400/60 hover:text-cyan-300 transition-colors">Privacy Policy</Link>.</p>
            </form>
          )}
        </div>
      </section>

      {/* Completion Screen */}
      {showCompletion && (
        <CompletionScreen
          pathName={completionName}
          conceptCount={completionConceptIds.length}
          totalMinutes={completionTotalMinutes}
          onExplore={() => {
            setShowCompletion(false);
            setActivePath(null);
            setSelectedRoadmapId(null);
            setMode('explore');
          }}
          onRestart={() => {
            setShowCompletion(false);
            setActivePath(null);
            setSelectedRoadmapId(null);
            setMode('explore');
            document.getElementById('learning-paths')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
      )}

      {/* FOOTER */}
      <footer className="border-t border-white/[0.05] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <Compass className="w-3 h-3 text-white" />
            </div>
            <a href="https://www.clarenttechnologies.com/" target="_blank" rel="noopener noreferrer" className="text-xs text-white/35 hover:text-white/60 transition-colors">
              AI Systems DNA · A Clarent Technologies product
            </a>
          </div>
          <div className="flex items-center gap-4 flex-wrap justify-center">
            {[
              { label: 'Learning Paths', href: '/#learning-paths' },
              { label: 'Deep Dives', href: '/#deep-dives' },
              { label: 'Labs', href: '/labs' },
              { label: 'System Map', href: '/#system-map' },
              { label: 'Signal Desk', href: '/signal-desk' },
              { label: 'AI DNA', href: '/#ai-dna' },
              { label: 'Contact', href: '/contact' },
              { label: 'Privacy', href: '/privacy' },
            ].map((l) => (
              <Link
                key={l.label}
                to={l.href}
                onClick={(e) => {
                  if (l.href.startsWith('/#')) {
                    e.preventDefault();
                    const hash = l.href.slice(1);
                    if (window.location.pathname === '/') {
                      document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' });
                    } else {
                      window.location.href = l.href;
                    }
                  }
                }}
                className="text-xs text-white/25 hover:text-white/60 transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-5 pt-5 border-t border-white/[0.04] text-center text-xs text-white/15">
          © {new Date().getFullYear()} Clarent. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
