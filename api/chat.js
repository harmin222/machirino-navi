function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    setCORS(res);
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    setCORS(res);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = await readJson(req);
    const systemPrompt = (body.system || process.env.PERSONA_PROMPT || 'あなたは親切なアシスタントです。').slice(0, 8000);
    const userText = (body.user || '').slice(0, 4000);

    // 安全ネット：APIキー未設定ならすぐ返す
    if (!process.env.OPENAI_API_KEY) {
      setCORS(res);
      return res.status(500).json({ reply: 'サーバー側のAPIキーが未設定です。' });
    }

    const oai = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userText }
        ],
        temperature: 0.6,
        max_tokens: 300
      })
    });

    if (!oai.ok) {
      const txt = await oai.text();
      setCORS(res);
      if (txt.includes('insufficient_quota')) {
        return res.status(500).json({ reply: 'AIの利用枠が上限に達しています。OpenAIのBillingで支払い方法を設定してください。' });
      }
      return res.status(500).json({ reply: 'OpenAIでエラーが発生しました。' });
    }

    const data = await oai.json();
    const reply = data?.choices?.[0]?.message?.content?.trim() || '(返答が取得できませんでした)';
    setCORS(res);
    return res.status(200).json({ reply });
  } catch (e) {
    setCORS(res);
    return res.status(500).json({ reply: 'サーバー内部エラー：' + (e?.message || String(e)) });
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
