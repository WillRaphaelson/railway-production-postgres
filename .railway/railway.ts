import { defineRailway, github, postgres, preserve, project, service } from 'railway/iac';

export default defineRailway(() => {
  const db = postgres('postgres', { image: 'ghcr.io/railwayapp-templates/postgres-ssl:18' });
  const app = service('orders', {
    source: github('WillRaphaelson/railway-production-postgres', { branch: 'main' }),
    start: 'npm start',
    preDeploy: 'npm run db:migrate',
    healthcheck: '/health',
    env: {
      DATABASE_URL: db.env.DATABASE_URL,
      NODE_ENV: 'production',
      PORT: '3000',
      API_TOKEN: preserve(),
    },
  });
  return project('production-postgres-guide', { resources: [db, app] });
});
