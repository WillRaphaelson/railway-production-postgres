import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { createPool, createOrder } from './db.js';

const pool = createPool();
const token = process.env.API_TOKEN;
if (!token) throw new Error('API_TOKEN is required');
function authorized(request) {
  const actual = Buffer.from(request.headers.authorization || '');
  const expected = Buffer.from(`Bearer ${token}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
const server = http.createServer(async (request, response) => {
  const send = (status, body) => {
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(body));
  };
  try {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (request.method === 'GET' && path === '/health') {
      await pool.query('SELECT 1');
      return send(200, { status: 'ok' });
    }
    if (!authorized(request)) return send(401, { error: 'Bearer token required' });
    if (request.method === 'GET' && path === '/orders') {
      const { rows } = await pool.query('SELECT * FROM orders ORDER BY id DESC LIMIT 100');
      return send(200, { orders: rows });
    }
    if (request.method === 'POST' && path === '/orders') {
      const key = request.headers['idempotency-key'];
      if (typeof key !== 'string' || key.length < 1 || key.length > 128) {
        return send(400, { error: 'Idempotency-Key must contain 1 to 128 characters' });
      }
      let body = '';
      for await (const chunk of request) {
        body += chunk;
        if (Buffer.byteLength(body) > 4096) return send(413, { error: 'Request too large' });
      }
      let parsed;
      try { parsed = JSON.parse(body); } catch { return send(400, { error: 'Invalid JSON' }); }
      const amount = parsed?.amountCents;
      if (!Number.isSafeInteger(amount) || amount < 1 || amount > 2147483647) {
        return send(400, { error: 'amountCents must be a positive PostgreSQL integer' });
      }
      // Clients can retry a failed request using the same key and amount.
      return send(200, await createOrder(pool, key, amount));
    }
    send(404, { error: 'Not found' });
  } catch (error) {
    console.error('Request failed', error.code || error.status || error.name);
    if (error.status === 409) return send(409, { error: error.message });
    send(503, { error: 'Database temporarily unavailable; retry with the same idempotency key' });
  }
});
server.requestTimeout = 15000;
server.listen(Number(process.env.PORT || 3000), '0.0.0.0');
async function shutdown() {
  server.close(async () => { await pool.end(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
