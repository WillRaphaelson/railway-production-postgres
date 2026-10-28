import assert from 'node:assert/strict';
import { createPool } from '../src/db.js';

const [action, run] = process.argv.slice(2);
if (!['seed', 'delete', 'verify'].includes(action) || !/^[a-zA-Z0-9-]{1,60}$/.test(run || '')) {
  throw new Error('Usage: npm run drill -- seed|delete|verify RUN_ID');
}
if (action === 'delete' && process.env.ALLOW_DEMO_DELETE !== 'yes') {
  throw new Error('Set ALLOW_DEMO_DELETE=yes to delete only this run’s three demo orders');
}
const keys = [1, 2, 3].map(n => `drill-${run}-${n}`);
const pool = createPool();
try {
  if (action === 'seed') {
    await pool.query(`INSERT INTO orders (idempotency_key, amount_cents)
      SELECT k, 1000 FROM unnest($1::text[]) k ON CONFLICT DO NOTHING`, [keys]);
  }
  if (action === 'delete') {
    const result = await pool.query('DELETE FROM orders WHERE idempotency_key = ANY($1::text[]) RETURNING id', [keys]);
    console.log(JSON.stringify({ deleted: result.rowCount }));
  } else {
    const { rows } = await pool.query(`SELECT idempotency_key, amount_cents FROM orders
      WHERE idempotency_key = ANY($1::text[]) ORDER BY idempotency_key`, [keys]);
    assert.deepEqual(rows, keys.map(key => ({ idempotency_key: key, amount_cents: 1000 })));
    const { rows: [clock] } = await pool.query('SELECT clock_timestamp() AS target');
    console.log(JSON.stringify({ run, count: rows.length, totalCents: 3000, target: clock.target }));
  }
} finally { await pool.end(); }
