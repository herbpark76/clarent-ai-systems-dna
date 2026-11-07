#!/usr/bin/env node
// Generates public/sitemap.xml at build time.
// Lists: homepage, /signal-desk, every /articles/* route, every /concepts/* route,
// and every PUBLISHED Signal Desk entry from the database (with lastmod from entry date).
// Uses the public anon key — read-only, no service role.
// If the database is unreachable, still emits a sitemap with the static routes.

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SITE_ORIGIN = 'https://aisystems.clarenttech.com';

function loadEnv() {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) return {};
  const env = {};
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    env[key] = value;
  }
  return env;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toW3CDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

function getArticleSlugs() {
  const dir = join(ROOT, 'content', 'articles');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''));
}

function getConceptIds() {
  const file = join(ROOT, 'src', 'data', 'concepts.ts');
  if (!existsSync(file)) return [];
  const content = readFileSync(file, 'utf-8');
  const ids = [];
  const regex = /id:\s*'([^']+)'/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    ids.push(match[1]);
  }
  return ids;
}

async function getPublishedEntries(env) {
  const url = env.VITE_SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return [];

  const supabase = createClient(url, anonKey);
  const { data, error } = await supabase
    .from('signal_desk_entries')
    .select('slug, created_at, source_date')
    .eq('status', 'published')
    .in('duplicate_status', ['none', 'separate'])
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[sitemap] DB query failed, skipping Signal Desk entries:', error.message);
    return [];
  }
  return (data || []).filter((e) => e.slug);
}

async function main() {
  const env = loadEnv();
  const today = new Date().toISOString().split('T')[0];
  const urls = [];

  // Homepage
  urls.push({ loc: `${SITE_ORIGIN}/`, lastmod: today, priority: '1.0' });

  // Signal Desk landing
  urls.push({ loc: `${SITE_ORIGIN}/signal-desk`, lastmod: today, priority: '0.8' });

  // Static pages
  urls.push({ loc: `${SITE_ORIGIN}/labs`, lastmod: today, priority: '0.6' });
  urls.push({ loc: `${SITE_ORIGIN}/use-cases`, lastmod: today, priority: '0.6' });
  urls.push({ loc: `${SITE_ORIGIN}/models`, lastmod: today, priority: '0.6' });
  urls.push({ loc: `${SITE_ORIGIN}/risk`, lastmod: today, priority: '0.6' });

  // Article routes
  for (const slug of getArticleSlugs()) {
    urls.push({ loc: `${SITE_ORIGIN}/articles/${slug}`, lastmod: today, priority: '0.7' });
  }

  // Concept routes
  for (const id of getConceptIds()) {
    urls.push({ loc: `${SITE_ORIGIN}/concepts/${id}`, lastmod: today, priority: '0.7' });
  }

  // Published Signal Desk entries from DB
  const entries = await getPublishedEntries(env);
  for (const entry of entries) {
    const lastmod = toW3CDate(entry.source_date) || toW3CDate(entry.created_at) || today;
    urls.push({ loc: `${SITE_ORIGIN}/signal-desk/${entry.slug}`, lastmod, priority: '0.6' });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url>\n    <loc>${escapeXml(u.loc)}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <priority>${u.priority}</priority>\n  </url>`,
  )
  .join('\n')}
</urlset>
`;

  const outDir = join(ROOT, 'public');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'sitemap.xml'), xml, 'utf-8');
  console.log(`[sitemap] Generated sitemap.xml with ${urls.length} URLs`);
}

main().catch((err) => {
  console.error('[sitemap] Failed:', err);
  process.exit(1);
});
