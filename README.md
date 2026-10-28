# Production Postgres on Railway

An orders API that demonstrates private Postgres connections, safe retries, portable recovery, point-in-time recovery (PITR), connection pooling, and high availability (HA).

The starter deploys one Node.js service and one official Railway Postgres 18 service. Backups, PITR, PgBouncer, and HA are added through Railway's database controls as you follow the runbook. They are not enabled by the starter. Every added service, volume, and bucket uses billable resources.

## Deploy

Use the companion Railway template, or fork this repository and apply `.railway/railway.ts` with Railway CLI 5.71 or newer:

```bash
npm ci
railway init --name production-postgres-orders
railway config plan
railway config apply --yes
```

Before applying, change `github(...)` to your fork. Set a random `API_TOKEN` on the `orders` service. The template generates a fresh token for each deployment. The IaC configuration preserves that token. Never use an example token in a real deployment.

The application uses `${{postgres.DATABASE_URL}}` over private networking. The pre-deploy command runs `npm run db:migrate`. Generate an HTTPS domain for `orders` in the dashboard or with `railway domain --service orders --port 3000`.

## Use the API

Set `APP_URL` to the orders HTTPS URL and `API_TOKEN` to your service's token, retrieved privately from its Variables tab.

```bash
curl "$APP_URL/health"
curl "$APP_URL/orders" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: first-order' \
  --data '{"amountCents":2500}'
curl "$APP_URL/orders" -H "Authorization: Bearer $API_TOKEN"
```

Retry a failed POST with the same key and amount. PostgreSQL's unique constraint ensures the retry returns the same order, including when the first response was lost after commit. Reusing a key with a different amount returns 409. The example does not process payments or provide customer authentication.

## Local checks

Use a disposable Postgres database. `pg_dump` must be at least as new as the server's major version.

```bash
npm ci
export DATABASE_URL='postgresql://postgres@localhost:5432/orders'
npm run db:migrate
npm test
npm run drill -- seed rehearsal-1
API_TOKEN="$(openssl rand -hex 32)" npm start
```

The integration test checks ten concurrent writes sharing one idempotency key produce one order and rejects a conflicting amount. The scripts use integer cents to avoid floating-point totals.

## Recover deleted orders with PITR

Run only against a disposable database. Use `railway ssh --service orders` to run the demo commands inside the application container, where private database addresses resolve.

1. Enable PITR on `postgres` in the Backups tab. Wait for the first base backup and healthy WAL archiving. `railway postgres pitr status --service postgres` shows coverage.
2. In the app container, run `npm run drill -- seed rehearsal-1`. Record the returned database timestamp, count (3), and total (3000 cents).
3. Wait until the recorded target is covered by the PITR archive, then run `ALLOW_DEMO_DELETE=yes npm run drill -- delete rehearsal-1`. This deletes only the three fixture keys for this run.
4. Restore the recorded timestamp through the Backups tab, or use `railway postgres pitr restore --service postgres --at TIMESTAMP --new-service-name orders-restored --yes`.
5. Connect a disposable app copy to the restored database using a service-variable reference. Run `npm run drill -- verify rehearsal-1`; it must find all three exact keys and amounts. Test an authenticated write through that app copy too.
6. Record recovery provisioning time, validation time, any application switch time, and the newest recoverable timestamp. A PITR clone starts without archiving: enable PITR on it separately if it becomes the active database.
7. Keep the source database until validation passes. Reconcile writes after the restore target before any production cutover, pause writes for the final switch, then change the app's reference. Clean up the disposable restored service after the exercise.

## Portable backup and restore

Open `railway connect postgres --tunnel-only`, keep it running, and privately set `DATABASE_URL` to its local URL. For a pooled service, dump through an unpooled endpoint. Restore to a separate empty database:

```bash
pg_dump "$DATABASE_URL" --format=custom --no-owner --file=orders.dump
pg_restore --dbname="$RESTORE_DATABASE_URL" \
  --no-owner --no-acl --exit-on-error orders.dump
DATABASE_URL="$RESTORE_DATABASE_URL" npm run drill -- verify rehearsal-1
```

`RESTORE_DATABASE_URL` must name a scratch database, never the source. Encrypt independently stored dumps and apply your access and retention policy. Dumps are excluded from Git.

## Add pooling

In Database → Config → Connection Pooling, add PgBouncer in transaction mode. Railway updates project references to the pooled endpoint. Set `DATABASE_UNPOOLED_URL` on `orders` to a reference to the database's `DATABASE_UNPOOLED_URL` so migrations bypass PgBouncer. Runtime queries keep using `DATABASE_URL`. The driver pool is capped at 5 per instance, and queries do not use named prepared statements.

Use session mode or a dedicated unpooled connection for session locks, session settings, and LISTEN. After adding product-managed database features, import current state with `railway config pull` and review it before future IaC applies; the initial two-service file is a starter, not a cluster lifecycle manager.

## Add HA and measure a switchover

Use Database → Config → High Availability on the official pinned Postgres image. Keep the image's default start command. Conversion adds Patroni data nodes, etcd coordinators, and HAProxy; these consume additional resources. Backups remain necessary.

```bash
APP_URL="$APP_URL" API_TOKEN="$API_TOKEN" PROBE_SECONDS=120 npm run probe
```

In another terminal, inspect `railway postgres ha status --service postgres`, then run `railway postgres ha switchover --service postgres --to REPLICA_NAME --yes`. Use the actual replica name from the status output.

The probe writes one order every second and retries failed requests with the same key. Each request times out after 5 seconds. Its JSON output includes every attempt, latency, and status. Record the last success before the switch, failures, and first success after it. A planned switchover does not measure automatic recovery from an unplanned failure, and these measurements are not an SLA or throughput benchmark.

## References

- [PostgreSQL](https://docs.railway.com/databases/postgresql)
- [PITR](https://docs.railway.com/volumes/point-in-time-recovery)
- [Pooling](https://docs.railway.com/databases/postgresql-pgbouncer)
- [HA](https://docs.railway.com/databases/postgresql-ha)
- [Infrastructure as Code](https://docs.railway.com/infrastructure-as-code)
