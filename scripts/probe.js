import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';

const base = process.env.APP_URL;
const token = process.env.API_TOKEN;
if (!base || !token) throw new Error('APP_URL and API_TOKEN are required');
const seconds = Number(process.env.PROBE_SECONDS || 120);
if (!Number.isFinite(seconds) || seconds < 1 || seconds > 3600) throw new Error('Invalid PROBE_SECONDS');
const deadline = Date.now() + seconds * 1000;
const measurements = [];
let pendingKey = randomUUID();
while (Date.now() < deadline) {
  const started = Date.now();
  try {
    const response = await fetch(`${base}/orders`, {
      method: 'POST', signal: AbortSignal.timeout(5000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': pendingKey },
      body: JSON.stringify({ amountCents: 1 }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const order = await response.json();
    if (order.idempotency_key !== pendingKey) throw new Error('Wrong order returned');
    measurements.push({ at: started, ms: Date.now() - started, ok: true });
    pendingKey = randomUUID();
  } catch (error) {
    measurements.push({ at: started, ms: Date.now() - started, ok: false, error: error.message });
  }
  await setTimeout(1000);
}
console.log(JSON.stringify({ intervalMs: 1000, timeoutMs: 5000, measurements }, null, 2));
if (!measurements.some(item => item.ok)) process.exitCode = 1;
