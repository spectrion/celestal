'use strict';
const https = require('https');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age':       '86400',
};

const SYSTEM_PROMPT = `You are Dolores, the AI assistant built into BlueNebula — a futuristic browser and platform. You have a warm, helpful, slightly mysterious personality that fits the space/nebula aesthetic of BlueNebula.

You help users with:
- Browsing the web through BlueNebula's Celestial proxy
- Using the Game Panel apps (games, VMs, NebulaChat)
- General questions and tasks
- Coding help
- Creative writing
- Anything else they need

Keep responses concise and natural. You can use markdown. Don't be overly formal — you're part of the BlueNebula experience. You exist within the BlueNebula platform, accessed through the Game Panel.`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method not allowed' };

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 503,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Dolores is not configured. Add OPENROUTER_API_KEY to Netlify environment variables.' }),
    };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const messages = body.messages || [];
  const model    = body.model || 'anthropic/claude-3.5-haiku'; // fast + cheap default
  const stream   = false; // Netlify functions don't support streaming responses well

  const fullMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.slice(-20), // keep last 20 messages for context
  ];

  const requestBody = JSON.stringify({
    model,
    messages: fullMessages,
    max_tokens: 1024,
    temperature: 0.8,
    stream,
  });

  try {
    const response = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'openrouter.ai',
        path: '/api/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization':       `Bearer ${apiKey}`,
          'Content-Type':        'application/json',
          'Content-Length':      Buffer.byteLength(requestBody),
          'HTTP-Referer':        'https://bluenebula.netlify.app',
          'X-Title':             'BlueNebula - Dolores AI',
        },
        timeout: 30000,
      }, res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end',  () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
        res.on('error', reject);
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      req.write(requestBody);
      req.end();
    });

    if (response.status !== 200) {
      return {
        statusCode: response.status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: response.body,
      };
    }

    const data = JSON.parse(response.body);
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: data.choices?.[0]?.message?.content || '',
        model:   data.model || model,
        usage:   data.usage || {},
      }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};