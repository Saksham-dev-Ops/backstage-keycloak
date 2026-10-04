import { randomUUID } from 'node:crypto';
import { Project } from '../../types';
import { Knex, toIso } from '../knex';

type ProjectRow = {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

/** All queries are scoped by tenant id; there is no unscoped lookup by id. */
export class ProjectRepository {
  constructor(private readonly db: Knex) {}

  /** Projects of a tenant; with `assignedTo`, only those the user is assigned to. */
  async list(
    tenantId: string,
    options: { assignedTo?: string } = {},
  ): Promise<Array<Project & { environmentCount: number }>> {
    const query = this.db('projects')
      .leftJoin('environments', 'environments.project_id', 'projects.id')
      .where('projects.tenant_id', tenantId);
    if (options.assignedTo) {
      query.whereIn(
        'projects.id',
        this.db('project_members').where('user_id', options.assignedTo).select('project_id'),
      );
    }
    const rows = await query
      .groupBy('projects.id')
      .orderBy('projects.name')
      .select('projects.*')
      .count({ environment_count: 'environments.id' });
    return rows.map(row => ({
      ...toProject(row as ProjectRow),
      environmentCount: Number(row.environment_count),
    }));
  }

  async count(tenantId: string): Promise<number> {
    const row = await this.db('projects')
      .where({ tenant_id: tenantId })
      .count({ n: '*' })
      .first();
    return Number(row?.n ?? 0);
  }

  async get(tenantId: string, projectId: string): Promise<Project | undefined> {
    const row = await this.db<ProjectRow>('projects')
      .where({ tenant_id: tenantId, id: projectId })
      .first();
    return row ? toProject(row) : undefined;
  }

  async create(
    tenantId: string,
    input: { name: string; slug: string; description?: string },
    tx: Knex = this.db,
  ) {
    const id = randomUUID();
    await tx('projects').insert({
      id,
      tenant_id: tenantId,
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
    });
    return id;
  }

  async update(
    tenantId: string,
    projectId: string,
    changes: { name?: string; description?: string },
  ) {
    return this.db('projects')
      .where({ tenant_id: tenantId, id: projectId })
      .update({ ...changes, updated_at: this.db.fn.now() });
  }

  async delete(tenantId: string, projectId: string, tx: Knex = this.db) {
    return tx('projects').where({ tenant_id: tenantId, id: projectId }).delete();
  }
}
