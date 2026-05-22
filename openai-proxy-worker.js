const DEFAULT_ALLOWED_ORIGIN = 'https://lrl-coder.github.io';
const DEFAULT_MODEL = 'gpt-5-nano';

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(init.headers || {}),
    },
  });
}

function parseAllowedOrigins(env) {
  return (env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN)
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
}

function isOriginAllowed(origin, allowedOrigins) {
  return !origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin);
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = parseAllowedOrigins(env);
  const allowOrigin = allowedOrigins.includes('*') ? '*' : origin;

  return {
    'Access-Control-Allow-Origin': isOriginAllowed(origin, allowedOrigins) ? allowOrigin : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  return JSON.parse(match[0]);
}

export default {
  async fetch(request, env) {
    const headers = corsHeaders(request, env);
    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = parseAllowedOrigins(env);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    if (request.method !== 'POST' || url.pathname !== '/analyze') {
      return json({ error: 'Not found' }, { status: 404, headers });
    }

    if (!isOriginAllowed(origin, allowedOrigins)) {
      return json({ error: 'Origin is not allowed' }, { status: 403, headers });
    }

    if (!env.OPENAI_API_KEY) {
      return json({ error: 'OPENAI_API_KEY is not configured' }, { status: 500, headers });
    }

    let image;
    try {
      const body = await request.json();
      image = body.image;
    } catch {
      return json({ error: 'Invalid JSON body' }, { status: 400, headers });
    }

    if (typeof image !== 'string' || !image.startsWith('data:image/')) {
      return json({ error: 'Request body must include a data URL image' }, { status: 400, headers });
    }

    try {
      const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: env.OPENAI_MODEL || DEFAULT_MODEL,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'text',
                text: `你是营养师。识别照片中的食物，只输出一行JSON，不要解释。

正确示例：{"food":"红烧牛肉面","amount":"一大碗","calories":550,"mealType":"lunch"}

food: 完整菜名
amount: 一小碗/一大盘/两个/一杯/一块/一串
calories: 千卡。主食200-500 肉类200-400 蔬菜20-80 汤50-200 甜点150-500 饮品5-400 水果50-150 火锅500-900
mealType: breakfast/lunch/dinner/snack/supper`,
              },
              { type: 'image_url', image_url: { url: image } },
            ],
          }],
          max_completion_tokens: 800,
        }),
      });

      if (!openaiResp.ok) {
        const errorText = await openaiResp.text();
        return json({ error: 'OpenAI request failed', detail: errorText }, { status: openaiResp.status, headers });
      }

      const data = await openaiResp.json();
      const text = data.choices?.[0]?.message?.content || '';
      const result = extractJson(text);

      if (!result?.food) {
        return json({ error: 'OpenAI returned an unexpected format' }, { status: 502, headers });
      }

      return json({
        food: result.food,
        amount: result.amount || '一份',
        calories: Number(result.calories) || 200,
        mealType: ['breakfast', 'lunch', 'snack', 'dinner', 'supper'].includes(result.mealType)
          ? result.mealType
          : 'lunch',
      }, { headers });
    } catch (error) {
      return json({ error: 'Proxy request failed', detail: error.message }, { status: 500, headers });
    }
  },
};
