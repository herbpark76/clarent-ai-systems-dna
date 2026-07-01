import { X, ChevronRight, ArrowRight, AlertTriangle, Lightbulb, ArrowUpRight } from 'lucide-react';
import { CONCEPTS, CLUSTER_META } from '../data/concepts';
import type { ProgressStatus, NextStep } from '../data/roadmaps';

interface Props {
  selectedId: string | null;
  onClose: () => void;
  onNavigate: (id: string) => void;
  progress: Record<string, ProgressStatus>;
  onSetProgress: (id: string, status: ProgressStatus) => void;
  nextRecommended: (NextStep & { label: string }) | null;
  showProgressControls: boolean;
}

const PROGRESS_LABELS: Record<ProgressStatus, string> = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  'completed': 'Completed',
};

const PROGRESS_STYLES: Record<ProgressStatus, { active: string; dot: string }> = {
  'not-started': {
    active: 'border-white/20 bg-white/[0.08] text-white/70',
    dot: 'bg-white/30',
  },
  'in-progress': {
    active: 'border-amber-500/50 bg-amber-500/15 text-amber-300',
    dot: 'bg-amber-400',
  },
  'completed': {
    active: 'border-green-500/50 bg-green-500/15 text-green-300',
    dot: 'bg-green-400',
  },
};

export default function SidePanel({ selectedId, onClose, onNavigate, progress, onSetProgress, nextRecommended, showProgressControls }: Props) {
  const concept = selectedId ? CONCEPTS.find((c) => c.id === selectedId) ?? null : null;
  const meta = concept ? CLUSTER_META[concept.cluster] : null;
  const currentProgress = concept ? (progress[concept.id] ?? 'not-started') : 'not-started';

  const getLabel = (id: string) => CONCEPTS.find((c) => c.id === id)?.label ?? id;

  return (
    <div
      className="fixed top-0 right-0 h-full z-50 flex flex-col overflow-hidden"
      style={{
        width: 'clamp(300px, 28vw, 400px)',
        background: 'rgba(8,12,20,0.98)',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        transform: concept ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {concept && meta ? (
        <>
          {/* Header */}
          <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-white/[0.07]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide mb-2"
                  style={{ background: `${meta.glow}22`, color: meta.stroke, border: `1px solid ${meta.glow}44` }}
                >
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: meta.stroke }} />
                  {CLUSTER_META[concept.cluster].label}
                </div>
                <h2 className="text-xl font-bold text-white leading-tight">{concept.label}</h2>
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/[0.08] transition-all mt-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>

            {/* Progress tracker (roadmap or learning path mode) */}
            {showProgressControls && (
              <div>
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
                        onClick={() => onSetProgress(concept.id, status)}
                        className={`flex-1 flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium border transition-all ${isActive ? styles.active : 'border-white/[0.08] bg-white/[0.03] text-white/35 hover:text-white/60 hover:bg-white/[0.06]'}`}
                      >
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? styles.dot : 'bg-white/20'}`} />
                        <span className="truncate">{PROGRESS_LABELS[status]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <p className="text-sm text-white/65 leading-relaxed">{concept.description}</p>
            </div>

            {/* Why It Matters */}
            <div
              className="p-3.5 rounded-xl"
              style={{ background: `${meta.glow}10`, border: `1px solid ${meta.glow}25` }}
            >
              <div className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: meta.stroke }}>
                Why It Matters
              </div>
              <p className="text-sm text-white/60 leading-relaxed">{concept.whyItMatters}</p>
            </div>

            {/* Why Should I Care */}
            <div className="p-3.5 rounded-xl border border-white/[0.07] bg-white/[0.03]">
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb className="w-3 h-3 text-yellow-400" />
                <div className="text-[10px] font-semibold uppercase tracking-widest text-yellow-400/80">
                  Why Should I Care?
                </div>
              </div>
              <p className="text-sm text-white/60 leading-relaxed">{concept.whyShouldICare}</p>
            </div>

            {/* Common Mistakes */}
            <div>
              <div className="flex items-center gap-1.5 mb-2.5">
                <AlertTriangle className="w-3 h-3 text-orange-400/70" />
                <div className="text-[10px] font-semibold uppercase tracking-widest text-white/35">
                  Common Mistakes
                </div>
              </div>
              <div className="space-y-1.5">
                {concept.commonMistakes.map((mistake, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full bg-orange-400/50 mt-2 flex-shrink-0" />
                    <p className="text-xs text-white/50 leading-relaxed">{mistake}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Next Recommended Step (roadmap mode only) */}
            {showProgressControls && nextRecommended && (
              <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07]">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400/80 mb-2">
                  Next Recommended Step
                </div>
                <button
                  onClick={() => onNavigate(nextRecommended.id)}
                  className="w-full flex items-center justify-between gap-2 mb-2 group"
                >
                  <span className="text-sm font-semibold text-emerald-300 group-hover:text-emerald-200 transition-colors">
                    {nextRecommended.label}
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400/60 group-hover:text-emerald-300 flex-shrink-0 transition-colors" />
                </button>
                <p className="text-xs text-white/45 leading-relaxed italic">"{nextRecommended.reason}"</p>
              </div>
            )}

            {/* Prerequisites */}
            {concept.prerequisites.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-white/35 mb-2">
                  Requires Understanding
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {concept.prerequisites.map((id) => {
                    const prereqMeta = CLUSTER_META[CONCEPTS.find((c) => c.id === id)?.cluster ?? 'foundation'];
                    return (
                      <button
                        key={id}
                        onClick={() => onNavigate(id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all hover:scale-105"
                        style={{ background: `${prereqMeta.glow}15`, border: `1px solid ${prereqMeta.glow}35`, color: prereqMeta.stroke }}
                      >
                        {getLabel(id)}
                        <ChevronRight className="w-2.5 h-2.5 opacity-60" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Unlocks Next */}
            {concept.unlocksNext.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-white/35 mb-2">
                  Unlocks Next
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {concept.unlocksNext.map((id) => {
                    const nextMeta = CLUSTER_META[CONCEPTS.find((c) => c.id === id)?.cluster ?? 'foundation'];
                    return (
                      <button
                        key={id}
                        onClick={() => onNavigate(id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all hover:scale-105"
                        style={{ background: `${nextMeta.glow}15`, border: `1px solid ${nextMeta.glow}35`, color: nextMeta.stroke }}
                      >
                        <ArrowRight className="w-2.5 h-2.5 opacity-60" />
                        {getLabel(id)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Related tech */}
            <div>
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
          </div>

          {/* Footer hint */}
          {concept.highlightGroup.length > 0 && (
            <div className="flex-shrink-0 px-5 py-3 border-t border-white/[0.07]">
              <p className="text-[10px] text-white/25 leading-relaxed">
                {concept.highlightGroup.length} related concept{concept.highlightGroup.length !== 1 ? 's' : ''} highlighted on the map
              </p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
