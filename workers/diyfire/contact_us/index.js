const ALLOWED_ORIGINS = new Set([
  'https://main--diyfire--kunwarsaluja.aem.page',
  'https://main--diyfire--kunwarsaluja.aem.live',
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

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    if (!origin || !ALLOWED_ORIGINS.has(origin)) {
      return new Response('Origin not allowed', { status: 403 });
    }

    const corsHeaders = getCorsHeaders(origin);

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

    const { name, message } = body || {};
    if (!name || !message) {
      return new Response('Missing fields', { status: 400, headers: corsHeaders });
    }

    const payload = {
      text: `📩 New Contact Form Submission\n*Name:* ${name}\n*Message:* ${message}`,
    };

    const webhookResponse = await fetch(env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return new Response('OK', {
      status: webhookResponse.ok ? 200 : 500,
      headers: corsHeaders,
    });
  },
};
