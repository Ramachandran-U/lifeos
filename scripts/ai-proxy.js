#!/usr/bin/env node
/**
 * Local AI proxy — shells to the `claude` CLI so the web app can use your
 * Claude Code subscription instead of the paid API.
 *
 * Run: node scripts/ai-proxy.js
 * Expo web app POSTs to http://localhost:8787/ai
 */
const http = require('http');
const { spawn } = require('child_process');

const PORT = Number(process.env.AI_PROXY_PORT || 8787);
const MODEL = process.env.AI_PROXY_MODEL || 'haiku'; // cheapest of the CLI-available models

function callClaudeCLI(prompt) {
  return new Promise((resolve, reject) => {
    const args = ['--print', '--model', MODEL];
    const child = spawn('claude', args, { shell: true });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));

    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`claude exit ${code}: ${stderr.slice(0, 500)}`));
      resolve(stdout.trim());
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

const JSON_REINFORCEMENT =
  '\n\nCRITICAL OUTPUT RULES: Respond with ONLY a raw JSON value. Your FIRST character must be `{` or `[`. No markdown fences, no ```json, no prose, no explanations, no preamble. Just JSON.';

function wantsJson(system) {
  if (!system) return false;
  return /\bJSON\b|schema|output:/i.test(system);
}

function buildPrompt({ system, messages }) {
  const parts = [];
  const effectiveSystem = wantsJson(system) ? system + JSON_REINFORCEMENT : system;
  if (effectiveSystem) parts.push(`System: ${effectiveSystem}`);
  for (const m of messages) {
    parts.push(`${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`);
  }
  parts.push('Assistant:');
  return parts.join('\n\n');
}

function sanitizeJsonReply(text) {
  // Strip ```json ... ``` fences
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  // Slice from first { or [ to last } or ]
  const firstObj = text.indexOf('{');
  const firstArr = text.indexOf('[');
  const starts = [firstObj, firstArr].filter((i) => i !== -1);
  if (starts.length === 0) return text;
  const start = Math.min(...starts);
  const openCh = text[start];
  const closeCh = openCh === '{' ? '}' : ']';
  const end = text.lastIndexOf(closeCh);
  if (end === -1 || end < start) return text;
  return text.slice(start, end + 1);
}

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, model: MODEL }));
    return;
  }

  if (req.method !== 'POST' || req.url !== '/ai') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', async () => {
    try {
      const payload = JSON.parse(body);
      const prompt = buildPrompt(payload);
      const started = Date.now();
      let text = await callClaudeCLI(prompt);
      const ms = Date.now() - started;
      console.log(`[ai-proxy] ${ms}ms · prompt ${prompt.length}ch · reply ${text.length}ch`);
      console.log(`[ai-proxy] raw preview: ${text.slice(0, 300).replace(/\n/g, ' ⏎ ')}`);

      if (wantsJson(payload.system)) {
        text = sanitizeJsonReply(text);
        console.log(`[ai-proxy] sanitized preview: ${text.slice(0, 200).replace(/\n/g, ' ⏎ ')}`);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ text }));
    } catch (err) {
      console.error('[ai-proxy] error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`[ai-proxy] listening on http://localhost:${PORT}  (model: ${MODEL})`);
  console.log(`[ai-proxy] set EXPO_PUBLIC_AI_PROXY_URL=http://localhost:${PORT}/ai in .env`);
});
