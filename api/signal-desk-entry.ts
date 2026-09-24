// Vercel serverless function: server-rendered HTML with og tags for link-preview bots.
// Requests to /signal-desk/:slug from bots (LinkedInBot, Slackbot, Twitterbot, facebookexternalhit)
// get this SSR HTML instead of the SPA's index.html.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const BOT_USER_AGENTS = ['linkedinbot', 'slackbot', 'twitterbot', 'facebookexternalhit', 'facebot'];

function isBot(userAgent: string): boolean {
  const ua = (userAgent || '').toLowerCase();
  return BOT_USER_AGENTS.some((bot) => ua.includes(bot));
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function fetchEntryBySlug(slug: string): Promise<any | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/signal_desk_entries?slug=eq.${encodeURIComponent(slug)}&status=eq.published&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  } catch {
    return null;
  }
}

function renderEntryHtml(entry: any, origin: string): string {
  const title = `${entry.title} — AI Systems DNA`;
  const description = entry.summary || '';
  const url = `${origin}/signal-desk/${entry.slug}`;
  const ogImage = `${origin}/og-image.png`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${escapeHtml(url)}" />
<meta property="og:type" content="article" />
<meta property="og:image" content="${escapeHtml(ogImage)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(ogImage)}" />
<link rel="icon" href="/favicon.svg" />
</head>
<body>
<script>window.location.replace("${escapeHtml(url)}");</script>
<p>Redirecting to <a href="${escapeHtml(url)}">${escapeHtml(title)}</a></p>
</body>
</html>`;
}

export default async function handler(req: any, res: any) {
  const slug = req.query.slug || (req.url || '').match(/\/signal-desk\/([^/?]+)/)?.[1] || '';
  const userAgent = req.headers['user-agent'] || '';

  if (!slug || !isBot(userAgent)) {
    // Not a bot or no slug — let the SPA handle it
    res.status(404).json({ error: 'Not a bot request' });
    return;
  }

  const entry = await fetchEntryBySlug(slug);
  if (!entry) {
    res.status(404).setHeader('Content-Type', 'text/html').send('<!DOCTYPE html><html><head><title>Page not found — AI Systems DNA</title></head><body><p>Page not found</p></body></html>');
    return;
  }

  const origin = `https://${req.headers.host || 'aisystems.clarenttech.com'}`;
  const html = renderEntryHtml(entry, origin);
  res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
}
