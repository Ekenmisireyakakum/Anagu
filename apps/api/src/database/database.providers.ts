import { Pool } from 'pg';

export const databaseProviders = [
  {
    provide: 'DATABASE_POOL',
    useFactory: (): Pool => {
      try {
        const pool = new Pool({
          connectionString:
            process.env.DATABASE_URL ||
            `postgresql://${process.env.DATABASE_USER || 'anagu'}:${process.env.DATABASE_PASSWORD || 'anagu_password'}@${process.env.DATABASE_HOST || 'localhost'}:${process.env.DATABASE_PORT || '5432'}/${process.env.DATABASE_NAME || 'anagu_db'}`,
        });
        pool.on('error', (err) => {
          console.warn('[AI Studio] PostgreSQL pool error — falling back gracefully:', err.message);
        });
        return pool;
      } catch {
        console.warn('[AI Studio] DB not connected — mock active');
        return {
          query: async () => ({ rows: [] }),
          connect: async () => ({
            query: async () => ({ rows: [] }),
            release: () => {},
          }),
        } as unknown as Pool;
      }
    },
  },
];
