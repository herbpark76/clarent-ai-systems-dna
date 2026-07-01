import { CheckCircle, Trophy, Map, RefreshCw, Clock } from 'lucide-react';

interface Props {
  pathName: string;
  conceptCount: number;
  totalMinutes: number;
  onExplore: () => void;
  onRestart: () => void;
}

const SPARKLE_POSITIONS = [
  { top: '12%', left: '15%', delay: '0ms',   size: 18 },
  { top: '8%',  left: '55%', delay: '120ms',  size: 12 },
  { top: '18%', left: '80%', delay: '240ms',  size: 16 },
  { top: '70%', left: '8%',  delay: '60ms',   size: 14 },
  { top: '75%', left: '88%', delay: '180ms',  size: 20 },
  { top: '55%', left: '92%', delay: '300ms',  size: 11 },
  { top: '85%', left: '40%', delay: '90ms',   size: 15 },
  { top: '30%', left: '4%',  delay: '210ms',  size: 13 },
];

const CONFETTI_PIECES = Array.from({ length: 20 }, (_, i) => ({
  left: `${5 + i * 4.7}%`,
  delay: `${(i * 73) % 600}ms`,
  duration: `${900 + (i * 97) % 500}ms`,
  color: ['#22c55e', '#34d399', '#6ee7b7', '#a7f3d0', '#059669'][i % 5],
  size: 4 + (i % 4),
}));

function formatTime(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default function CompletionScreen({ pathName, conceptCount, totalMinutes, onExplore, onRestart }: Props) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(8,12,20,0.92)', backdropFilter: 'blur(16px)' }}
    >
      {/* Confetti */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        {CONFETTI_PIECES.map((p, i) => (
          <div
            key={i}
            className="absolute rounded-sm"
            style={{
              left: p.left,
              top: '-8px',
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              animation: `confetti-fall ${p.duration} ${p.delay} ease-in forwards`,
            }}
          />
        ))}
      </div>

      {/* Sparkles */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        {SPARKLE_POSITIONS.map((s, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              top: s.top,
              left: s.left,
              animation: `sparkle-pop 1.2s ${s.delay} ease-out infinite`,
            }}
          >
            <svg width={s.size} height={s.size} viewBox="0 0 24 24" fill="none">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" fill="#4ade80" fillOpacity="0.7" />
            </svg>
          </div>
        ))}
      </div>

      {/* Card */}
      <div
        className="relative w-full max-w-md animate-completion-rise"
        style={{
          background: 'linear-gradient(135deg, rgba(16,30,16,0.97) 0%, rgba(8,24,16,0.97) 100%)',
          border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: 24,
          boxShadow: '0 0 80px rgba(34,197,94,0.15), 0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Glow top bar */}
        <div
          className="absolute top-0 left-0 right-0 h-px rounded-t-3xl"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(52,211,153,0.6), transparent)' }}
        />

        <div className="px-8 py-8 text-center">
          {/* Icon */}
          <div className="flex items-center justify-center mb-5">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(34,197,94,0.25), rgba(16,185,129,0.15))',
                border: '1px solid rgba(34,197,94,0.4)',
                boxShadow: '0 0 32px rgba(34,197,94,0.2)',
              }}
            >
              <Trophy className="w-7 h-7 text-emerald-400" />
            </div>
          </div>

          {/* Headline */}
          <div
            className="text-[11px] font-bold uppercase tracking-widest text-emerald-400/70 mb-2"
          >
            Path Complete
          </div>
          <h2
            className="text-2xl font-bold text-white mb-1 leading-tight"
            style={{ textShadow: '0 0 40px rgba(52,211,153,0.3)' }}
          >
            {pathName}
          </h2>
          <p className="text-sm text-white/45 mb-6">
            You've worked through all the concepts on this path.
          </p>

          {/* Stats row */}
          <div className="flex items-center justify-center gap-6 mb-7">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-0.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xl font-bold text-white">{conceptCount}</span>
              </div>
              <div className="text-[10px] text-white/35 uppercase tracking-wider">Concepts</div>
            </div>
            <div className="w-px h-8 bg-white/[0.08]" />
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-0.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xl font-bold text-white">{formatTime(totalMinutes)}</span>
              </div>
              <div className="text-[10px] text-white/35 uppercase tracking-wider">Study Time</div>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col gap-2.5">
            <button
              onClick={onExplore}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white transition-all"
              style={{
                background: 'linear-gradient(135deg, #16a34a, #059669)',
                boxShadow: '0 4px 24px rgba(22,163,74,0.35)',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 32px rgba(22,163,74,0.55)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 24px rgba(22,163,74,0.35)'; }}
            >
              <Map className="w-4 h-4" />
              Explore the Map
            </button>
            <button
              onClick={onRestart}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white/55 hover:text-white border border-white/[0.08] hover:border-white/[0.18] hover:bg-white/[0.04] transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Start Another Path
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
