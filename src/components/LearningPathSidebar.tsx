import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { LearningPathDef } from '../data/learningPaths';
import { CONCEPTS, CLUSTER_META } from '../data/concepts';

interface Props {
  path: LearningPathDef;
  currentIndex: number;
  onNavigate: (index: number) => void;
  onExit: () => void;
}

export default function LearningPathSidebar({ path, currentIndex, onNavigate, onExit }: Props) {
  const total = path.conceptIds.length;
  const currentId = path.conceptIds[currentIndex];
  const currentConcept = CONCEPTS.find((c) => c.id === currentId);
  const currentMeta = currentConcept ? CLUSTER_META[currentConcept.cluster] : null;

  const canPrev = currentIndex > 0;
  const canNext = currentIndex < total - 1;

  return (
    <div
      className="fixed top-0 right-0 h-full z-40 flex flex-col"
      style={{
        width: 'clamp(280px, 26vw, 360px)',
        background: 'rgba(8,12,20,0.98)',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-14 pb-4 border-b border-white/[0.07]">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${path.badge} mb-2`}>
              {path.level}
            </span>
            <h2 className="text-sm font-bold text-white leading-snug">{path.label}</h2>
            <p className="text-xs text-white/35 mt-1 leading-relaxed line-clamp-2">{path.description}</p>
          </div>
          <button
            onClick={onExit}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-white/35 hover:text-white hover:bg-white/[0.08] transition-all mt-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Lesson navigation */}
      <div className="flex-shrink-0 px-5 py-4 border-b border-white/[0.05]">
        <div className="text-center mb-3">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-1">
            Lesson {currentIndex + 1} of {total}
          </div>
          {currentConcept && currentMeta && (
            <div
              className="text-lg font-bold leading-tight"
              style={{ color: currentMeta.stroke }}
            >
              {currentConcept.label}
            </div>
          )}
        </div>

        {/* Prev / Next buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => canPrev && onNavigate(currentIndex - 1)}
            disabled={!canPrev}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-xs font-medium text-white/50 hover:text-white hover:bg-white/[0.08] disabled:opacity-25 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Prev
          </button>

          {/* Progress dots */}
          <div className="flex items-center gap-1 justify-center flex-wrap max-w-[80px]">
            {path.conceptIds.map((_, i) => (
              <button
                key={i}
                onClick={() => onNavigate(i)}
                className="transition-all duration-200"
                style={{
                  width: i === currentIndex ? 14 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: i === currentIndex
                    ? (currentMeta?.stroke ?? '#60a5fa')
                    : i < currentIndex
                    ? 'rgba(255,255,255,0.35)'
                    : 'rgba(255,255,255,0.12)',
                }}
              />
            ))}
          </div>

          <button
            onClick={() => canNext && onNavigate(currentIndex + 1)}
            disabled={!canNext}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-xs font-medium text-white/50 hover:text-white hover:bg-white/[0.08] disabled:opacity-25 disabled:cursor-not-allowed transition-all"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Concept list */}
      <div
        className="flex-1 overflow-y-auto px-5 py-3"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
      >
        <div className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-3">
          Path · {total} Concepts
        </div>
        <div className="space-y-1">
          {path.conceptIds.map((id, i) => {
            const concept = CONCEPTS.find((c) => c.id === id);
            if (!concept) return null;
            const meta = CLUSTER_META[concept.cluster];
            const isCurrent = i === currentIndex;
            const isPast = i < currentIndex;

            return (
              <button
                key={id}
                onClick={() => onNavigate(i)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200 group ${
                  isCurrent
                    ? 'bg-white/[0.07] border border-white/[0.12]'
                    : 'hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                {/* Step indicator */}
                <div
                  className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all"
                  style={{
                    backgroundColor: isCurrent
                      ? meta.stroke
                      : isPast
                      ? 'rgba(255,255,255,0.15)'
                      : 'rgba(255,255,255,0.06)',
                    color: isCurrent ? '#080c14' : isPast ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.3)',
                    border: isCurrent ? 'none' : `1px solid ${isCurrent ? meta.stroke : 'rgba(255,255,255,0.1)'}`,
                  }}
                >
                  {i + 1}
                </div>

                {/* Label */}
                <span
                  className={`text-xs font-medium flex-1 truncate transition-colors ${
                    isCurrent ? 'text-white' : isPast ? 'text-white/50' : 'text-white/40 group-hover:text-white/65'
                  }`}
                >
                  {concept.label}
                </span>

                {/* Cluster dot */}
                {isCurrent && (
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: meta.stroke }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer hint */}
      <div className="flex-shrink-0 px-5 py-3 border-t border-white/[0.05]">
        <p className="text-[10px] text-white/20 leading-relaxed text-center">
          Map highlights your path · Click any node for details
        </p>
      </div>
    </div>
  );
}
