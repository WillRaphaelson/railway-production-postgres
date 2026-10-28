import { createPool } from '../src/db.js';

// A dedicated, unpooled URL is used once pooling is enabled.
const pool = createPool(process.env.DATABASE_UNPOOLED_URL || process.env.DATABASE_URL);
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(714226)');
  await client.query(`CREATE TABLE IF NOT EXISTS orders (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    idempotency_key text NOT NULL UNIQUE,
    amount_cents integer NOT NULL CHECK (amount_cents > 0),
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  await client.query('COMMIT');
  console.log('Orders schema ready');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
