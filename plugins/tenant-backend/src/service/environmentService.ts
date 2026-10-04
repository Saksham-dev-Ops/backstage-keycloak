import { LoggerService } from '@backstage/backend-plugin-api';
import { ConflictError } from '@backstage/errors';
import { isUniqueViolation } from '../database/knex';
import { Repositories } from '../database/repository';
import { SecretProvider } from '../secrets/SecretProvider';
import { TenantContext } from '../types';
import { AuditService } from './auditService';
import { AuthorizationService } from './authorizationService';
import { deleteSecrets } from './projectService';

export class EnvironmentService {
  constructor(
    private readonly repos: Repositories,
    private readonly authz: AuthorizationService,
    private readonly audit: AuditService,
    private readonly secrets: SecretProvider,
    private readonly logger: LoggerService,
  ) {}

  async list(ctx: TenantContext, projectId: string) {
    await this.authz.authorizeProjectAccess(ctx, projectId, 'project.read');
    return this.repos.environments.list(ctx.tenant.id, projectId);
  }

  async create(ctx: TenantContext, projectId: string, name: string) {
    await this.authz.authorizeProjectAccess(ctx, projectId, 'environment.manage');
    const id = await this.repos.environments.create(projectId, name).catch(error => {
      if (isUniqueViolation(error)) {
        throw new ConflictError('An environment with this name already exists');
      }
      throw error;
    });
    await this.audit.record({
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
      action: 'ENVIRONMENT_CREATED',
      resourceType: 'environment',
      resourceId: id,
      metadata: { projectId, name },
    });
    return this.repos.environments.get(ctx.tenant.id, projectId, id);
  }

  async delete(ctx: TenantContext, projectId: string, environmentId: string) {
    const { environment } = await this.authz.authorizeEnvironmentAccess(
      ctx,
      projectId,
      environmentId,
      'environment.manage',
    );
    const secretRefs = await this.repos.configurations.listSecretRefs(
      ctx.tenant.id,
      projectId,
      environmentId,
    );
    await this.repos.db.transaction(async tx => {
      await tx('configurations')
        .where({ project_id: projectId, environment_id: environmentId })
        .delete();
      await this.repos.environments.delete(ctx.tenant.id, projectId, environmentId, tx);
    });
    await deleteSecrets(this.secrets, secretRefs, this.logger);
    await this.audit.record({
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
      action: 'ENVIRONMENT_DELETED',
      resourceType: 'environment',
      resourceId: environmentId,
      metadata: { projectId, name: environment.name },
    });
  }
}
