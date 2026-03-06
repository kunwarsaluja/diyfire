const DEFAULT_PRESS_FEED_URL = 'https://diyfire-boc-feeds.kunwarsaluja.workers.dev/feed/boc/press-releases';
const DEFAULT_UPCOMING_FEED_URL = 'https://diyfire-boc-feeds.kunwarsaluja.workers.dev/feed/boc/upcoming-events';
const STATE_KEY = 'boc-feed-poller-state-v1';
const MAX_STORED_IDS = 400;

const FEEDS = [
  {
    name: 'press-releases',
    endpointEnv: 'PRESS_FEED_URL',
    defaultEndpoint: DEFAULT_PRESS_FEED_URL,
    refreshEnv: 'PRESS_REFRESH_URL',
  },
  {
    name: 'upcoming-events',
    endpointEnv: 'UPCOMING_FEED_URL',
    defaultEndpoint: DEFAULT_UPCOMING_FEED_URL,
    refreshEnv: 'UPCOMING_REFRESH_URL',
  },
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return jsonResponse({
        ok: true,
        worker: 'boc-feed-poller',
        hasStateKv: Boolean(env.STATE_KV),
        now: new Date().toISOString(),
      });
    }

    if (url.pathname === '/run') {
      const result = await pollFeeds(env, ctx, 'manual');
      return jsonResponse(result);
    }

    return jsonResponse({ error: 'Not Found' }, 404);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(pollFeeds(env, ctx, 'scheduled'));
  },
};

async function pollFeeds(env, ctx, trigger) {
  const runAt = new Date().toISOString();
  const previousState = await readState(env);
  const nextState = { ...previousState, feeds: { ...(previousState.feeds || {}) } };

  const summary = [];

  for (const feedConfig of FEEDS) {
    const endpoint = env[feedConfig.endpointEnv] || feedConfig.defaultEndpoint;
    const feedResult = await pollSingleFeed(feedConfig, endpoint, previousState, env);
    nextState.feeds[feedConfig.name] = {
      lastCheckedAt: runAt,
      lastSeenIds: feedResult.currentIds.slice(0, MAX_STORED_IDS),
      lastItemAt: feedResult.latestItemAt || '',
      lastPollStatus: feedResult.error ? 'error' : 'ok',
    };
    summary.push({
      feed: feedConfig.name,
      endpoint,
      total: feedResult.total,
      newCount: feedResult.newEntries.length,
      latestItemAt: feedResult.latestItemAt || null,
      error: feedResult.error || null,
    });

    if (feedResult.newEntries.length > 0) {
      await handleNewEntries(feedConfig, feedResult.newEntries, endpoint, env, ctx, trigger);
    }
  }

  nextState.lastRunAt = runAt;
  nextState.lastTrigger = trigger;
  await writeState(env, nextState);

  return {
    ok: true,
    trigger,
    runAt,
    feeds: summary,
  };
}

async function pollSingleFeed(feedConfig, endpoint, previousState, env) {
  try {
    const response = await fetch(endpoint, {
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      return {
        total: 0,
        newEntries: [],
        currentIds: [],
        latestItemAt: '',
        error: `Failed to fetch ${feedConfig.name}: ${response.status}`,
      };
    }

    const payload = await response.json();
    const items = Array.isArray(payload?.data) ? payload.data : [];
    const currentIds = items.map(buildStableId).filter(Boolean);
    const previousIds = new Set(previousState?.feeds?.[feedConfig.name]?.lastSeenIds || []);
    const newEntries = items.filter((item) => !previousIds.has(buildStableId(item)));

    return {
      total: items.length,
      newEntries,
      currentIds,
      latestItemAt: findLatestItemDate(items),
      error: '',
    };
  } catch (error) {
    return {
      total: 0,
      newEntries: [],
      currentIds: [],
      latestItemAt: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function handleNewEntries(feedConfig, newEntries, endpoint, env, ctx, trigger) {
  const names = newEntries.slice(0, 5).map((item) => item.title || item.id || 'untitled');
  console.log(
    `[boc-feed-poller] New ${feedConfig.name} entries: ${newEntries.length}. Trigger=${trigger}. Sample=${names.join(' | ')}`,
  );

  await refreshFeedWorker(feedConfig, endpoint, env);
  await enqueuePreviewPublishBoilerplate(feedConfig, newEntries, env, ctx);
}

async function refreshFeedWorker(feedConfig, endpoint, env) {
  const refreshUrl = env[feedConfig.refreshEnv] || endpoint;
  try {
    const response = await fetch(refreshUrl, {
      headers: { 'Cache-Control': 'no-cache' },
    });
    console.log(
      `[boc-feed-poller] Refresh call for ${feedConfig.name} -> ${refreshUrl} status=${response.status}`,
    );
  } catch (error) {
    console.log(
      `[boc-feed-poller] Refresh call failed for ${feedConfig.name}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function enqueuePreviewPublishBoilerplate(feedConfig, newEntries, env, ctx) {
  if (!env.PREVIEW_PUBLISH_API_URL) {
    console.log(
      `[boc-feed-poller] PREVIEW_PUBLISH_API_URL not configured. Skipping enqueue for ${feedConfig.name}.`,
    );
    return;
  }

  const payload = {
    source: 'boc-feed-poller',
    feed: feedConfig.name,
    createdAt: new Date().toISOString(),
    total: newEntries.length,
    entries: newEntries.map((item) => ({
      id: item.id || buildStableId(item),
      title: item.title || '',
      link: item.link || '',
      occurrenceDate: item.occurrenceDate || '',
      publishedAt: item.publishedAt || '',
    })),
  };

  const headers = {
    'Content-Type': 'application/json',
  };
  if (env.PREVIEW_PUBLISH_API_TOKEN) {
    headers.Authorization = `Bearer ${env.PREVIEW_PUBLISH_API_TOKEN}`;
  }

  try {
    const response = await fetch(env.PREVIEW_PUBLISH_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    console.log(
      `[boc-feed-poller] Preview/publish boilerplate call status=${response.status} feed=${feedConfig.name}`,
    );
  } catch (error) {
    console.log(
      `[boc-feed-poller] Preview/publish boilerplate call failed feed=${feedConfig.name}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function buildStableId(item) {
  if (!item || typeof item !== 'object') return '';
  return (
    item.id ||
    item.guid ||
    item.link ||
    [item.occurrenceDate || '', item.publishedAt || '', item.title || ''].filter(Boolean).join('|')
  );
}

function findLatestItemDate(items) {
  let latest = 0;
  for (const item of items) {
    const raw = item?.publishedAt || item?.occurrenceDate || '';
    const date = Date.parse(raw);
    if (Number.isFinite(date)) latest = Math.max(latest, date);
  }
  return latest ? new Date(latest).toISOString() : '';
}

async function readState(env) {
  if (!env.STATE_KV) {
    return { feeds: {} };
  }
  try {
    const raw = await env.STATE_KV.get(STATE_KEY);
    if (!raw) return { feeds: {} };
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : { feeds: {} };
  } catch {
    return { feeds: {} };
  }
}

async function writeState(env, state) {
  if (!env.STATE_KV) return;
  await env.STATE_KV.put(STATE_KEY, JSON.stringify(state));
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
