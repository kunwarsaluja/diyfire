const CACHE_SECONDS = 900;

const FEEDS = {
  'press-releases': {
    source: 'https://www.bankofcanada.ca/content_type/press-releases/feed/',
    fallbackSlug: 'press-release',
    itemLabel: 'press release',
  },
  'upcoming-events': {
    source: 'https://www.bankofcanada.ca/content_type/upcoming-events/feed/',
    fallbackSlug: 'event',
    itemLabel: 'upcoming event',
  },
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const route = parseRoute(url.pathname);
    if (!route) {
      return jsonResponse({ error: 'Not Found' }, 404);
    }

    const cache = /** @type {any} */ (globalThis.caches)['default'];
    const cacheKey = new Request(url.toString(), request);
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    const feedConfig = FEEDS[route.feedType];
    if (!feedConfig) {
      return jsonResponse({ error: 'Unsupported feed type' }, 404);
    }

    try {
      const xmlResponse = await fetch(feedConfig.source, {
        headers: {
          Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
        },
      });

      if (!xmlResponse.ok) {
        return jsonResponse(
          {
            error: 'Failed to fetch upstream feed',
            status: xmlResponse.status,
            feedType: route.feedType,
          },
          502,
        );
      }

      const xml = await xmlResponse.text();
      const transformed = transformFeed(xml, feedConfig);
      const responseBody = route.id
        ? getDetailResponse(transformed, decodeURIComponent(route.id), feedConfig.itemLabel)
        : transformed;
      const status = route.id && responseBody.error ? 404 : 200;

      const response = jsonResponse(responseBody, status, {
        'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
      });
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    } catch (error) {
      return jsonResponse(
        {
          error: 'Unexpected worker error',
          message: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  },
};

function parseRoute(pathname) {
  if (pathname === '/' || pathname === '/health') {
    return { feedType: 'press-releases', id: '' };
  }

  const listMatch = pathname.match(/^\/(?:api|feed)\/boc\/([^/]+)\/?$/);
  if (listMatch) {
    return { feedType: listMatch[1], id: '' };
  }

  const detailMatch = pathname.match(/^\/(?:api|feed)\/boc\/([^/]+)\/([^/]+)\/?$/);
  if (detailMatch) {
    return { feedType: detailMatch[1], id: detailMatch[2] };
  }

  return null;
}

function transformFeed(xml, feedConfig) {
  const channelBlock = firstMatch(xml, /<channel[\s\S]*?>([\s\S]*?)<\/channel>/i) || '';
  const channel = {
    title: extractTag(channelBlock, 'title'),
    link: extractTag(channelBlock, 'link'),
    description: extractTag(channelBlock, 'description'),
    language: extractTag(channelBlock, 'dc:language'),
    updatedAt: extractTag(channelBlock, 'dc:date'),
  };

  const items = [];
  const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let match = itemRegex.exec(xml);
  while (match) {
    const itemBlock = match[1] || '';
    const item = {
      title: extractTag(itemBlock, 'title'),
      link: extractTag(itemBlock, 'link'),
      description: extractTag(itemBlock, 'description'),
      publishedAt: extractTag(itemBlock, 'dc:date'),
      occurrenceDate: extractTag(itemBlock, 'cb:occurrenceDate'),
      simpleTitle: extractTag(itemBlock, 'cb:simpleTitle'),
      guid: extractTag(itemBlock, 'guid'),
    };
    items.push({
      ...item,
      id: buildItemId(item, feedConfig.fallbackSlug),
    });
    match = itemRegex.exec(xml);
  }

  return {
    source: feedConfig.source,
    fetchedAt: new Date().toISOString(),
    channel,
    total: items.length,
    data: items,
  };
}

function getDetailResponse(feed, requestedId, itemLabel) {
  const entry = Array.isArray(feed.data) ? feed.data.find((item) => item.id === requestedId) : null;
  if (!entry) {
    return {
      error: `No ${itemLabel} found for id "${requestedId}"`,
      id: requestedId,
      total: feed.total || 0,
    };
  }
  return {
    source: feed.source,
    fetchedAt: feed.fetchedAt,
    channel: feed.channel,
    ...entry,
  };
}

function buildItemId(item, fallbackSlug) {
  const datePart = normalizeDate(item.occurrenceDate || item.publishedAt);
  const titleSlug = slugify(item.simpleTitle || item.title || fallbackSlug);
  const stableSource = item.guid || item.link || `${item.occurrenceDate}|${item.title}`;
  const hash = stableHash(stableSource).slice(0, 8);
  return `${datePart}-${titleSlug}-${hash}`;
}

function normalizeDate(value) {
  const raw = String(value || '').trim();
  const dateMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) return dateMatch[1];
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return 'undated';
}

function slugify(value) {
  return (
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'item'
  );
}

function stableHash(value) {
  let hash = 2166136261;
  const input = String(value || '');
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function extractTag(input, tagName) {
  const escaped = tagName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const value = firstMatch(input, new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)</${escaped}>`, 'i'));
  return decodeXml(value || '').trim();
}

function firstMatch(input, regex) {
  const match = regex.exec(input);
  return match ? match[1] : '';
}

function decodeXml(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      ...extraHeaders,
    },
  });
}
