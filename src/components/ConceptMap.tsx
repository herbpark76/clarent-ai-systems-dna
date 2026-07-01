import { useState, useRef, useCallback, useEffect } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { CONCEPTS, EDGES, CLUSTER_META, type Concept } from '../data/concepts';
import type { ProgressStatus } from '../data/roadmaps';

interface Props {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  roadmapConceptIds: string[] | null;
  progress: Record<string, ProgressStatus>;
  currentLessonId: string | null;
}

const VB_W = 1260;
const VB_H = 720;
const NODE_W = 130;
const NODE_H = 48;

const CLUSTER_REGIONS = [
  { cluster: 'foundation',   cx: 180,  cy: 380, rx: 150, ry: 210 },
  { cluster: 'knowledge',    cx: 438,  cy: 500, rx: 180, ry: 195 },
  { cluster: 'intelligence', cx: 762,  cy: 415, rx: 208, ry: 225 },
  { cluster: 'production',   cx: 1075, cy: 430, rx: 158, ry: 188 },
] as const;

const CLUSTER_LABELS = [
  { cluster: 'foundation',   x: 100,  y: 148 },
  { cluster: 'knowledge',    x: 300,  y: 348 },
  { cluster: 'intelligence', x: 600,  y: 155 },
  { cluster: 'production',   x: 944,  y: 175 },
] as const;

function getEdgeEndpoint(from: Concept, to: Concept) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return { x: from.x, y: from.y };
  const nx = dx / dist;
  const ny = dy / dist;
  const tx = Math.abs(nx) > 0.001 ? (NODE_W / 2) / Math.abs(nx) : Infinity;
  const ty = Math.abs(ny) > 0.001 ? (NODE_H / 2) / Math.abs(ny) : Infinity;
  const t = Math.min(tx, ty);
  return { x: from.x + nx * t, y: from.y + ny * t };
}

function buildEdgePath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  }
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
}

