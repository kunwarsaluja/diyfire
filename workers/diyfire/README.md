# diyfire workers

This folder is organized for multiple Cloudflare Workers.

## Structure

- `rss/` - diyFIRE RSS feed worker
  - `rss/index.js` worker code
  - `rss/wrangler.toml` worker config
- `boc_feeds/` - combined BoC feeds worker (press-releases + upcoming-events)
  - `boc_feeds/index.js` worker code
  - `boc_feeds/wrangler.toml` worker config
- `boc_feed_poller/` - scheduled worker that polls BoC JSON feeds for new entries
  - `boc_feed_poller/index.js` worker code
  - `boc_feed_poller/wrangler.toml` worker config
- `contact_us/` - contact form worker forwarding submissions to Slack webhook
  - `contact_us/index.js` worker code
  - `contact_us/wrangler.toml` worker config
- `package.json` - root scripts to run/deploy each worker by config path

Add future workers as sibling folders (for example `search/`, `api/`, `redirects/`) with their own `wrangler.toml`.

## Commands

Run from `workers/diyfire`:

- `npm run dev:rss`
- `npm run deploy:rss`
- `npm run tail:rss`
- `npm run dev:boc-feeds`
- `npm run deploy:boc-feeds`
- `npm run tail:boc-feeds`
- `npm run dev:boc-feed-poller`
- `npm run deploy:boc-feed-poller`
- `npm run tail:boc-feed-poller`
- `npm run dev:contact-us`
- `npm run deploy:contact-us`
- `npm run tail:contact-us`

Default shortcuts currently point to RSS:

- `npm run dev`
- `npm run deploy`

## Route for RSS

Configure one Worker route in Cloudflare:

- `diyfire.ca/rss.xml`

Legacy paths are redirected by worker code:

- `/rss-feed` -> `/rss.xml`
- `/rss-feed.xml` -> `/rss.xml`
