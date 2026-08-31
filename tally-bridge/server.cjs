const http = require('http');

const HOST = process.env.BRIDGE_HOST || '127.0.0.1';
const PORT = Number(process.env.BRIDGE_PORT || 8787);
const TALLY_URL = process.env.TALLY_URL || 'http://127.0.0.1:9000';
const BRIDGE_TOKEN = process.env.BRIDGE_TOKEN || '';
const MAX_BODY = 10 * 1024 * 1024;

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': process.env.ALLOW_ORIGIN || '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Bridge-Token, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });
  res.end(JSON.stringify(body));
}

function authorized(req) {
  if (!BRIDGE_TOKEN) return true;
  const header = req.headers['x-bridge-token'] || '';
  const auth = req.headers.authorization || '';
  return header === BRIDGE_TOKEN || auth === `Bearer ${BRIDGE_TOKEN}`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > MAX_BODY) {
        req.destroy();
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});

  if (req.method === 'GET' && req.url === '/health') {
    return send(res, 200, { ok: true, service: 'tally-bridge', tallyUrl: TALLY_URL });
  }

  if (req.method !== 'POST' || req.url !== '/tally') {
    return send(res, 404, { ok: false, error: 'Not found' });
  }

  if (!authorized(req)) {
    return send(res, 401, { ok: false, error: 'Unauthorized bridge token' });
  }

  try {
    const raw = await readBody(req);
    const contentType = req.headers['content-type'] || '';
    let xml = raw;
    if (contentType.includes('application/json')) {
      const parsed = JSON.parse(raw || '{}');
      xml = parsed.xml || '';
    }

    if (!xml || !xml.trim()) return send(res, 400, { ok: false, error: 'XML is required' });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(TALLY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
        body: xml,
        signal: controller.signal
      });
      const responseXml = await response.text();
      clearTimeout(timer);
      return send(res, 200, {
        ok: true,
        tallyStatus: response.status,
        xml: responseXml
      });
    } catch (err) {
      clearTimeout(timer);
      return send(res, 502, {
        ok: false,
        error: `Cannot connect to Tally at ${TALLY_URL}: ${err.message}`
      });
    }
  } catch (err) {
    return send(res, 400, { ok: false, error: err.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Tally Bridge listening on http://${HOST}:${PORT}`);
  console.log(`Forwarding to Tally: ${TALLY_URL}`);
  console.log(BRIDGE_TOKEN ? 'Bridge token authentication: ENABLED' : 'WARNING: Bridge token authentication: DISABLED');
});
