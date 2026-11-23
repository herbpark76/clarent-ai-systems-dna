import { LEARNING_PATH_DEFS, type LearningPathDef } from '../data/learningPaths';
import type { ProgressStatus } from '../data/roadmaps';

export interface LessonPosition {
  path: LearningPathDef;
  index: number;
  total: number;
  prevId: string | null;
  nextId: string | null;
}

/** Where a concept sits inside a learning path, or null if it isn't part of it. */
export function getLessonPosition(pathId: string | null, conceptId: string): LessonPosition | null {
  if (!pathId) return null;
  const path = LEARNING_PATH_DEFS.find((p) => p.id === pathId);
  if (!path) return null;
  const index = path.conceptIds.indexOf(conceptId);
  if (index === -1) return null;
  return {
    path,
    index,
    total: path.conceptIds.length,
    prevId: index > 0 ? path.conceptIds[index - 1] : null,
    nextId: index < path.conceptIds.length - 1 ? path.conceptIds[index + 1] : null,
  };
}

/** URL for a lesson inside a path. */
export function lessonUrl(conceptId: string, pathId: string): string {
  return `/concepts/${conceptId}?path=${encodeURIComponent(pathId)}`;
}

/** The lesson a learner should open when they click "Start" or "Continue" on a path. */
export function startLessonUrl(pathId: string, progress: Record<string, ProgressStatus>): string {
  const path = LEARNING_PATH_DEFS.find((p) => p.id === pathId);
  if (!path) return '/';
  const next = path.conceptIds.find((id) => progress[id] !== 'completed') ?? path.conceptIds[0];
  return lessonUrl(next, pathId);
}
