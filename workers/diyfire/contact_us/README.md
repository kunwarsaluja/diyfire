# Contact Us Worker

Cloudflare Worker that accepts contact form POSTs and forwards them to a Slack
incoming webhook.

## Endpoint behavior

- `OPTIONS` -> CORS preflight (`204`)
- `POST` -> validates `name` and `message`, posts to Slack webhook
- other methods -> `405`

Expected POST body:

```json
{
  "name": "Jane Doe",
  "message": "I have a question about..."
}
```

## Required secret

This worker expects the secret:

- `SLACK_WEBHOOK_URL`

Set/update it with:

```bash
wrangler secret put SLACK_WEBHOOK_URL --config ./contact_us/wrangler.toml
```

## Local dev

From `workers/diyfire`:

```bash
npm run dev:contact-us
```

## Deploy

From `workers/diyfire`:

```bash
npm run deploy:contact-us
```
