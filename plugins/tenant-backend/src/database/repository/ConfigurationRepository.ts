import { randomUUID } from 'node:crypto';
import { Configuration } from '../../types';
import { Knex, toBool, toIso } from '../knex';

type ConfigurationRow = {
  id: string;
  project_id: string;
  environment_id: string;
  key: string;
  value: string | null;
  is_secret: boolean | number;
  secret_ref: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

function toConfiguration(row: ConfigurationRow): Configuration {
  return {
    id: row.id,
    projectId: row.project_id,
    environmentId: row.environment_id,
    key: row.key,
    value: row.value ?? undefined,
    isSecret: toBool(row.is_secret),
    secretRef: row.secret_ref ?? undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

/** Every query joins through projects so it is scoped by tenant. */
export class ConfigurationRepository {
  constructor(private readonly db: Knex) {}

  private tenantProjects(tenantId: string, db: Knex = this.db) {
    return db('projects').select('id').where({ tenant_id: tenantId });
  }

  async list(
    tenantId: string,
    projectId: string,
    environmentId?: string,
  ): Promise<Configuration[]> {
    const query = this.db<ConfigurationRow>('configurations')
      .where({ project_id: projectId })
      .whereIn('project_id', this.tenantProjects(tenantId))
      .orderBy(['environment_id', 'key']);
    if (environmentId) {
      query.where({ environment_id: environmentId });
    }
    return (await query).map(toConfiguration);
  }

  async get(
    tenantId: string,
    projectId: string,
    configId: string,
  ): Promise<Configuration | undefined> {
    const row = await this.db<ConfigurationRow>('configurations')
      .where({ id: configId, project_id: projectId })
      .whereIn('project_id', this.tenantProjects(tenantId))
      .first();
    return row ? toConfiguration(row) : undefined;
  }

  /** Caller must have verified project and environment belong to the tenant. */
  async create(
    input: {
      id?: string;
      projectId: string;
      environmentId: string;
      key: string;
      value: string | null;
      isSecret: boolean;
      secretRef: string | null;
    },
    tx: Knex = this.db,
  ) {
    const id = input.id ?? randomUUID();
    await tx('configurations').insert({
      id,
      project_id: input.projectId,
      environment_id: input.environmentId,
      key: input.key,
      value: input.value,
      is_secret: input.isSecret,
      secret_ref: input.secretRef,
    });
    return id;
  }

  async update(
    tenantId: string,
    projectId: string,
    configId: string,
    changes: { key?: string; value?: string | null },
  ) {
    return this.db('configurations')
      .where({ id: configId, project_id: projectId })
      .whereIn('project_id', this.tenantProjects(tenantId))
      .update({ ...changes, updated_at: this.db.fn.now() });
  }

  async delete(tenantId: string, projectId: string, configId: string, tx: Knex = this.db) {
    return tx('configurations')
      .where({ id: configId, project_id: projectId })
      .whereIn('project_id', this.tenantProjects(tenantId, tx))
      .delete();
  }

  /** Secret references of a project (or one of its environments), for cleanup. */
  async listSecretRefs(
    tenantId: string,
    projectId: string,
    environmentId?: string,
  ): Promise<string[]> {
    const query = this.db('configurations')
      .where({ project_id: projectId, is_secret: true })
      .whereNotNull('secret_ref')
      .whereIn('project_id', this.tenantProjects(tenantId));
    if (environmentId) {
      query.where({ environment_id: environmentId });
    }
    return (await query.select('secret_ref')).map(row => row.secret_ref);
  }
}
