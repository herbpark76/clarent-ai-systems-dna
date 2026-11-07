// Centralized per-route meta tag manager.
// Sets canonical, description, Open Graph, Twitter, and robots tags at runtime
// so every page points to its own URL instead of the homepage.

const SITE_ORIGIN = 'https://aisystems.clarenttech.com';
const SITE_NAME = 'AI Systems DNA';
const DEFAULT_TITLE = 'AI Systems DNA — Learn How Modern AI Systems Are Built';
const DEFAULT_DESCRIPTION =
  'An interactive map of the 25 core concepts behind production AI — LLMs, RAG, agents, MCP, evaluation, and orchestration — with learning paths from beginner to architect.';
const DEFAULT_IMAGE = `${SITE_ORIGIN}/og-image.png`;

type MetaInput = {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  type?: 'website' | 'article';
  noindex?: boolean;
};

function setMetaByName(name: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setMetaByProperty(property: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function removeMetaByName(name: string) {
  document.head.querySelector(`meta[name="${name}"]`)?.remove();
}

export function setPageMeta(input: MetaInput = {}) {
  const title = input.title || DEFAULT_TITLE;
  const description = input.description || DEFAULT_DESCRIPTION;
  const path = input.path || '/';
  const url = `${SITE_ORIGIN}${path}`;
  const image = input.image || DEFAULT_IMAGE;
  const type = input.type || 'website';

  document.title = title.includes('AI Systems DNA') ? title : `${title} | ${SITE_NAME}`;

  setCanonical(url);
  setMetaByName('description', description);

  setMetaByProperty('og:type', type);
  setMetaByProperty('og:site_name', SITE_NAME);
  setMetaByProperty('og:title', title);
  setMetaByProperty('og:description', description);
  setMetaByProperty('og:url', url);
  setMetaByProperty('og:image', image);

  setMetaByName('twitter:card', 'summary_large_image');
  setMetaByName('twitter:title', title);
  setMetaByName('twitter:description', description);
  setMetaByName('twitter:image', image);

  if (input.noindex) {
    setMetaByName('robots', 'noindex, nofollow');
  } else {
    removeMetaByName('robots');
  }
}

export function resetPageMeta() {
  setPageMeta({});
}
