// ① CORS（アクセス制限）を設定する関数
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ② メインの処理
export default async function handler(req, res) {
  // (1) 確認用のOPTIONSが来たとき
  if (req.method === 'OPTIONS') {
    setCORS(res);
    return res.status(204).end(); // OK！何も返さない
  }

  // (2) POST以外は拒否
  if (req.method !== 'POST') {
    setCORS(res);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // ユーザーの入力を読み取る
    const body = await readJson(req);
    const systemPrompt = (body.system || process.env.PERSONA_PROMPT || 'あなたは親切なアシスタントです。');
    const userText = body.user || '';

    // OpenAIのAPIを呼び出す
    const oai = await fetch('https://api.openai.com/v1/chat/completions', {
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

    if (!oai.ok) {
      const txt = await oai.text();
      setCORS(res);
      return res.status(500).json({ error: 'OpenAI error', detail: txt });
    }

    const data = await oai.json();
    const reply = data?.choices?.[0]?.message?.content?.trim() || '(返答が取得できませんでした)';
    setCORS(res);
    return res.status(200).json({ reply });
  } catch (e) {
    setCORS(res);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}

// JSONを読み取るおまじない
function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch (err) { reject(err); }
