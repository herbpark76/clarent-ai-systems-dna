import { ROADMAP_GOALS, ROADMAPS, GOAL_TO_ROADMAP_ID, type RoadmapGoal } from '../data/roadmaps';
import {
  BookOpen, Bot, Search, Workflow, Wrench, Code2, Database,
  Layers, Building2, ArrowRight
} from 'lucide-react';

interface Props {
  onSelect: (roadmapId: string) => void;
}

const GOAL_ICONS: Record<RoadmapGoal, React.ComponentType<{ className?: string }>> = {
  'Internal Knowledge Assistant': BookOpen,
  'Customer Support Bot': Bot,
  'AI Research Assistant': Search,
  'Workflow Automation': Workflow,
  'AI Agent': Bot,
  'Coding Assistant': Code2,
  'Enterprise Search': Database,
  'AI SaaS Product': Layers,
  'Domain Intelligence Platform': Building2,
};

const GOAL_ACCENT: Record<RoadmapGoal, string> = {
  'Internal Knowledge Assistant': 'border-blue-500/30 hover:border-blue-500/50 hover:bg-blue-500/[0.07]',
  'Customer Support Bot': 'border-emerald-500/30 hover:border-emerald-500/50 hover:bg-emerald-500/[0.07]',
  'AI Research Assistant': 'border-amber-500/30 hover:border-amber-500/50 hover:bg-amber-500/[0.07]',
  'Workflow Automation': 'border-cyan-500/30 hover:border-cyan-500/50 hover:bg-cyan-500/[0.07]',
  'AI Agent': 'border-yellow-500/30 hover:border-yellow-500/50 hover:bg-yellow-500/[0.07]',
  'Coding Assistant': 'border-teal-500/30 hover:border-teal-500/50 hover:bg-teal-500/[0.07]',
  'Enterprise Search': 'border-sky-500/30 hover:border-sky-500/50 hover:bg-sky-500/[0.07]',
  'AI SaaS Product': 'border-rose-500/30 hover:border-rose-500/50 hover:bg-rose-500/[0.07]',
  'Domain Intelligence Platform': 'border-violet-500/30 hover:border-violet-500/50 hover:bg-violet-500/[0.07]',
};

const ICON_COLORS: Record<RoadmapGoal, string> = {
  'Internal Knowledge Assistant': 'text-blue-400',
  'Customer Support Bot': 'text-emerald-400',
  'AI Research Assistant': 'text-amber-400',
  'Workflow Automation': 'text-cyan-400',
  'AI Agent': 'text-yellow-400',
  'Coding Assistant': 'text-teal-400',
  'Enterprise Search': 'text-sky-400',
  'AI SaaS Product': 'text-rose-400',
  'Domain Intelligence Platform': 'text-violet-400',
};

export default function GoalSelector({ onSelect }: Props) {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-white mb-2">What are you trying to build?</h3>
        <p className="text-sm text-white/40">Select a goal to get a personalized learning roadmap with highlighted concepts and guided progression.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-2.5">
        {ROADMAP_GOALS.map((goal) => {
          const roadmapId = GOAL_TO_ROADMAP_ID[goal];
          const roadmap = ROADMAPS.find((r) => r.id === roadmapId);
          const Icon = GOAL_ICONS[goal] ?? Wrench;
          const accent = GOAL_ACCENT[goal];
          const iconColor = ICON_COLORS[goal];

          return (
            <button
              key={goal}
              onClick={() => onSelect(roadmapId)}
              className={`group flex flex-col items-start gap-2 p-4 rounded-xl border bg-white/[0.02] ${accent} transition-all duration-200 text-left`}
            >
              <div className="flex items-center justify-between w-full">
                <Icon className={`w-4 h-4 ${iconColor}`} />
                <ArrowRight className="w-3 h-3 text-white/20 group-hover:text-white/50 transition-colors" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white/80 group-hover:text-white transition-colors leading-snug">{goal}</div>
                {roadmap && (
                  <div className="text-[10px] text-white/30 mt-0.5">{roadmap.conceptIds.length} concepts · {roadmap.difficulty}</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
