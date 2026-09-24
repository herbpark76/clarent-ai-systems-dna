import type { ProgressStatus } from '../data/roadmaps';

const PROGRESS_KEY = 'ai-systems-dna-progress';
const READ_KEY = 'ai-systems-dna-read-articles';

export function loadProgress(): Record<string, ProgressStatus> {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveProgress(p: Record<string, ProgressStatus>) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch { /* no-op */ }
}

export function loadReadArticles(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveReadArticles(data: Record<string, boolean>) {
  try { localStorage.setItem(READ_KEY, JSON.stringify(data)); } catch { /* no-op */ }
}

export function markArticleRead(slug: string): Record<string, boolean> {
  const data = loadReadArticles();
  data[slug] = true;
  saveReadArticles(data);
  return data;
}

export function isArticleRead(slug: string): boolean {
  try {
    return !!loadReadArticles()[slug];
  } catch {
    return false;
  }
}
