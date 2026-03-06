# Bank of Canada Feed Poller Worker

This worker checks both normalized BoC JSON feeds on a schedule:

- `https://diyfire-boc-feeds.kunwarsaluja.workers.dev/feed/boc/press-releases`
- `https://diyfire-boc-feeds.kunwarsaluja.workers.dev/feed/boc/upcoming-events`

When new items are detected, it:

1. logs detected updates,
2. calls a refresh URL (currently feed URL; can be replaced later),
3. sends a boilerplate payload to an optional preview/publish API.

## Routes and triggers

- Scheduled trigger: once daily at 00:00 UTC (`0 0 * * *`)
- Manual run endpoint: `GET /run`
- Health endpoint: `GET /health`

## Local dev

From `workers/diyfire`:

```bash
npm run dev:boc-feed-poller
```

Then manually trigger:

```bash
curl "http://127.0.0.1:8787/run"
```

## Deploy

From `workers/diyfire`:

```bash
npm run deploy:boc-feed-poller
```

## Optional persistent state with KV

Without KV, new-entry detection resets between isolates/runs.

To persist state:

1. Create namespace:
   ```bash
   wrangler kv namespace create "STATE_KV"
   ```
2. Add to `boc_feed_poller/wrangler.toml`:
   ```toml
   [[kv_namespaces]]
   binding = "STATE_KV"
   id = "<your-namespace-id>"
   ```

## Future preview/publish integration

The worker already includes boilerplate for a future API call:

- `PREVIEW_PUBLISH_API_URL` (var in `wrangler.toml`)
- `PREVIEW_PUBLISH_API_TOKEN` (set via `wrangler secret put PREVIEW_PUBLISH_API_TOKEN`)

When configured, each new-entry batch is POSTed as JSON payload for downstream
preview/publish processing.
