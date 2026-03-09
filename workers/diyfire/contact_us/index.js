const ALLOWED_ORIGINS = new Set([
  'https://main--diyfire--kunwarsaluja.aem.page',
  'https://main--diyfire--kunwarsaluja.aem.live',
  'https://www.diyfire.ca',
  'https://diyfire.ca',
  'http://localhost:3000',
]);

function getCorsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function firstNonEmpty(obj, keys) {
  return keys
    .map((key) => obj?.[key])
    .find((value) => typeof value === 'string' && value.trim());
}

function formatFields(data) {
  return Object.entries(data || {})
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(([key, value]) => `*${key}:* ${String(value)}`)
    .join('\n');
}

function normalizeOrigin(originHeader) {
  if (!originHeader || typeof originHeader !== 'string') return '';
  try {
    return new URL(originHeader).origin;
  } catch {
    return '';
  }
}

export default {
  async fetch(request, env) {
    const origin = normalizeOrigin(request.headers.get('Origin'));
    const isAllowedOrigin = ALLOWED_ORIGINS.has(origin);
    const corsHeaders = isAllowedOrigin ? getCorsHeaders(origin) : { Vary: 'Origin' };

    if (!isAllowedOrigin) {
      return new Response('Origin not allowed', { status: 403, headers: corsHeaders });
    }

    try {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: corsHeaders });
      }

      if (!env.SLACK_WEBHOOK_URL) {
        return new Response('Worker not configured', { status: 500, headers: corsHeaders });
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return new Response('Invalid JSON body', { status: 400, headers: corsHeaders });
      }

      const payloadData = (body && typeof body.data === 'object' && body.data) || body || {};
      const name = firstNonEmpty(payloadData, ['name', 'fullName', 'fullname', 'firstName']);
      const email = firstNonEmpty(payloadData, ['email', 'emailAddress']);
      const message = firstNonEmpty(payloadData, ['message', 'comments', 'comment', 'details']);

      if (!name || !message) {
        return new Response('Missing fields', { status: 400, headers: corsHeaders });
      }

      const allFields = formatFields(payloadData);
      const payload = {
        text: [
          'New Contact Form Submission',
          `*Name:* ${name}`,
          email ? `*Email:* ${email}` : '',
          `*Message:* ${message}`,
          allFields ? `\n*Submitted Fields*\n${allFields}` : '',
        ].filter(Boolean).join('\n'),
      };

      let webhookResponse;
      try {
        webhookResponse = await fetch(env.SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return new Response(`Slack webhook request failed: ${reason}`, {
          status: 500,
          headers: corsHeaders,
        });
      }

      if (!webhookResponse.ok) {
        const reason = await webhookResponse.text().catch(() => '');
        return new Response(`Slack webhook rejected request (${webhookResponse.status})${reason ? `: ${reason}` : ''}`, {
          status: 500,
          headers: corsHeaders,
        });
      }

      return new Response('OK', { status: 200, headers: corsHeaders });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return new Response(`Unexpected worker error: ${reason}`, {
        status: 500,
        headers: corsHeaders,
      });
    }
  },
};
