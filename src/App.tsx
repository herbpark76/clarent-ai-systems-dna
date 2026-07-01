import { useState, useEffect } from 'react';
import {
  Network, Menu, X, ChevronRight, ArrowRight,
  BookOpen, GraduationCap, Wrench, Layers, Building2,
  Zap, BarChart2, Brain, Search, Bot,
  Map, Compass,
} from 'lucide-react';
import { supabase } from './lib/supabase';
import { loadContent, type ContentData } from './lib/contentService';
import ConceptMap from './components/ConceptMap';
import SidePanel from './components/SidePanel';
import RoadmapPanel from './components/RoadmapPanel';
import GoalSelector from './components/GoalSelector';
import LearningPathSidebar from './components/LearningPathSidebar';
import CompletionScreen from './components/CompletionScreen';
import { CONCEPTS, EDGES } from './data/concepts';
import { ROADMAPS, type ProgressStatus, type NextStep } from './data/roadmaps';
import { LEARNING_PATH_DEFS } from './data/learningPaths';

type AppMode = 'explore' | 'roadmap';

const NAV_LINKS = [
  { label: 'System Map', href: '#system-map' },
  { label: 'Learning Paths', href: '#learning-paths' },
  { label: 'Deep Dives', href: '#deep-dives' },
  { label: 'AI DNA', href: '#ai-dna' },
  { label: 'Contact', href: '#waitlist' },
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
    topics: ['What is an LLM?', 'How AI reads text', 'Intro to RAG', 'Prompt basics'],
    description: 'No background required. Understand what these systems are, why they matter, and how the pieces fit together.',
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

const DEEP_DIVES = [
  { title: 'What is RAG?', category: 'Retrieval', color: 'border-emerald-500/30', tag: 'bg-emerald-500/15 text-emerald-300', description: 'A complete guide to Retrieval-Augmented Generation — how it works, why it matters, and when to use it over fine-tuning.', readTime: '8 min read' },
  { title: 'What is MCP?', category: 'Protocols', color: 'border-orange-500/30', tag: 'bg-orange-500/15 text-orange-300', description: 'Model Context Protocol explained — the emerging standard that lets AI agents connect to any tool or data source.', readTime: '6 min read' },
  { title: 'What are AI Agents?', category: 'Agents', color: 'border-yellow-500/30', tag: 'bg-yellow-500/15 text-yellow-300', description: 'How agents plan, reason, and act — breaking down the loop from goal to tool call to response.', readTime: '10 min read' },
  { title: 'Vector DBs vs Knowledge Graphs', category: 'Data', color: 'border-teal-500/30', tag: 'bg-teal-500/15 text-teal-300', description: 'Two powerful ways to organize knowledge for AI. Understand the tradeoffs and when each architecture wins.', readTime: '9 min read' },
  { title: 'How Tool Calling Works', category: 'Integration', color: 'border-red-500/30', tag: 'bg-red-500/15 text-red-300', description: 'A deep look at how LLMs invoke external functions — the mechanism behind every AI-powered integration.', readTime: '7 min read' },
  { title: 'How to Evaluate AI Systems', category: 'Evaluation', color: 'border-sky-500/30', tag: 'bg-sky-500/15 text-sky-300', description: 'Practical frameworks for measuring accuracy, relevance, faithfulness, and safety in production AI systems.', readTime: '11 min read' },
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

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mode, setMode] = useState<AppMode>('explore');
  const [selectedRoadmapId, setSelectedRoadmapId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activePath, setActivePath] = useState<{ id: string; index: number } | null>(null);
  const [progress, setProgress] = useState<Record<string, ProgressStatus>>(loadProgress);
  const [form, setForm] = useState({ name: '', email: '', learning_interest: '' });
  const [formState, setFormState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [formError, setFormError] = useState('');
  const [showCompletion, setShowCompletion] = useState(false);

  // Content loaded from Supabase (hardcoded data used as initial/fallback)
  const [content, setContent] = useState<ContentData>({
    concepts: CONCEPTS,
    edges: EDGES,
    learningPathDefs: LEARNING_PATH_DEFS,
    conceptsMap: Object.fromEntries(CONCEPTS.map((c) => [c.id, c])),
  });

  useEffect(() => {
    loadContent().then(setContent);
  }, []);

  const selectedRoadmap = selectedRoadmapId ? ROADMAPS.find((r) => r.id === selectedRoadmapId) ?? null : null;
  const activePathDef = activePath ? content.learningPathDefs.find((p) => p.id === activePath.id) ?? null : null;
  const currentLessonId = activePathDef ? activePathDef.conceptIds[activePath!.index] ?? null : null;

  // Completion screen data
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

  // Persist progress
  useEffect(() => { saveProgress(progress); }, [progress]);

  const handleSetProgress = (id: string, status: ProgressStatus) => {
    const newProgress = { ...progress, [id]: status };
    setProgress(newProgress);

    // Check if active path or roadmap is now fully completed
    if (status === 'completed') {
      if (activePath) {
        const pathDef = content.learningPathDefs.find((p) => p.id === activePath.id);
        if (pathDef) {
          const allDone = pathDef.conceptIds.every((cid) => (cid === id ? true : newProgress[cid] === 'completed'));
          if (allDone) {
            setTimeout(() => setShowCompletion(true), 600);
            return;
          }
          // Auto-advance to next lesson
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

  const handleActivateLearningPath = (pathId: string) => {
    const def = content.learningPathDefs.find((p) => p.id === pathId);
    if (!def) return;
    setActivePath({ id: pathId, index: 0 });
    setSelectedId(null);
    // Switch to explore mode so roadmap panel doesn't compete
    setMode('explore');
    setSelectedRoadmapId(null);
    setTimeout(() => {
      document.getElementById('system-map')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  const handlePathNavigate = (index: number) => {
    if (!activePath) return;
    setActivePath({ ...activePath, index });
    setSelectedId(null);
  };

  // Compute next recommended step for current selected concept in roadmap mode
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
  // Learning path active concept IDs take priority over roadmap mode
  const roadmapConceptIds = activePathDef
    ? activePathDef.conceptIds
    : (selectedRoadmap ? selectedRoadmap.conceptIds : null);

  return (
    <div className="min-h-screen bg-[#080c14] text-white font-sans antialiased">
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] bg-[#080c14]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400">
                <Network className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <span className="text-sm font-semibold text-white">AI Systems DNA</span>
                <span className="hidden sm:block text-[9px] text-white/35 leading-none -mt-0.5">Clarent · AI DNA Framework</span>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-0.5">
              {NAV_LINKS.map((l) => (
                <a key={l.label} href={l.href} className="px-3 py-1.5 text-xs text-white/55 hover:text-white rounded-md hover:bg-white/[0.05] transition-all">
                  {l.label}
                </a>
              ))}
              <a href="#waitlist" className="ml-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-semibold hover:from-blue-400 hover:to-cyan-400 transition-all">
                Get Updates
              </a>
            </div>
            <button className="md:hidden p-2 text-white/50 hover:text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/[0.06] bg-[#080c14] px-4 py-3 flex flex-col gap-1">
            {NAV_LINKS.map((l) => (
              <a key={l.label} href={l.href} onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 text-sm text-white/55 hover:text-white rounded-md hover:bg-white/[0.05] transition-all">
                {l.label}
              </a>
            ))}
          </div>
        )}
      </nav>

      {/* HERO + MAP */}
      <section id="system-map" className="pt-14 relative">
        <div className="absolute inset-0 opacity-[0.025] pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

        {/* Hero text */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-4 text-center">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full border border-white/10 bg-white/[0.04] text-[10px] text-white/45 tracking-wide">
            <span>Clarent</span>
            <ChevronRight className="w-2.5 h-2.5" />
            <span>AI DNA Framework</span>
            <ChevronRight className="w-2.5 h-2.5" />
            <span className="text-white/70">AI Systems DNA</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight mb-3">
            <span className="text-white">Learn How Modern</span>{' '}
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
              AI Systems Are Built
            </span>
          </h1>
          <p className="max-w-2xl mx-auto text-base text-white/45 leading-relaxed mb-6">
            An interactive map of the 25 core concepts behind production AI — from LLMs and RAG to agents, MCP, evaluation, and orchestration.
          </p>

          {/* Mode Toggle */}
          <div className="inline-flex items-center gap-1 p-1 rounded-xl border border-white/10 bg-white/[0.04]">
            <button
              onClick={() => handleSelectMode('explore')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                mode === 'explore'
                  ? 'bg-white/[0.1] text-white shadow-sm'
                  : 'text-white/45 hover:text-white/70'
              }`}
            >
              <Compass className={`w-3.5 h-3.5 ${mode === 'explore' ? 'text-cyan-400' : 'text-white/30'}`} />
              Explore
            </button>
            <button
              onClick={() => handleSelectMode('roadmap')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                mode === 'roadmap'
                  ? 'bg-gradient-to-r from-blue-500/30 to-cyan-500/20 text-white border border-blue-500/30 shadow-sm'
                  : 'text-white/45 hover:text-white/70'
              }`}
            >
              <Map className={`w-3.5 h-3.5 ${mode === 'roadmap' ? 'text-blue-400' : 'text-white/30'}`} />
              Roadmap
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
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Interactive Map */}
        <div
          className="relative mx-auto"
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

      {/* QUICK CONCEPT TILES */}
      <section className="py-16 border-t border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-white mb-2">Key Concept Areas</h2>
            <p className="text-white/40 text-sm">Jump directly into any cluster from the map</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Brain, label: 'Foundation', sub: 'LLMs, Tokens, Embeddings, Prompts', color: 'border-blue-500/30 bg-blue-500/[0.07]', ic: 'text-blue-400', id: 'llms' },
              { icon: Search, label: 'Knowledge', sub: 'RAG, Vector DBs, Chunking, Search', color: 'border-emerald-500/30 bg-emerald-500/[0.07]', ic: 'text-emerald-400', id: 'rag' },
              { icon: Bot, label: 'Intelligence', sub: 'Agents, MCP, Memory, Planning', color: 'border-amber-500/30 bg-amber-500/[0.07]', ic: 'text-amber-400', id: 'agents' },
              { icon: BarChart2, label: 'Production', sub: 'APIs, Orchestration, Security', color: 'border-rose-500/30 bg-rose-500/[0.07]', ic: 'text-rose-400', id: 'deployment' },
            ].map(({ icon: Icon, label, sub, color, ic, id }) => (
              <button
                key={label}
                onClick={() => { setSelectedId(id); document.getElementById('system-map')?.scrollIntoView({ behavior: 'smooth' }); }}
                className={`p-4 rounded-xl border ${color} hover:scale-[1.02] transition-all duration-200 text-left group`}
              >
                <Icon className={`w-5 h-5 ${ic} mb-2`} />
                <div className="text-sm font-semibold text-white">{label}</div>
                <div className="text-xs text-white/40 mt-0.5 leading-relaxed">{sub}</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* LEARNING PATHS */}
      <section id="learning-paths" className="py-20 border-t border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full border border-white/10 bg-white/[0.03] text-xs text-white/45">
              <GraduationCap className="w-3 h-3" />
              Learning Paths
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">Learn at your level</h2>
            <p className="text-white/40 max-w-md mx-auto text-sm">Four structured paths — click any card to activate it on the map and start learning.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {LEARNING_PATHS.map(({ id, icon: Icon, level, label, color, border, accent, badge, topics, description }) => {
              const isActive = activePath?.id === id;
              const pathDef = content.learningPathDefs.find((p) => p.id === id);
              return (
                <button
                  key={id}
                  onClick={() => handleActivateLearningPath(id)}
                  className={`group p-6 rounded-2xl border ${isActive ? border.replace('/30', '/60') : border} bg-gradient-to-br ${color} hover:shadow-xl hover:shadow-black/30 transition-all duration-300 text-left relative ${isActive ? 'ring-1 ring-white/20' : ''}`}
                >
                  {isActive && (
                    <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-white/15 border border-white/20 text-[9px] font-semibold text-white/70 uppercase tracking-wide">
                      Active
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-3">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${badge}`}>
                      <Icon className="w-3 h-3" />{level}
                    </div>
                    {!isActive && <ChevronRight className={`w-4 h-4 ${accent} opacity-0 group-hover:opacity-100 transition-opacity`} />}
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">{label}</h3>
                  <p className="text-sm text-white/45 leading-relaxed mb-4">{description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {topics.map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded-md bg-white/[0.07] border border-white/[0.07] text-xs text-white/55">{t}</span>
                    ))}
                  </div>
                  {pathDef && (
                    <div className="mt-4 pt-3 border-t border-white/[0.07] flex items-center justify-between">
                      <span className="text-xs text-white/30">{pathDef.conceptIds.length} concepts</span>
                      <span className={`text-xs font-medium ${accent}`}>
                        {isActive ? 'In progress →' : 'Start path →'}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* AI DNA CALLOUT */}
      <section id="ai-dna" className="py-16 border-t border-white/[0.05]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/[0.07] to-cyan-500/[0.03] p-8 lg:p-12 text-center">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full border border-blue-500/25 bg-blue-500/10 text-xs text-blue-300">
              Two layers. One framework.
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">How This Connects to AI DNA</h2>
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
                  <Network className="w-3.5 h-3.5 text-white" />
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

      {/* DEEP DIVES */}
      <section id="deep-dives" className="py-20 border-t border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full border border-white/10 bg-white/[0.03] text-xs text-white/45">
              <BookOpen className="w-3 h-3" />
              Featured Deep Dives
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">Go deeper on what matters</h2>
            <p className="text-white/40 max-w-md mx-auto text-sm">Long-form technical guides written for engineers who want to actually understand how things work.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {DEEP_DIVES.map(({ title, category, color, tag, description, readTime }) => (
              <article key={title} className={`group p-5 rounded-xl border ${color} bg-white/[0.02] hover:bg-white/[0.05] hover:shadow-lg hover:shadow-black/20 transition-all duration-200 cursor-pointer flex flex-col`}>
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${tag}`}>{category}</span>
                  <span className="text-[10px] text-white/25">{readTime}</span>
                </div>
                <h3 className="text-sm font-bold text-white mb-2 leading-snug">{title}</h3>
                <p className="text-xs text-white/40 leading-relaxed flex-1">{description}</p>
                <div className="mt-4 flex items-center gap-1 text-[10px] text-white/25 group-hover:text-white/55 transition-colors">
                  Read article <ChevronRight className="w-2.5 h-2.5" />
                </div>
              </article>
            ))}
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
              <p className="text-center text-xs text-white/20">No spam. Unsubscribe any time.</p>
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
              <Network className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs text-white/35">AI Systems DNA · A Clarent · AI DNA Framework product</span>
          </div>
          <div className="flex items-center gap-4">
            {NAV_LINKS.map((l) => (
              <a key={l.label} href={l.href} className="text-xs text-white/25 hover:text-white/60 transition-colors">{l.label}</a>
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
