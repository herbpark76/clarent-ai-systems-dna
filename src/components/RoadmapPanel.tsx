import { Clock, BarChart2, ChevronRight, RotateCcw, ArrowDown } from 'lucide-react';
import type { Roadmap, ProgressStatus } from '../data/roadmaps';
import { CONCEPTS, CLUSTER_META } from '../data/concepts';

interface Props {
  roadmap: Roadmap;
  progress: Record<string, ProgressStatus>;
  onSetProgress: (id: string, status: ProgressStatus) => void;
  onSelectConcept: (id: string) => void;
  onBack: () => void;
}

const DIFFICULTY_STYLES = {
  Beginner: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  Intermediate: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  Advanced: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

const STATUS_ICON: Record<ProgressStatus, { icon: string; style: string }> = {
  'not-started': { icon: '○', style: 'text-white/25' },
  'in-progress': { icon: '◐', style: 'text-amber-400' },
  'completed': { icon: '✓', style: 'text-green-400' },
};

export default function RoadmapPanel({ roadmap, progress, onSetProgress, onSelectConcept, onBack }: Props) {
  const completedCount = roadmap.conceptIds.filter((id) => progress[id] === 'completed').length;
  const inProgressCount = roadmap.conceptIds.filter((id) => progress[id] === 'in-progress').length;
  const total = roadmap.conceptIds.length;
  const progressPct = Math.round((completedCount / total) * 100);

  const getConcept = (id: string) => CONCEPTS.find((c) => c.id === id);

  function cycleProgress(id: string) {
    const current = progress[id] ?? 'not-started';
    const next: ProgressStatus =
      current === 'not-started' ? 'in-progress'
      : current === 'in-progress' ? 'completed'
      : 'not-started';
    onSetProgress(id, next);
  }

  return (
    <div
      className="fixed top-0 right-0 h-full z-40 flex flex-col overflow-hidden"
      style={{
        width: 'clamp(300px, 30vw, 420px)',
        background: 'rgba(8,12,20,0.98)',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-14 pb-4 border-b border-white/[0.07]">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/70 transition-colors mb-3 group"
        >
          <RotateCcw className="w-3 h-3 group-hover:rotate-[-45deg] transition-transform" />
          Change goal
        </button>
        <h2 className="text-base font-bold text-white leading-snug mb-2">{roadmap.label}</h2>
        <p className="text-xs text-white/45 leading-relaxed mb-4">{roadmap.description}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/[0.08] bg-white/[0.04]">
            <Clock className="w-3 h-3 text-white/40" />
            <span className="text-xs text-white/55">{roadmap.estimatedHours}</span>
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${DIFFICULTY_STYLES[roadmap.difficulty]}`}>
            <BarChart2 className="w-3 h-3" />
            {roadmap.difficulty}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex-shrink-0 px-5 py-3 border-b border-white/[0.05]">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/35">Progress</span>
          <span className="text-xs text-white/50">
            <span className="text-white font-semibold">{completedCount}</span>/{total} complete
            {inProgressCount > 0 && <span className="text-amber-400 ml-1">· {inProgressCount} in progress</span>}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {progressPct === 100 && (
          <p className="text-xs text-green-400 mt-1.5 font-medium">Roadmap complete!</p>
        )}
      </div>

      {/* Concept list */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
        <div className="px-5 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-white/35 mb-3">
            Concepts · {total} total
          </div>
          <div className="space-y-1.5">
            {roadmap.conceptIds.map((id, i) => {
              const concept = getConcept(id);
              if (!concept) return null;
              const meta = CLUSTER_META[concept.cluster];
              const status = progress[id] ?? 'not-started';
              const statusInfo = STATUS_ICON[status];

              return (
                <div key={id} className="flex items-center gap-2.5 group">
                  {/* Step number */}
                  <div className="w-5 flex-shrink-0 text-right text-[10px] text-white/20 font-mono">{i + 1}</div>

                  {/* Progress toggle */}
                  <button
                    onClick={() => cycleProgress(id)}
                    className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-sm font-bold transition-all hover:scale-110 ${statusInfo.style}`}
                    title="Click to cycle progress"
                  >
                    {statusInfo.icon}
                  </button>

                  {/* Concept button */}
                  <button
                    onClick={() => onSelectConcept(id)}
                    className="flex-1 flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/[0.12] transition-all text-left group/btn"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: meta.stroke, opacity: 0.8 }} />
                      <span
                        className="text-xs font-medium truncate transition-colors"
                        style={{ color: status === 'completed' ? '#4ade80' : status === 'in-progress' ? '#fbbf24' : 'rgba(255,255,255,0.75)' }}
                      >
                        {concept.label}
                      </span>
                    </div>
                    <ChevronRight className="w-3 h-3 text-white/20 group-hover/btn:text-white/50 flex-shrink-0 transition-colors" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Architecture pipeline */}
        <div className="px-5 py-4 mt-2 border-t border-white/[0.05]">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-white/35 mb-4">
            Architecture You'll Build
          </div>
          <div className="flex flex-col items-center gap-0">
            {roadmap.pipeline.map((step, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="px-4 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] text-xs text-white/65 font-medium min-w-[140px] text-center">
                  {step}
                </div>
                {i < roadmap.pipeline.length - 1 && (
                  <ArrowDown className="w-3 h-3 text-white/15 my-1" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Reset progress */}
        <div className="px-5 pb-6">
          <button
            onClick={() => {
              roadmap.conceptIds.forEach((id) => onSetProgress(id, 'not-started'));
            }}
            className="flex items-center gap-1.5 text-xs text-white/20 hover:text-white/50 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset all progress
          </button>
        </div>
      </div>
    </div>
  );
}
