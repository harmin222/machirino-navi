export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const body = await readJson(req);
    const systemPrompt = (body.system || process.env.PERSONA_PROMPT || 'あなたは親切なアシスタントです。').slice(0, 8000);
    const userText = (body.user || '').slice(0, 4000);

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-5-thinking',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userText }
        ],
        temperature: 0.6,
        max_tokens: 500
      })
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      return res.status(500).json({ error: 'OpenAI error', detail: errText });
    }

    const data = await openaiRes.json();
    const reply = data?.choices?.[0]?.message?.content?.trim() || '(返答が取得できませんでした)';

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({ reply });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch (err) { reject(err); }
    });
  });
}

export const config = { api: { bodyParser: false } };
