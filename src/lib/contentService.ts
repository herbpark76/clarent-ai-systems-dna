import { CONCEPTS, EDGES } from '../data/concepts';
import { LEARNING_PATH_DEFS } from '../data/learningPaths';
import type { Concept, Edge } from '../data/concepts';
import type { LearningPathDef } from '../data/learningPaths';

/**
 * All site content lives in the repo:
 *   - concepts, map edges:   src/data/concepts.ts
 *   - learning paths:        src/data/learningPaths.ts
 *   - deep-dive articles:    content/articles/*.md
 *
 * Supabase is used only for the updates/waitlist form. The ai_* content
 * tables in Supabase are no longer read by the site.
 */

export interface ContentData {
  concepts: Concept[];
  edges: Edge[];
  learningPathDefs: LearningPathDef[];
  conceptsMap: Record<string, Concept>;
}

const CONTENT: ContentData = {
  concepts: CONCEPTS,
  edges: EDGES,
  learningPathDefs: LEARNING_PATH_DEFS,
  conceptsMap: Object.fromEntries(CONCEPTS.map((c) => [c.id, c])),
};

export function getContent(): ContentData {
  return CONTENT;
}

/** Kept async so existing callers don't need to change. */
export async function loadContent(): Promise<ContentData> {
  return CONTENT;
}
