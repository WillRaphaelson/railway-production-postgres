# Deploy and Host Production Postgres Orders on Railway

Deploy a small Node.js orders API beside an official Railway Postgres 18 database. Follow the included runbooks to add backups, point-in-time recovery, PgBouncer connection pooling, and high availability as your application's requirements grow.

## About Hosting Production Postgres Orders

The template creates an orders application and a standalone Postgres database connected over Railway's private network. A pre-deploy migration creates the orders table, and an HTTP health check verifies database connectivity. The template generates a fresh API token and database password for every deployment. Orders endpoints require the API token; the health endpoint is public.

Backups, PITR, pooling, and HA are follow-up steps, not pre-enabled template features. Enable them through Railway's database controls using the repository's runbooks. Additional services, storage, and buckets consume billable resources. Manual volume backups and backup schedules require a Pro workspace.

## Why Deploy Production Postgres Orders on Railway?

Railway keeps the app, persistent database storage, private networking, variable references, and deployment controls together. You can start with a standalone database, test recovering deleted data, then add the built-in pooler and HA conversion without rebuilding the application's data model.

The example uses a database-enforced idempotency key so clients can safely retry an order after a lost response. It is an educational API, not a payment processor or a complete commerce application.

## Common Use Cases

- Learn private application-to-Postgres connections and pre-deploy migrations.
- Rehearse PITR recovery with three known orders and exact amount validation.
- Test portable pg_dump and pg_restore workflows.
- Observe application reconnection and retry behavior during a planned HA switchover.

## Dependencies for Production Postgres Orders Hosting

Railway builds the orders application from its public GitHub repository and runs the official Postgres 18 image with a persistent volume. The Node.js driver is pinned in the repository's lockfile.

### Deployment Dependencies

- A Railway account with sufficient resources for the application and database.
- The public [supporting repository](https://github.com/WillRaphaelson/railway-production-postgres).
- No external API keys or third-party accounts are required to start.
- Optional Railway CLI for the exercises and database client tools matching Postgres 18 or newer for exports.
- A Pro workspace if you want manual or scheduled volume backups.

After deployment, retrieve `API_TOKEN` privately from the orders service's Variables tab. Set `APP_URL` to its HTTPS domain and follow the [README](https://github.com/WillRaphaelson/railway-production-postgres#use-the-api) to create your first order. Use only disposable fixture data for recovery and failover exercises.
