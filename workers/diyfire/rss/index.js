const CACHE_DURATION = 300; // 5 minutes
const QUERY_INDEX_URL = 'https://main--diyfire--kunwarsaluja.aem.live/query-index.json';
const SITE_BASE_URL = 'https://diyfire.ca';
const FEED_PATH = '/rss.xml';
const LEGACY_FEED_PATHS = ['/rss-feed', '/rss-feed.xml'];
const FEED_TITLE = 'diyFIRE Articles';
const FEED_DESCRIPTION = 'Latest diyFIRE article updates';
const DEFAULT_AUTHOR = 'diyFIRE';
const DEFAULT_ITEM_LIMIT = 20;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === FEED_PATH) {
      return generateRss(request, ctx);
    }

    if (LEGACY_FEED_PATHS.includes(url.pathname)) {
      return Response.redirect(`${url.origin}${FEED_PATH}`, 301);
    }

    return new Response('Not Found', { status: 404 });
  },
};

async function generateRss(request, ctx) {
  const cache = /** @type {any} */ (globalThis.caches)['default'];
  const cacheKey = new Request(request.url, request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const articles = await fetchArticles();
  const xml = createRssXml(articles, request.url);

  const response = new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': `public, max-age=${CACHE_DURATION}`,
      'Access-Control-Allow-Origin': '*',
    },
  });

  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

async function fetchArticles() {
  const api = new URL(QUERY_INDEX_URL);
  api.searchParams.set('offset', '0');
  api.searchParams.set('limit', '200');

  const response = await fetch(api.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch query index: ${response.status}`);
  }

  const json = await response.json();
  const entries = Array.isArray(json?.data) ? json.data : [];

  return entries
    .filter((entry) => entry?.template === 'article')
    .filter((entry) => typeof entry?.path === 'string' && entry.path.startsWith('/'))
    .sort((a, b) => getTimestamp(b) - getTimestamp(a))
    .slice(0, DEFAULT_ITEM_LIMIT);
}

function createRssXml(articles, requestUrl) {
  const selfUrl = new URL(requestUrl);
  const rssSelfUrl = `${selfUrl.origin}${FEED_PATH}`;
  const lastBuildDate = new Date().toUTCString();

  const itemsXml = articles
    .map((entry) => {
      const path = normalizePath(entry.path);
      const link = `${SITE_BASE_URL}${path}`;
      const title = entry.title?.trim() || path;
      const description = entry.description?.trim() || '';
      const authorName = entry.author?.trim() || DEFAULT_AUTHOR;
      const pubDate = new Date(getTimestamp(entry) * 1000).toUTCString();
      const imageUrl = absoluteImageUrl(entry.image);
      const imageType = guessImageType(imageUrl);

      return `
<item>
  <title><![CDATA[${title}]]></title>
  <link>${escapeXml(link)}</link>
  <guid isPermaLink="true">${escapeXml(link)}</guid>
  <pubDate>${pubDate}</pubDate>
  <description><![CDATA[${description}]]></description>
  <author>${escapeXml(`diyfire12@gmail.com (${authorName})`)}</author>
  ${imageUrl ? `<enclosure url="${escapeXml(imageUrl)}" length="0" type="${escapeXml(imageType)}"/>` : ''}
</item>`.trim();
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(FEED_TITLE)}</title>
    <link>${escapeXml(SITE_BASE_URL)}</link>
    <description>${escapeXml(FEED_DESCRIPTION)}</description>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <language>en-ca</language>
    <generator>diyFIRE RSS Worker</generator>
    <atom:link href="${escapeXml(rssSelfUrl)}" rel="self" type="application/rss+xml"/>
    ${itemsXml}
  </channel>
</rss>`;
}

function getTimestamp(entry) {
  const dateField = Number(entry?.date);
  if (Number.isFinite(dateField) && dateField > 0) return dateField;

  const modifiedField = Number(entry?.lastModified);
  if (Number.isFinite(modifiedField) && modifiedField > 0) return modifiedField;

  return Math.floor(Date.now() / 1000);
}

function normalizePath(path) {
  return path === '/' ? '/' : path.replace(/\/+$/, '');
}

function absoluteImageUrl(imagePath) {
  if (!imagePath || typeof imagePath !== 'string') return '';
  if (!imagePath.startsWith('/')) return '';
  return `${SITE_BASE_URL}${imagePath}`;
}

function guessImageType(url) {
  const input = (url || '').toLowerCase();
  if (input.includes('.png')) return 'image/png';
  if (input.includes('.webp')) return 'image/webp';
  if (input.includes('.gif')) return 'image/gif';
  return 'image/jpeg';
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
