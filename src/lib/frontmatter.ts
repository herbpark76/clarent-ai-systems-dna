export interface ArticleMeta {
  slug: string;
  title: string;
  category: string;
  readTime: string;
  description: string;
  concepts: string[];
  updated: string;
  track: string;
}

export interface ParsedArticle {
  meta: ArticleMeta;
  body: string;
}

export function parseFrontmatter(raw: string): ParsedArticle {
  const lines = raw.split('\n');
  if (lines.length === 0 || lines[0].trim() !== '---') {
    return { meta: emptyMeta(), body: raw };
  }

  const fmLines: string[] = [];
  let i = 1;
  while (i < lines.length && lines[i].trim() !== '---') {
    fmLines.push(lines[i]);
    i++;
  }
  i++;

  const body = lines.slice(i).join('\n').trim();
  const meta = parseYaml(fmLines);
  return { meta, body };
}

function emptyMeta(): ArticleMeta {
  return {
    slug: '',
    title: '',
    category: '',
    readTime: '',
    description: '',
    concepts: [],
    updated: '',
    track: '',
  };
}

function parseYaml(fmLines: string[]): ArticleMeta {
  const meta = emptyMeta();

  for (const line of fmLines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();

    switch (key) {
      case 'slug':
        meta.slug = value;
        break;
      case 'title':
        meta.title = value;
        break;
      case 'category':
        meta.category = value;
        break;
      case 'readTime':
        meta.readTime = value;
        break;
      case 'description':
        meta.description = value;
        break;
      case 'updated':
        meta.updated = value;
        break;
      case 'concepts':
        meta.concepts = parseListValue(value);
        break;
      case 'track':
        meta.track = value;
        break;
      default:
        break;
    }
  }

  return meta;
}

function parseListValue(value: string): string[] {
  if (!value) return [];
  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}
