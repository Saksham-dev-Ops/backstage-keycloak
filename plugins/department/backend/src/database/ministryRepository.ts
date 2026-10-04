import { randomUUID } from 'node:crypto';
import { Ministry } from '../types';
import { Knex, toIso } from './knex';

type MinistryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

function toMinistry(row: MinistryRow, departmentCount: number): Ministry {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? undefined,
    departmentCount,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

/** Ministries are platform-level: they belong to no tenant. */
export class MinistryRepository {
  constructor(private readonly db: Knex) {}

  async list(): Promise<Ministry[]> {
    const [rows, counts] = await Promise.all([
      this.db<MinistryRow>('ministries').orderBy('name'),
      this.db('departments')
        .whereNotNull('ministry_id')
        .groupBy('ministry_id')
        .select('ministry_id')
        .count({ n: '*' }),
    ]);
    const byMinistry = new Map(
      (counts as Array<Record<string, unknown>>).map(c => [
        c.ministry_id as string,
        Number(c.n),
      ]),
    );
    return rows.map(row => toMinistry(row, byMinistry.get(row.id) ?? 0));
  }

  async get(id: string): Promise<Ministry | undefined> {
    const row = await this.db<MinistryRow>('ministries').where({ id }).first();
    if (!row) {
      return undefined;
    }
    return toMinistry(row, await this.countDepartments(id));
  }

  async getByName(name: string): Promise<Ministry | undefined> {
    const row = await this.db<MinistryRow>('ministries')
      .where({ name })
      .first();
    return row
      ? toMinistry(row, await this.countDepartments(row.id))
      : undefined;
  }

  async countDepartments(ministryId: string): Promise<number> {
    const row = await this.db('departments')
      .where({ ministry_id: ministryId })
      .count({ n: '*' })
      .first();
    return Number(row?.n ?? 0);
  }

  async create(input: { name: string; slug: string; description?: string }) {
    const id = randomUUID();
    await this.db('ministries').insert({
      id,
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
    });
    return id;
  }

  async update(
    id: string,
    changes: { name?: string; slug?: string; description?: string },
  ) {
    return this.db('ministries')
      .where({ id })
      .update({ ...changes, updated_at: this.db.fn.now() });
  }

  async delete(id: string) {
    return this.db('ministries').where({ id }).delete();
  }
}
