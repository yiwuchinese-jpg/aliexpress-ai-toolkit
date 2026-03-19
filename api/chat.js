export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiBase = process.env.OPENAI_BASE_URL;
  const apiKey = process.env.OPENAI_API_KEY;
  const defaultModel = process.env.OPENAI_MODEL || 'gpt-5.4';

  if (!apiBase || !apiKey) {
    return res.status(500).json({
      error: 'Server configuration missing',
      message: 'Please set OPENAI_BASE_URL and OPENAI_API_KEY in Vercel environment variables.'
    });
  }

  try {
    const { prompt, pool, model } = req.body || {};

    if (!prompt || !pool) {
      return res.status(400).json({ error: 'Missing prompt or pool' });
    }

    const upstream = await fetch(`${apiBase.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || defaultModel,
        messages: [
          {
            role: 'user',
            content: `P10专家模式。产品：${prompt}\n词库：${pool}\n返回JSON: {cores:[], scenes:[], attrs:[], titles:[]}`
          }
        ],
        response_format: { type: 'json_object' }
      })
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: 'Upstream request failed',
        details: data
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      error: 'Proxy request failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
