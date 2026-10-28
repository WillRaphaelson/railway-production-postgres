import pg from 'pg';

export function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error('DATABASE_URL is required');
  const pool = new pg.Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    query_timeout: 10000,
    application_name: 'railway-orders-example',
  });
  // An idle connection may close during failover. Let the pool replace it.
  pool.on('error', (error) => console.error('Idle database connection closed', error.code));
  return pool;
}

export async function createOrder(pool, key, amountCents) {
  const { rows } = await pool.query(
    `INSERT INTO orders (idempotency_key, amount_cents)
     VALUES ($1, $2)
     ON CONFLICT (idempotency_key) DO UPDATE
       SET idempotency_key = EXCLUDED.idempotency_key
     RETURNING id, idempotency_key, amount_cents, created_at`,
    [key, amountCents],
  );
  if (rows[0].amount_cents !== amountCents) {
    const error = new Error('Idempotency key already has a different amount');
    error.status = 409;
    throw error;
  }
  return rows[0];
}
