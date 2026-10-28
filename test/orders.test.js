import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPool, createOrder } from '../src/db.js';

test('concurrent retries create one order and reject a changed amount', async () => {
  const pool = createPool();
  const key = `test-${randomUUID()}`;
  try {
    const orders = await Promise.all(Array.from({ length: 10 }, () => createOrder(pool, key, 2500)));
    assert.equal(new Set(orders.map(order => order.id)).size, 1);
    await assert.rejects(createOrder(pool, key, 2501), { status: 409 });
    const { rows: [row] } = await pool.query('SELECT count(*)::int AS count FROM orders WHERE idempotency_key = $1', [key]);
    assert.equal(row.count, 1);
  } finally {
    await pool.query('DELETE FROM orders WHERE idempotency_key = $1', [key]);
    await pool.end();
  }
});
