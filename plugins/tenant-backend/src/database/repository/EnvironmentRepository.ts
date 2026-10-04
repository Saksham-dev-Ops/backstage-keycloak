import { randomUUID } from 'node:crypto';
import { Environment } from '../../types';
import { Knex, toIso } from '../knex';

type EnvironmentRow = {
  id: string;
  project_id: string;
  name: string;
  created_at: string | Date;
  updated_at: string | Date;
};

function toEnvironment(row: EnvironmentRow): Environment {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

/**
 * Environments have no tenant column; every query joins through projects so
 * that it is still scoped by tenant.
 */
export class EnvironmentRepository {
  constructor(private readonly db: Knex) {}

  private scoped(tenantId: string, projectId: string) {
    return this.db<EnvironmentRow>('environments')
      .join('projects', 'projects.id', 'environments.project_id')
      .where({ 'projects.tenant_id': tenantId, 'environments.project_id': projectId })
      .select('environments.*');
  }

  async list(tenantId: string, projectId: string): Promise<Environment[]> {
    const rows = await this.scoped(tenantId, projectId).orderBy(
      'environments.created_at',
    );
    return rows.map(toEnvironment);
  }

  async get(
    tenantId: string,
    projectId: string,
    environmentId: string,
  ): Promise<Environment | undefined> {
    const row = await this.scoped(tenantId, projectId)
      .where('environments.id', environmentId)
      .first();
    return row ? toEnvironment(row) : undefined;
  }

  /** Caller must have verified that the project belongs to the tenant. */
  async create(projectId: string, name: string, tx: Knex = this.db) {
    const id = randomUUID();
    await tx('environments').insert({ id, project_id: projectId, name });
    return id;
  }

  async delete(tenantId: string, projectId: string, environmentId: string, tx: Knex = this.db) {
    return tx('environments')
      .where({ id: environmentId, project_id: projectId })
      .whereIn(
        'project_id',
        tx('projects').select('id').where({ tenant_id: tenantId }),
      )
      .delete();
  }
}
