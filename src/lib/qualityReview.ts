import type { SignalEntry } from './signalDesk';

export type ReviewStatus = 'ready_for_review' | 'needs_attention' | 'not_checked';

export interface ReviewProposal {
  id: string;
  title: string;
  type: string;
  current_review_status: string;
  proposed_review_status: ReviewStatus;
  proposed_review_notes: string;
  proposed_title?: string;
  changes: string[];
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
  status: 'ready_for_review' | 'needs_attention';
  notes: string[];
  cleaned_title?: string;
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
}): ReviewResult {
  const notes: string[] = [];
  const title = entry.title || '';
  const cleanedTitle = cleanTitle(title);

  if (cleanedTitle !== title) {
    notes.push(`Title had newsletter prefix; cleaned from "${title.slice(0, 60)}" to "${cleanedTitle.slice(0, 60)}"`);
  }

  if (entry.type === 'tutorial') {
    const steps = entry.steps || [];
    if (steps.length === 0) {
      notes.push('Tutorial has no steps — source may not provide actionable instructions');
    }
  }

  if (entry.type === 'use_case') {
    if (!entry.result && !entry.how_its_built) {
      notes.push('Use case missing result/outcome — source may not provide enough detail');
    }
  }

  if (cleanedTitle.length < 10) {
    notes.push('Title is very short — may need more detail');
  }
  if (cleanedTitle.length > 200) {
    notes.push('Title is very long — consider trimming');
  }

  if ((entry.summary || '').length < 30) {
    notes.push('Summary is very short — may need more detail');
  }

  if (entry.type === 'model_release' && !entry.model_name) {
    notes.push('Model release has no model_name');
  }

  if (entry.system_layer === null && entry.type !== 'news' && entry.type !== 'use_case') {
    notes.push(`Type "${entry.type}" has no system_layer — verify this is correct`);
  }

  if (entry.benchmark_score !== null && entry.benchmark_score !== undefined) {
    if (typeof entry.benchmark_score !== 'number' || isNaN(entry.benchmark_score)) {
      notes.push('Benchmark score is not a valid number');
    }
  }

  const status = notes.length > 0 ? 'needs_attention' : 'ready_for_review';
  const result: ReviewResult = { status, notes };
  if (cleanedTitle !== title) result.cleaned_title = cleanedTitle;
  return result;
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
  });

  const changes: string[] = [...review.notes];
  if (review.cleaned_title && review.cleaned_title !== entry.title) {
    changes.unshift(`Title cleaned: "${entry.title.slice(0, 60)}" → "${review.cleaned_title.slice(0, 60)}"`);
  }

  return {
    id: entry.id,
    title: entry.title,
    type: entry.type,
    current_review_status: entry.review_status || 'not_checked',
    proposed_review_status: review.status,
    proposed_review_notes: changes.join('; '),
    proposed_title: review.cleaned_title !== entry.title ? review.cleaned_title : undefined,
    changes,
  };
}
