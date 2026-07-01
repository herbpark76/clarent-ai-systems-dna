import { supabase } from './supabase';
import { CONCEPTS, EDGES } from '../data/concepts';
import { LEARNING_PATH_DEFS } from '../data/learningPaths';
import type { Concept, Edge, ClusterType } from '../data/concepts';
import type { LearningPathDef } from '../data/learningPaths';

export interface ContentData {
  concepts: Concept[];
  edges: Edge[];
  learningPathDefs: LearningPathDef[];
  conceptsMap: Record<string, Concept>;
}

const PATH_UI_META: Record<string, { color: string; badge: string }> = {
  beginner: {
    color: 'from-sky-500/20 to-sky-400/5',
    badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  },
  builder: {
    color: 'from-emerald-500/20 to-emerald-400/5',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  architect: {
    color: 'from-orange-500/20 to-orange-400/5',
    badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  },
  'domain-builder': {
    color: 'from-rose-500/20 to-rose-400/5',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  },
};

function buildConceptLines(name: string): string[] {
  const spaceIdx = name.indexOf(' ');
  if (spaceIdx === -1) return [name];
  return [name.slice(0, spaceIdx), name.slice(spaceIdx + 1)];
}

function hardcodedFallback(): ContentData {
  return {
    concepts: CONCEPTS,
    edges: EDGES,
    learningPathDefs: LEARNING_PATH_DEFS,
    conceptsMap: Object.fromEntries(CONCEPTS.map((c) => [c.id, c])),
  };
}

export async function loadContent(): Promise<ContentData> {
  try {
    const [
      conceptsResult,
      relationshipsResult,
      pathsResult,
      stepsResult,
      toolsResult,
      conceptToolsResult,
    ] = await Promise.all([
      supabase.from('ai_concepts').select('*').order('slug'),
      supabase.from('ai_concept_relationships').select('*'),
      supabase.from('ai_learning_paths').select('*').order('slug'),
      supabase.from('ai_learning_path_steps').select('*').order('step_order'),
      supabase.from('ai_tools').select('slug, name'),
      supabase.from('ai_concept_tools').select('concept_slug, tool_slug'),
    ]);

    if (conceptsResult.error || !conceptsResult.data?.length) {
      return hardcodedFallback();
    }

    const dbConcepts = conceptsResult.data;
    const dbRels = relationshipsResult.data ?? [];
    const dbPaths = pathsResult.data ?? [];
    const dbSteps = stepsResult.data ?? [];
    const dbTools = toolsResult.data ?? [];
    const dbConceptTools = conceptToolsResult.data ?? [];

    // Build tools lookup: slug → name
    const toolNameBySlug: Record<string, string> = {};
    for (const t of dbTools) toolNameBySlug[t.slug] = t.name;

    // Group relationships by source slug
    const relsBySource: Record<string, typeof dbRels> = {};
    for (const rel of dbRels) {
      (relsBySource[rel.source_concept_slug] ??= []).push(rel);
    }

    // Group tool names by concept slug
    const toolNamesByConcept: Record<string, string[]> = {};
    for (const ct of dbConceptTools) {
      const name = toolNameBySlug[ct.tool_slug];
      if (name) (toolNamesByConcept[ct.concept_slug] ??= []).push(name);
    }

    const concepts: Concept[] = dbConcepts.map((c) => {
      const rels = relsBySource[c.slug] ?? [];
      const prerequisites = rels
        .filter((r) => r.relationship_type === 'prerequisite')
        .map((r) => r.target_concept_slug);
      const unlocksNext = rels
        .filter((r) => r.relationship_type === 'unlocks')
        .map((r) => r.target_concept_slug);
      const highlightGroup = rels
        .filter((r) => r.relationship_type === 'highlight_group')
        .map((r) => r.target_concept_slug);
      const relatedTech = toolNamesByConcept[c.slug] ?? [];

      return {
        id: c.slug,
        label: c.name,
        lines: buildConceptLines(c.name),
        cluster: c.category as ClusterType,
        x: Number(c.x_position),
        y: Number(c.y_position),
        description: c.overview ?? c.short_description ?? '',
        whyItMatters: c.why_it_matters ?? '',
        whyShouldICare: c.why_should_i_care ?? '',
        commonMistakes: Array.isArray(c.common_mistakes) ? (c.common_mistakes as string[]) : [],
        prerequisites,
        unlocksNext,
        relatedTech,
        highlightGroup,
        estimatedMinutes: c.overview_minutes ?? 10,
      };
    });

    // Graph edges from relationship_type = 'edge'
    const edges: Edge[] = dbRels
      .filter((r) => r.relationship_type === 'edge')
      .map((r) => ({ from: r.source_concept_slug, to: r.target_concept_slug }));

    // Learning paths — preserve slug-based UI color/badge
    const learningPathDefs: LearningPathDef[] = dbPaths.map((p) => {
      const steps = dbSteps
        .filter((s) => s.path_slug === p.slug)
        .sort((a, b) => a.step_order - b.step_order);
      const uiMeta = PATH_UI_META[p.slug] ?? PATH_UI_META.beginner;
      return {
        id: p.slug,
        level: p.audience ?? p.name,
        label: p.name,
        description: p.description ?? '',
        color: uiMeta.color,
        badge: uiMeta.badge,
        conceptIds: steps.map((s) => s.concept_slug),
      };
    });

    return {
      concepts,
      edges,
      learningPathDefs,
      conceptsMap: Object.fromEntries(concepts.map((c) => [c.id, c])),
    };
  } catch {
    return hardcodedFallback();
  }
}
