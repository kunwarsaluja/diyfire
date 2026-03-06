# Bank of Canada Combined Feeds Worker

Single worker that normalizes both BoC feeds and exposes list/detail JSON.

## Feed types

- `press-releases`
- `upcoming-events`

## Endpoints

- List:
  - `/feed/boc/press-releases`
  - `/feed/boc/upcoming-events`
  - `/api/boc/press-releases`
  - `/api/boc/upcoming-events`
- Detail:
  - `/feed/boc/press-releases/:id`
  - `/feed/boc/upcoming-events/:id`
  - `/api/boc/press-releases/:id`
  - `/api/boc/upcoming-events/:id`

Each item includes a stable unique `id` (`date + slug + short hash`) so detail
routes are collision-safe even when two items share the same date.

## Local dev

From `workers/diyfire`:

```bash
npm run dev:boc-feeds
```

## Deploy

From `workers/diyfire`:

```bash
npm run deploy:boc-feeds
```
