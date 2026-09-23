import { parseFrontmatter, type ArticleMeta } from './frontmatter';

const articleModules = import.meta.glob('/content/articles/*.md', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>;

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

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}
