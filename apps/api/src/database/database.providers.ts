import { Pool } from 'pg';

export const databaseProviders = [
  {
    provide: 'DATABASE_POOL',
    useFactory: (): Pool => new Pool({
      connectionString: process.env.DATABASE_URL ||
        `postgresql://${process.env.DATABASE_USER || 'anagu'}:${process.env.DATABASE_PASSWORD || 'anagu_password'}@${process.env.DATABASE_HOST || 'localhost'}:${process.env.DATABASE_PORT || '5432'}/${process.env.DATABASE_NAME || 'anagu_db'}`,
    }),
  },
];
