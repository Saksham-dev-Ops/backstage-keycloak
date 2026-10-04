import { LoggerService } from '@backstage/backend-plugin-api';
import { ConflictError, InputError } from '@backstage/errors';
import { isUniqueViolation } from '../database/knex';
import { Repositories } from '../database/repository';
import { assertWithinLimit, TenantQuotaProvider } from '../quota/TenantQuotaProvider';
import { SecretProvider } from '../secrets/SecretProvider';
import { TenantContext } from '../types';
import { AuditService } from './auditService';
import { AuthorizationService } from './authorizationService';

export class ProjectService {
  constructor(
    private readonly repos: Repositories,
    private readonly authz: AuthorizationService,
    private readonly audit: AuditService,
    private readonly secrets: SecretProvider,
    private readonly logger: LoggerService,
    private readonly quota: TenantQuotaProvider,
  ) {}

  async list(ctx: TenantContext) {
    this.authz.requirePermission(ctx, 'project.read');
    return this.repos.projects.list(ctx.tenant.id, {
      assignedTo: this.authz.canSeeAllProjects(ctx) ? undefined : ctx.user.id,
    });
  }

  async get(ctx: TenantContext, projectId: string) {
    const project = await this.authz.authorizeProjectAccess(ctx, projectId, 'project.read');
    const environments = await this.repos.environments.list(ctx.tenant.id, projectId);
    return { ...project, environments };
  }

  async create(
    ctx: TenantContext,
    input: { name: string; slug: string; description?: string; environments: string[] },
  ) {
    this.authz.requirePermission(ctx, 'project.create');
    const { maxProjects } = await this.quota.getLimits(ctx.tenant.id);
    assertWithinLimit(maxProjects, await this.repos.projects.count(ctx.tenant.id), 'project');
    const projectId = await this.repos.db
      .transaction(async tx => {
        const id = await this.repos.projects.create(ctx.tenant.id, input, tx);
        for (const name of new Set(input.environments)) {
          await this.repos.environments.create(id, name, tx);
        }
        return id;
      })
      .catch(error => {
        if (isUniqueViolation(error)) {
          throw new ConflictError('A project with this slug already exists');
        }
        throw error;
      });
    await this.audit.record({
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
      action: 'PROJECT_CREATED',
      resourceType: 'project',
      resourceId: projectId,
      metadata: { slug: input.slug },
    });
    return this.get(ctx, projectId);
  }

  async update(
    ctx: TenantContext,
    projectId: string,
    changes: { name?: string; description?: string },
  ) {
    await this.authz.authorizeProjectAccess(ctx, projectId, 'project.update');
    await this.repos.projects.update(ctx.tenant.id, projectId, changes);
    await this.audit.record({
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
      action: 'PROJECT_UPDATED',
      resourceType: 'project',
      resourceId: projectId,
      metadata: { fields: Object.keys(changes).join(',') },
    });
    return this.get(ctx, projectId);
  }

  async delete(ctx: TenantContext, projectId: string) {
    const project = await this.authz.authorizeProjectAccess(ctx, projectId, 'project.delete');
    const secretRefs = await this.repos.configurations.listSecretRefs(
      ctx.tenant.id,
      projectId,
    );
    await this.repos.db.transaction(async tx => {
      // Explicit deletes so this does not depend on FK cascades being enabled
      await tx('configurations').where({ project_id: projectId }).delete();
      await tx('project_members').where({ project_id: projectId }).delete();
      await tx('environments').where({ project_id: projectId }).delete();
      await this.repos.projects.delete(ctx.tenant.id, projectId, tx);
    });
    await deleteSecrets(this.secrets, secretRefs, this.logger);
    await this.audit.record({
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
      action: 'PROJECT_DELETED',
      resourceType: 'project',
      resourceId: projectId,
      metadata: { slug: project.slug },
    });
  }

  // --- Assignments ------------------------------------------------------------

  async listMembers(ctx: TenantContext, projectId: string) {
    await this.authz.authorizeProjectAccess(ctx, projectId, 'project.read');
    return this.repos.projectMembers.list(ctx.tenant.id, projectId);
  }

  async assignMember(ctx: TenantContext, projectId: string, userId: string) {
    await this.authz.authorizeProjectAccess(ctx, projectId, 'member.manage');
    // Only members of this tenant can be assigned to its projects
    if (!(await this.repos.memberships.getRole(ctx.tenant.id, userId))) {
      throw new InputError('The user is not a member of this organization');
    }
    await this.repos.projectMembers.add(projectId, userId);
    await this.audit.record({
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
      action: 'PROJECT_MEMBER_ADDED',
      resourceType: 'project',
      resourceId: projectId,
      metadata: { member: userId },
    });
    return this.repos.projectMembers.list(ctx.tenant.id, projectId);
  }

  async unassignMember(ctx: TenantContext, projectId: string, userId: string) {
    await this.authz.authorizeProjectAccess(ctx, projectId, 'member.manage');
    await this.repos.projectMembers.remove(projectId, userId);
    await this.audit.record({
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
      action: 'PROJECT_MEMBER_REMOVED',
      resourceType: 'project',
      resourceId: projectId,
      metadata: { member: userId },
    });
  }
}

export async function deleteSecrets(
  secrets: SecretProvider,
  references: string[],
  logger: LoggerService,
) {
  for (const reference of references) {
    try {
      await secrets.deleteSecret(reference);
    } catch {
      // Log the reference only, never the value
      logger.warn(`Failed to delete secret ${reference}`);
    }
  }
}
