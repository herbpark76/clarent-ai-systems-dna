import { ChevronLeft, ChevronRight, X, Clock } from 'lucide-react';
import type { LearningPathDef } from '../data/learningPaths';
import type { ProgressStatus } from '../data/roadmaps';
import { CONCEPTS, CLUSTER_META } from '../data/concepts';

interface Props {
  path: LearningPathDef;
  currentIndex: number;
  progress: Record<string, ProgressStatus>;
  onSetProgress: (id: string, status: ProgressStatus) => void;
  onNavigate: (index: number) => void;
  onExit: () => void;
}

const STATUS_ICON: Record<ProgressStatus, { symbol: string; color: string }> = {
  'not-started': { symbol: '○', color: 'text-white/25' },
  'in-progress':  { symbol: '◐', color: 'text-amber-400' },
  'completed':    { symbol: '✓', color: 'text-green-400' },
};

function cycleStatus(current: ProgressStatus): ProgressStatus {
  if (current === 'not-started') return 'in-progress';
  if (current === 'in-progress') return 'completed';
  return 'not-started';
}

export default function LearningPathSidebar({ path, currentIndex, progress, onSetProgress, onNavigate, onExit }: Props) {
  const total = path.conceptIds.length;
  const currentId = path.conceptIds[currentIndex];
  const currentConcept = CONCEPTS.find((c) => c.id === currentId);
  const currentMeta = currentConcept ? CLUSTER_META[currentConcept.cluster] : null;

  const completedCount = path.conceptIds.filter((id) => progress[id] === 'completed').length;
  const inProgressCount = path.conceptIds.filter((id) => progress[id] === 'in-progress').length;
  const progressPct = Math.round((completedCount / total) * 100);
  const totalMinutes = path.conceptIds.reduce((sum, id) => {
    const c = CONCEPTS.find((c) => c.id === id);
    return sum + (c?.estimatedMinutes ?? 0);
  }, 0);

  const canPrev = currentIndex > 0;
  const canNext = currentIndex < total - 1;

  const handleNext = () => {
    if (!canNext) return;
    // Auto-mark current as in-progress when advancing if it was not-started
    const currentStatus = progress[currentId] ?? 'not-started';
    if (currentStatus === 'not-started') {
      onSetProgress(currentId, 'in-progress');
    }
    onNavigate(currentIndex + 1);
  };

  const handlePrev = () => {
    if (canPrev) onNavigate(currentIndex - 1);
  };

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
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-white/35 leading-relaxed line-clamp-1 flex-1">{path.description}</p>
              {totalMinutes > 0 && (
                <div className="flex-shrink-0 flex items-center gap-1 text-[10px] text-white/25">
                  <Clock className="w-2.5 h-2.5" />
                  {totalMinutes >= 60 ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m` : `${totalMinutes}m`}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onExit}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-white/35 hover:text-white hover:bg-white/[0.08] transition-all mt-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex-shrink-0 px-5 py-3 border-b border-white/[0.05]">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Progress</span>
          <span className="text-xs text-white/45">
            <span className="text-white font-semibold">{completedCount}</span>/{total} done
            {inProgressCount > 0 && (
              <span className="text-amber-400 ml-1">· {inProgressCount} in progress</span>
            )}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {progressPct === 100 && (
          <p className="text-xs text-green-400 mt-1.5 font-medium text-center">Path complete!</p>
        )}
      </div>

      {/* Current lesson + navigation */}
      <div className="flex-shrink-0 px-5 py-4 border-b border-white/[0.05]">
        <div className="text-center mb-3">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-1">
            Lesson {currentIndex + 1} of {total}
          </div>
          {currentConcept && currentMeta && (
            <div className="text-lg font-bold leading-tight" style={{ color: currentMeta.stroke }}>
              {currentConcept.label}
            </div>
          )}
        </div>

        {/* Progress toggle for current lesson */}
        {currentId && (
          <div className="flex items-center justify-center gap-2 mb-3">
            {(['not-started', 'in-progress', 'completed'] as ProgressStatus[]).map((status) => {
              const isCurrent = (progress[currentId] ?? 'not-started') === status;
              const info = STATUS_ICON[status];
              const labels: Record<ProgressStatus, string> = {
                'not-started': 'Not Started',
                'in-progress': 'In Progress',
                'completed': 'Completed',
              };
              return (
                <button
                  key={status}
                  onClick={() => onSetProgress(currentId, status)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    isCurrent
                      ? status === 'completed'
                        ? 'border-green-500/40 bg-green-500/15 text-green-300'
                        : status === 'in-progress'
                        ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                        : 'border-white/15 bg-white/[0.08] text-white/70'
                      : 'border-white/[0.06] bg-transparent text-white/25 hover:text-white/55 hover:border-white/15'
                  }`}
                >
                  <span>{info.symbol}</span>
                  <span className="hidden sm:inline">{labels[status].split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Prev / Next buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            disabled={!canPrev}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-xs font-medium text-white/50 hover:text-white hover:bg-white/[0.08] disabled:opacity-25 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Prev
          </button>

          {/* Progress dots */}
          <div className="flex items-center gap-1 justify-center flex-wrap max-w-[80px]">
            {path.conceptIds.map((id, i) => {
              const status = progress[id] ?? 'not-started';
              const dotColor =
                i === currentIndex
                  ? (currentMeta?.stroke ?? '#60a5fa')
                  : status === 'completed'
                  ? '#22c55e'
                  : status === 'in-progress'
                  ? '#f59e0b'
                  : 'rgba(255,255,255,0.12)';
              return (
                <button
                  key={i}
                  onClick={() => onNavigate(i)}
                  className="transition-all duration-200"
                  style={{
                    width: i === currentIndex ? 14 : 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: dotColor,
                  }}
                />
              );
            })}
          </div>

          <button
            onClick={handleNext}
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
            const status = progress[id] ?? 'not-started';
            const statusInfo = STATUS_ICON[status];

            return (
              <div key={id} className="flex items-center gap-2 group">
                {/* Progress status toggle */}
                <button
                  onClick={(e) => { e.stopPropagation(); onSetProgress(id, cycleStatus(status)); }}
                  className={`flex-shrink-0 w-5 h-5 flex items-center justify-center text-xs font-bold transition-all hover:scale-110 ${statusInfo.color}`}
                  title={`Status: ${status} (click to advance)`}
                >
                  {statusInfo.symbol}
                </button>

                {/* Concept row */}
                <button
                  onClick={() => onNavigate(i)}
                  className={`flex-1 flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all duration-200 ${
                    isCurrent
                      ? 'bg-white/[0.07] border border-white/[0.12]'
                      : 'hover:bg-white/[0.04] border border-transparent'
                  }`}
                >
                  {/* Step number */}
                  <div
                    className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all"
                    style={{
                      backgroundColor: isCurrent
                        ? meta.stroke
                        : status === 'completed'
                        ? 'rgba(34,197,94,0.2)'
                        : 'rgba(255,255,255,0.06)',
                      color: isCurrent
                        ? '#080c14'
                        : status === 'completed'
                        ? '#4ade80'
                        : 'rgba(255,255,255,0.3)',
                      border: isCurrent ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    {i + 1}
                  </div>

                  {/* Label */}
                  <span
                    className="text-xs font-medium flex-1 truncate transition-colors"
                    style={{
                      color: isCurrent
                        ? 'white'
                        : status === 'completed'
                        ? '#4ade80'
                        : status === 'in-progress'
                        ? '#fbbf24'
                        : 'rgba(255,255,255,0.40)',
                    }}
                  >
                    {concept.label}
                  </span>

                  {/* Time estimate */}
                  {concept.estimatedMinutes && (
                    <span className="flex-shrink-0 text-[9px] text-white/20">{concept.estimatedMinutes}m</span>
                  )}

                  {/* Current lesson indicator dot */}
                  {isCurrent && (
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: meta.stroke }} />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer hint */}
      <div className="flex-shrink-0 px-5 py-3 border-t border-white/[0.05]">
        <p className="text-[10px] text-white/20 leading-relaxed text-center">
          Click ○/◐/✓ to update progress · Map highlights your path
        </p>
      </div>
    </div>
  );
}
