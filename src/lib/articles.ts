import { parseFrontmatter, type ArticleMeta } from './frontmatter';

export type { ArticleMeta };

const articleModules = import.meta.glob('/content/articles/*.md', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>;

const quizModules = import.meta.glob('/content/quizzes/*.json', {
  import: 'default',
}) as Record<string, () => Promise<QuizData>>;

const articleCache: Record<string, { meta: ArticleMeta; body: string }> = {};

async function loadArticleBySlug(
  slug: string,
): Promise<{ meta: ArticleMeta; body: string } | null> {
  if (articleCache[slug]) return articleCache[slug];

  for (const [path, loader] of Object.entries(articleModules)) {
    if (path.endsWith(`/${slug}.md`)) {
      const raw = await loader();
      const { meta, body } = parseFrontmatter(raw);
      articleCache[slug] = { meta, body };
      return articleCache[slug];
    }
  }
  return null;
}

export { loadArticleBySlug };

export function getAvailableArticleSlugs(): Set<string> {
  const slugs = new Set<string>();
  for (const path of Object.keys(articleModules)) {
    const match = path.match(/\/([^/]+)\.md$/);
    if (match) slugs.add(match[1]);
  }
  return slugs;
}

export function getQuizSlugs(): Set<string> {
  const slugs = new Set<string>();
  for (const path of Object.keys(quizModules)) {
    const match = path.match(/\/([^/]+)\.json$/);
    if (match) slugs.add(match[1]);
  }
  return slugs;
}

export async function loadQuizBySlug(slug: string): Promise<QuizData | null> {
  for (const [path, loader] of Object.entries(quizModules)) {
    if (path.endsWith(`/${slug}.json`)) {
      return loader();
    }
  }
  return null;
}

let cachedMetas: ArticleMeta[] | null = null;

export async function getAllArticleMetas(): Promise<ArticleMeta[]> {
  if (cachedMetas) return cachedMetas;

  const metas: ArticleMeta[] = [];
  for (const [path, loader] of Object.entries(articleModules)) {
    const raw = await loader();
    const { meta } = parseFrontmatter(raw);
    if (!meta.slug) {
      const match = path.match(/\/([^/]+)\.md$/);
      if (match) meta.slug = match[1];
    }
    metas.push(meta);
  }
  cachedMetas = metas;
  return metas;
}

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface QuizData {
  slug: string;
  questions: QuizQuestion[];
}
