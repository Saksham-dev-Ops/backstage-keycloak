import { randomUUID } from 'node:crypto';
import { Tenant, TenantStatus } from '../../types';
import { Knex, toIso } from '../knex';

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  created_at: string | Date;
  updated_at: string | Date;
};

export function toTenant(row: TenantRow): Tenant {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export class TenantRepository {
  constructor(private readonly db: Knex) {}

  async getById(id: string): Promise<Tenant | undefined> {
    const row = await this.db<TenantRow>('tenants').where({ id }).first();
    return row ? toTenant(row) : undefined;
  }

  async getBySlug(slug: string): Promise<Tenant | undefined> {
    const row = await this.db<TenantRow>('tenants').where({ slug }).first();
    return row ? toTenant(row) : undefined;
  }

  async listActive(): Promise<Tenant[]> {
    const rows = await this.db<TenantRow>('tenants')
      .where({ status: 'active' })
      .orderBy('slug');
    return rows.map(toTenant);
  }

  async create(input: { name: string; slug: string }, tx: Knex = this.db) {
    const id = randomUUID();
    await tx('tenants').insert({ id, name: input.name, slug: input.slug });
    return id;
  }

  async update(id: string, changes: { name?: string; status?: TenantStatus }) {
    await this.db('tenants')
      .where({ id })
      .update({ ...changes, updated_at: this.db.fn.now() });
  }

  /** Deletes the tenant row; tenant-owned rows must be deleted first. */
  async delete(id: string, tx: Knex = this.db) {
    return tx('tenants').where({ id }).delete();
  }
}
