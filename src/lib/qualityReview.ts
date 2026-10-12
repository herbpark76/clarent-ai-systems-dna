import type { SignalEntry } from './signalDesk';

export type ReviewStatus = 'ready_for_review' | 'needs_attention' | 'not_checked';

export interface Correction {
  field: string;
  before: string;
  after: string;
  description: string;
}

export interface Issue {
  field: string;
  message: string;
}

export interface ReviewProposal {
  id: string;
  title: string;
  type: string;
  current_review_status: string;
  proposed_review_status: ReviewStatus;
  proposed_review_notes: string | null;
  corrections: Correction[];
  issues: Issue[];
  proposed_title?: string;
}

export interface ReviewSummary {
  checked: number;
  withCorrections: number;
  ready: number;
  needsAttention: number;
  failed: number;
}

const TITLE_PREFIXES = [
  /^(roundtable|community\s*(ai\s*)?workflow|sponsored|deep\s*dive|quick\s*hit|bitesized|byte\s*sized|in\s*focus|spotlight|editor's\s*note|top\s*story|featured|breaking|update|exclusive|sneak\s*peek|q&a|ask\s*the\s*community|reader\s*question)\s*[:\-—–]\s*/i,
  /^(\d+\.|\#)\s+/i,
];

export function cleanTitle(title: string): string {
  let cleaned = title.trim();
  for (const pat of TITLE_PREFIXES) {
    cleaned = cleaned.replace(pat, '');
  }
  return cleaned.trim();
}

interface ReviewResult {
  issues: Issue[];
  corrections: Correction[];
}

export function reviewEntry(entry: {
  type: string;
  system_layer: string | null;
  title: string;
  summary: string;
  why_it_matters: string | null;
  how_its_built: string | null;
  business_angle: string | null;
  steps: Array<{ text: string; prompt?: string }> | null;
  tags: string[] | null;
  role_tags: string[] | null;
  model_name: string | null;
  vendor: string | null;
  benchmark_score: number | null;
  benchmark_name: string | null;
  price_input: string | null;
  price_output: string | null;
  result: string | null;
  source_name: string | null;
  source_url: string | null;
}): ReviewResult {
  const issues: Issue[] = [];
  const corrections: Correction[] = [];
  const title = entry.title || '';
  const cleanedTitle = cleanTitle(title);

  // Title prefix correction — a correction, not an issue
  if (cleanedTitle !== title) {
    corrections.push({
      field: 'title',
      before: title,
      after: cleanedTitle,
      description: 'Remove newsletter title prefix',
    });
  }

  // Use the cleaned title for length checks
  const titleForChecks = cleanedTitle || title;

  if (titleForChecks.length < 10) {
    issues.push({ field: 'title', message: 'Title is very short — may need more detail' });
  }
  if (titleForChecks.length > 200) {
    issues.push({ field: 'title', message: 'Title is very long — consider trimming' });
  }

  if ((entry.summary || '').length < 30) {
    issues.push({ field: 'summary', message: 'Summary is very short — may need more detail' });
  }

  // Tutorial completeness: needs usable ordered steps
  if (entry.type === 'tutorial') {
    const steps = entry.steps || [];
    if (steps.length === 0) {
      issues.push({ field: 'steps', message: 'Tutorial has no steps — source may not provide actionable instructions' });
    } else {
      const emptySteps = steps.filter((s) => !s.text || s.text.trim().length < 5);
      if (emptySteps.length > 0) {
        issues.push({ field: 'steps', message: `${emptySteps.length} step(s) have very little text — may not be actionable` });
      }
    }
  }

  // Use case completeness: needs Problem, Tool, Steps, and Result
  if (entry.type === 'use_case') {
    if (!entry.how_its_built && !entry.summary) {
      issues.push({ field: 'how_its_built', message: 'Use case missing structured problem/tool description' });
    }
    if (!entry.result) {
      issues.push({ field: 'result', message: 'Use case missing result/outcome — source may not provide enough detail' });
    }
    const steps = entry.steps || [];
    if (steps.length === 0) {
      issues.push({ field: 'steps', message: 'Use case has no steps — expected structured workflow' });
    }
  }

  // Model release checks
  if (entry.type === 'model_release' && !entry.model_name) {
    issues.push({ field: 'model_name', message: 'Model release has no model_name' });
  }

  // AI DNA category check — system_layer must be set for non-news types
  if (entry.system_layer === null && entry.type !== 'news') {
    issues.push({ field: 'system_layer', message: `Type "${entry.type}" has no AI DNA category — verify this is correct` });
  }

  // Source attribution check
  if (!entry.source_name && !entry.source_url) {
    issues.push({ field: 'source', message: 'No source attribution — add source name or URL' });
  }

  // Benchmark score validation
  if (entry.benchmark_score !== null && entry.benchmark_score !== undefined) {
    if (typeof entry.benchmark_score !== 'number' || isNaN(entry.benchmark_score)) {
      issues.push({ field: 'benchmark_score', message: 'Benchmark score is not a valid number' });
    }
  }

  return { issues, corrections };
}

export function reviewDraft(entry: SignalEntry): ReviewProposal {
  const review = reviewEntry({
    type: entry.type,
    system_layer: entry.system_layer,
    title: entry.title,
    summary: entry.summary,
    why_it_matters: entry.why_it_matters,
    how_its_built: entry.how_its_built,
    business_angle: entry.business_angle,
    steps: entry.steps,
    tags: entry.tags,
    role_tags: entry.role_tags,
    model_name: entry.model_name,
    vendor: entry.vendor,
    benchmark_score: entry.benchmark_score,
    benchmark_name: entry.benchmark_name,
    price_input: entry.price_input,
    price_output: entry.price_output,
    result: entry.result,
    source_name: entry.source_name,
    source_url: entry.source_url,
  });

  // Status is determined by remaining issues only, not corrections
  const proposedStatus: ReviewStatus = review.issues.length > 0 ? 'needs_attention' : 'ready_for_review';

  // Build notes from issues only — corrections are applied, not warned about
  const notes = review.issues.map((i) => i.message);

  return {
    id: entry.id,
    title: entry.title,
    type: entry.type,
    current_review_status: entry.review_status || 'not_checked',
    proposed_review_status: proposedStatus,
    proposed_review_notes: notes.join('; ') || null,
    corrections: review.corrections,
    issues: review.issues,
    proposed_title: review.corrections.some((c) => c.field === 'title')
      ? review.corrections.find((c) => c.field === 'title')!.after
      : undefined,
  };
}

// After applying corrections, re-review the updated entry to recalculate status
export function reReviewAfterApply(
  entry: SignalEntry,
  appliedTitle?: string,
): { status: ReviewStatus; notes: string | null } {
  const updated = { ...entry };
  if (appliedTitle) updated.title = appliedTitle;

  const review = reviewEntry({
    type: updated.type,
    system_layer: updated.system_layer,
    title: updated.title,
    summary: updated.summary,
    why_it_matters: updated.why_it_matters,
    how_its_built: updated.how_its_built,
    business_angle: updated.business_angle,
    steps: updated.steps,
    tags: updated.tags,
    role_tags: updated.role_tags,
    model_name: updated.model_name,
    vendor: updated.vendor,
    benchmark_score: updated.benchmark_score,
    benchmark_name: updated.benchmark_name,
    price_input: updated.price_input,
    price_output: updated.price_output,
    result: updated.result,
    source_name: updated.source_name,
    source_url: updated.source_url,
  });

  const status: ReviewStatus = review.issues.length > 0 ? 'needs_attention' : 'ready_for_review';
  const notes = review.issues.map((i) => i.message).join('; ') || null;
  return { status, notes };
}