export default function ConceptMap({ selectedId, onSelect, roadmapConceptIds, progress, currentLessonId }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [vt, setVt] = useState({ x: 0, y: 0, k: 1 });

  const svgRef = useRef<SVGSVGElement>(null);
  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const dragDist = useRef(0);

  const conceptMap = Object.fromEntries(CONCEPTS.map((c) => [c.id, c]));
  const activeId = hoveredId ?? selectedId;
  const inRoadmapMode = roadmapConceptIds !== null;

  function getNodeState(id: string): 'selected' | 'current-lesson' | 'highlighted' | 'roadmap' | 'dimmed' | 'default' {
    if (inRoadmapMode) {
      const inRoadmap = roadmapConceptIds!.includes(id);
      if (!inRoadmap) return 'dimmed';
      if (id === currentLessonId) return 'current-lesson';
      if (!activeId) return 'roadmap';
      if (id === activeId) return 'selected';
      const active = conceptMap[activeId];
      if (active && active.highlightGroup.includes(id) && roadmapConceptIds!.includes(id)) return 'highlighted';
      return 'roadmap';
    }
    if (!activeId) return 'default';
    if (id === activeId) return 'selected';
    const active = conceptMap[activeId];
    if (active && active.highlightGroup.includes(id)) return 'highlighted';
    return 'dimmed';
  }

  function getEdgeState(from: string, to: string): 'highlighted' | 'roadmap' | 'dimmed' | 'default' {
    if (inRoadmapMode) {
      const fromIn = roadmapConceptIds!.includes(from);
      const toIn = roadmapConceptIds!.includes(to);
      if (!fromIn || !toIn) return 'dimmed';
      if (!activeId) return 'roadmap';
      const active = conceptMap[activeId];
      if (!active) return 'roadmap';
      const group = [activeId, ...active.highlightGroup];
      if (group.includes(from) && group.includes(to)) return 'highlighted';
      return 'roadmap';
    }
    if (!activeId) return 'default';
    const active = conceptMap[activeId];
    if (!active) return 'dimmed';
    const group = [activeId, ...active.highlightGroup];
    if (group.includes(from) && group.includes(to)) return 'highlighted';
    return 'dimmed';
  }

  const zoomAtPoint = useCallback((factor: number, cx: number, cy: number) => {
    setVt((prev) => {
      const newK = Math.min(Math.max(prev.k * factor, 0.35), 3);
      return {
        k: newK,
        x: cx - (cx - prev.x) * (newK / prev.k),
        y: cy - (cy - prev.y) * (newK / prev.k),
      };
    });
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgP = pt.matrixTransform(svg.getScreenCTM()!.inverse());
      zoomAtPoint(e.deltaY < 0 ? 1.1 : 0.9, svgP.x, svgP.y);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [zoomAtPoint]);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    isPanning.current = true;
    dragDist.current = 0;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!isPanning.current) return;
    const svg = svgRef.current;
    if (!svg) return;
    const scaleRatio = svg.clientWidth / VB_W;
    const dx = (e.clientX - lastMouse.current.x) / scaleRatio;
    const dy = (e.clientY - lastMouse.current.y) / scaleRatio;
    dragDist.current += Math.abs(dx) + Math.abs(dy);
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setVt((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
  }, []);

  const handleMouseUp = useCallback(() => { isPanning.current = false; }, []);

  const handleSvgClick = useCallback(() => {
    if (dragDist.current > 6) return;
    onSelect(null);
  }, [onSelect]);

  const handleNodeClick = useCallback(
    (e: React.MouseEvent, id: string) => {
      if (dragDist.current > 6) return;
      e.stopPropagation();
      onSelect(selectedId === id ? null : id);
    },
    [selectedId, onSelect]
  );

  return (
    <div className="relative w-full h-full select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
        style={{ cursor: isPanning.current ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleSvgClick}
      >
        <defs>
          {(['foundation', 'knowledge', 'intelligence', 'production'] as const).map((c) => (
            <radialGradient key={c} id={`bg-${c}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={CLUSTER_META[c].glow} stopOpacity="0.07" />
              <stop offset="100%" stopColor={CLUSTER_META[c].glow} stopOpacity="0" />
            </radialGradient>
          ))}
          {CONCEPTS.map((c) => (
            <radialGradient key={`g-${c.id}`} id={`glow-${c.id}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={CLUSTER_META[c.cluster].glow} stopOpacity="0.9" />
              <stop offset="100%" stopColor={CLUSTER_META[c.cluster].glow} stopOpacity="0" />
            </radialGradient>
          ))}
          {/* Completed glow gradient - green */}
          <radialGradient id="glow-completed" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g transform={`translate(${vt.x},${vt.y}) scale(${vt.k})`}>
          {/* Cluster background regions */}
          {CLUSTER_REGIONS.map(({ cluster, cx, cy, rx, ry }) => (
            <ellipse
              key={cluster}
              cx={cx} cy={cy} rx={rx} ry={ry}
              fill={`url(#bg-${cluster})`}
              style={{ pointerEvents: 'none' }}
            />
          ))}

          {/* Cluster labels */}
          {CLUSTER_LABELS.map(({ cluster, x, y }) => (
            <text
              key={cluster}
              x={x} y={y}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill={CLUSTER_META[cluster].stroke}
              opacity={activeId ? 0.25 : 0.55}
              style={{ textTransform: 'uppercase', pointerEvents: 'none', transition: 'opacity 0.3s ease' }}
            >
              {CLUSTER_META[cluster].label.toUpperCase()}
            </text>
          ))}

          {/* Edges */}
          {EDGES.map((edge) => {
            const fromNode = conceptMap[edge.from];
            const toNode = conceptMap[edge.to];
            if (!fromNode || !toNode) return null;
            const p1 = getEdgeEndpoint(fromNode, toNode);
            const p2 = getEdgeEndpoint(toNode, fromNode);
            const state = getEdgeState(edge.from, edge.to);
            const opacity =
              state === 'highlighted' ? 0.7
              : state === 'roadmap' ? 0.3
              : state === 'dimmed' ? 0.04
              : 0.18;
            const stroke =
              state === 'highlighted' ? CLUSTER_META[fromNode.cluster].stroke
              : state === 'roadmap' ? 'rgba(255,255,255,0.5)'
              : 'rgba(255,255,255,0.6)';
            const sw = state === 'highlighted' ? 1.5 : state === 'roadmap' ? 1.2 : 1;
            return (
              <path
                key={`${edge.from}-${edge.to}`}
                d={buildEdgePath(p1.x, p1.y, p2.x, p2.y)}
                stroke={stroke}
                strokeWidth={sw}
                fill="none"
                style={{ transition: 'all 0.3s ease', opacity, pointerEvents: 'none' }}
              />
            );
          })}

          {/* Nodes */}
          {CONCEPTS.map((node) => {
            const state = getNodeState(node.id);
            const meta = CLUSTER_META[node.cluster];
            const isSelected = node.id === selectedId;
            const isHovered = node.id === hoveredId;
            const isCurrentLesson = state === 'current-lesson';
            const isActive = isSelected || isHovered;
            const nodeProgress = progress[node.id];
            const isCompleted = nodeProgress === 'completed';
            const isInProgress = nodeProgress === 'in-progress';

            const opacity =
              state === 'dimmed' ? 0.12
              : state === 'roadmap' ? 0.9
              : 1;
            const strokeWidth = isActive ? 1.8 : isCurrentLesson ? 2 : state === 'roadmap' ? 1.5 : 1;
            const strokeOpacity = isActive ? 1 : isCurrentLesson ? 1 : state === 'highlighted' ? 0.75 : state === 'roadmap' ? 0.7 : 0.45;
            const scale = isActive ? 1.06 : isCurrentLesson ? 1.1 : 1;
            const hw = NODE_W / 2;
            const hh = NODE_H / 2;

            const nodeFill = isCompleted ? 'rgba(34,197,94,0.18)'
              : isCurrentLesson ? `${meta.glow}30`
              : meta.fill;
            const nodeStroke = isCompleted ? '#22c55e'
              : isInProgress ? '#f59e0b'
              : meta.stroke;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x},${node.y})`}
                style={{
                  cursor: 'pointer',
                  opacity,
                  transition: 'opacity 0.3s ease',
                  transformBox: 'fill-box',
                  transformOrigin: 'center',
                }}
                onClick={(e) => handleNodeClick(e, node.id)}
                onMouseEnter={() => setHoveredId(node.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* Current lesson dashed outer ring */}
                {isCurrentLesson && (
                  <rect
                    x={-hw - 7} y={-hh - 7}
                    width={NODE_W + 14} height={NODE_H + 14}
                    rx={16}
                    fill="none"
                    stroke={meta.stroke}
                    strokeWidth={1}
                    strokeOpacity={0.6}
                    strokeDasharray="4 3"
                    style={{ pointerEvents: 'none', animation: 'lesson-pulse 2s ease-in-out infinite' }}
                  />
                )}

                {/* Completed glow */}
                {isCompleted && (
                  <ellipse cx={0} cy={0} rx={hw + 20} ry={hh + 16}
                    fill="url(#glow-completed)"
                    style={{ pointerEvents: 'none', opacity: 0.5 }}
                  />
                )}

                {/* Current lesson glow */}
                {isCurrentLesson && !isCompleted && (
                  <ellipse cx={0} cy={0} rx={hw + 22} ry={hh + 18}
                    fill={`url(#glow-${node.id})`}
                    style={{ pointerEvents: 'none', opacity: 0.6 }}
                  />
                )}

                {/* Active glow halo */}
                {isActive && !isCompleted && !isCurrentLesson && (
                  <ellipse cx={0} cy={0} rx={hw + 18} ry={hh + 14}
                    fill={`url(#glow-${node.id})`}
                    style={{ pointerEvents: 'none', opacity: 0.6 }}
                  />
                )}

                {/* Node body */}
                <g style={{ transform: `scale(${scale})`, transition: 'transform 0.2s ease', transformBox: 'fill-box', transformOrigin: 'center' }}>
                  <rect
                    x={-hw} y={-hh}
                    width={NODE_W} height={NODE_H}
                    rx={10}
                    fill={nodeFill}
                    stroke={nodeStroke}
                    strokeWidth={strokeWidth}
                    strokeOpacity={strokeOpacity}
                    style={{ transition: 'all 0.25s ease' }}
                  />

                  {node.lines.length === 1 ? (
                    <text x={0} y={0} textAnchor="middle" dominantBaseline="middle" fontSize="11.5" fontWeight="600" fill="white" fillOpacity={isActive || isCurrentLesson ? 1 : 0.85} style={{ pointerEvents: 'none', transition: 'fill-opacity 0.2s ease' }}>
                      {node.lines[0]}
                    </text>
                  ) : (
                    <>
                      <text x={0} y={-8} textAnchor="middle" dominantBaseline="middle" fontSize="10.5" fontWeight="600" fill="white" fillOpacity={isActive || isCurrentLesson ? 1 : 0.85} style={{ pointerEvents: 'none' }}>
                        {node.lines[0]}
                      </text>
                      <text x={0} y={9} textAnchor="middle" dominantBaseline="middle" fontSize="10.5" fontWeight="600" fill="white" fillOpacity={isActive || isCurrentLesson ? 1 : 0.85} style={{ pointerEvents: 'none' }}>
                        {node.lines[1]}
                      </text>
                    </>
                  )}

                  {isCompleted ? (
                    <circle cx={hw - 8} cy={-hh + 8} r={4} fill="#22c55e" fillOpacity={0.9} />
                  ) : isInProgress ? (
                    <circle cx={hw - 8} cy={-hh + 8} r={4} fill="#f59e0b" fillOpacity={0.9} />
                  ) : isCurrentLesson ? (
                    <circle cx={hw - 8} cy={-hh + 8} r={4} fill={meta.stroke} fillOpacity={1} />
                  ) : (
                    <circle cx={hw - 8} cy={-hh + 8} r={3} fill={meta.stroke} fillOpacity={isActive ? 1 : 0.6} />
                  )}
                </g>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1.5">
        <button onClick={() => zoomAtPoint(1.2, VB_W / 2, VB_H / 2)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.07] border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.12] transition-all" title="Zoom in">
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => zoomAtPoint(1 / 1.2, VB_W / 2, VB_H / 2)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.07] border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.12] transition-all" title="Zoom out">
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setVt({ x: 0, y: 0, k: 1 })} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.07] border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.12] transition-all" title="Reset view">
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4">
        <div
          className="flex flex-wrap gap-x-3 gap-y-1.5 px-3 py-2 rounded-xl"
          style={{
            background: 'rgba(8,12,20,0.75)',
            border: '1px solid rgba(255,255,255,0.07)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {(['foundation', 'knowledge', 'intelligence', 'production'] as const).map((c) => (
            <div key={c} className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CLUSTER_META[c].stroke }} />
              <span className="text-[10px] font-medium" style={{ color: CLUSTER_META[c].stroke, opacity: 0.75 }}>
                {CLUSTER_META[c].label}
              </span>
            </div>
          ))}
          {inRoadmapMode && (
            <>
              <div className="w-px self-stretch bg-white/[0.08]" />
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span className="text-[10px] font-medium text-amber-300/75">In Progress</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span className="text-[10px] font-medium text-green-300/75">Completed</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Hint */}
      {!selectedId && !inRoadmapMode && !currentLessonId && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-xs text-white/35 pointer-events-none">
          Click any node to explore · Scroll to zoom · Drag to pan
        </div>
      )}
      {!selectedId && inRoadmapMode && !currentLessonId && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-xs text-white/35 pointer-events-none">
          Highlighted concepts are on your roadmap · Click to view details
        </div>
      )}
      {currentLessonId && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-xs text-white/35 pointer-events-none">
          Use Prev / Next in the sidebar to navigate · Click any node for details
        </div>
      )}
    </div>
  );
}
