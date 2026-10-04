import {
  DatabaseService,
  resolvePackagePath,
} from '@backstage/backend-plugin-api';

/** The knex type handed out by the database service. */
export type Knex = Awaited<ReturnType<DatabaseService['getClient']>>;

const migrationsDir = resolvePackagePath(
  '@internal/plugin-tenant-backend',
  'migrations',
);

export async function applyMigrations(knex: Knex) {
  await knex.migrate.latest({
    directory: migrationsDir,
    tableName: 'tenant_knex_migrations',
  });
}

export function toIso(value: string | Date | number): string {
  return new Date(value).toISOString();
}

/** SQLite returns booleans as 0/1 */
export function toBool(value: unknown): boolean {
  return value === true || value === 1 || value === '1';
}

export function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; message?: string };
  return (
    e?.code === '23505' || // postgres
    e?.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    e?.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' ||
    /unique constraint/i.test(e?.message ?? '')
  );
}
