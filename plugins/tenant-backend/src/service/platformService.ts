import { LoggerService } from '@backstage/backend-plugin-api';
import { ConflictError, InputError, NotAllowedError, NotFoundError } from '@backstage/errors';
import { Repositories } from '../database/repository';
import { SecretProvider } from '../secrets/SecretProvider';
import { Role, TenantStatus, User } from '../types';
import { AuditService } from './auditService';
import { deleteSecrets } from './projectService';
import { UserService } from './userService';

/**
 * Platform-wide views and the only cross-tenant write operations. Every
 * method checks that the caller is a platform admin first; tenant admins use
 * the tenant-scoped services instead.
 */
export class PlatformService {
  constructor(
    private readonly repos: Repositories,
    private readonly options: {
      isPlatformAdmin: (user: Pick<User, 'email'>) => boolean;
      users: UserService;
      audit: AuditService;
      secrets: SecretProvider;
      logger: LoggerService;
    },
  ) {}

  private requirePlatformAdmin(user: User) {
    if (!this.options.isPlatformAdmin(user)) {
      throw new NotAllowedError('Only platform admins can view platform data');
    }
  }

  private async requireTenant(tenantId: string) {
    const tenant = await this.repos.tenants.getById(tenantId);
    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }
    return tenant;
  }

  async overview(user: User) {
    this.requirePlatformAdmin(user);
    return this.repos.platform.counts();
  }

  async listTenants(user: User) {
    this.requirePlatformAdmin(user);
    return this.repos.platform.listTenants();
  }

  async getTenant(user: User, tenantId: string) {
    this.requirePlatformAdmin(user);
    const [tenant] = await this.repos.platform.listTenants({ tenantId });
    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }
    return tenant;
  }

  async updateTenant(
    user: User,
    tenantId: string,
    changes: { name?: string; status?: TenantStatus },
  ) {
    this.requirePlatformAdmin(user);
    await this.requireTenant(tenantId);
    await this.repos.tenants.update(tenantId, changes);
    await this.options.audit.record({
      tenantId,
      userId: user.id,
      action: 'TENANT_UPDATED',
      resourceType: 'tenant',
      resourceId: tenantId,
      metadata: { fields: Object.keys(changes).join(','), byPlatformAdmin: true },
    });
    return this.getTenant(user, tenantId);
  }

  /** Deletes a tenant with all its projects, configuration and secrets. */
  async deleteTenant(user: User, tenantId: string) {
    this.requirePlatformAdmin(user);
    const tenant = await this.requireTenant(tenantId);
    const projectIds = (await this.repos.projects.list(tenantId)).map(p => p.id);
    const secretRefs = (
      await Promise.all(
        projectIds.map(id => this.repos.configurations.listSecretRefs(tenantId, id)),
      )
    ).flat();

    await this.repos.db.transaction(async tx => {
      // Explicit deletes so this does not depend on FK cascades being enabled
      if (projectIds.length) {
        await tx('configurations').whereIn('project_id', projectIds).delete();
        await tx('project_members').whereIn('project_id', projectIds).delete();
        await tx('environments').whereIn('project_id', projectIds).delete();
      }
      await tx('projects').where({ tenant_id: tenantId }).delete();
      await tx('tenant_plugins').where({ tenant_id: tenantId }).delete();
      await tx('user_tenants').where({ tenant_id: tenantId }).delete();
      await this.repos.tenants.delete(tenantId, tx);
    });
    await deleteSecrets(this.options.secrets, secretRefs, this.options.logger);
    await this.options.audit.record({
      tenantId,
      userId: user.id,
      action: 'TENANT_DELETED',
      resourceType: 'tenant',
      resourceId: tenantId,
      metadata: { slug: tenant.slug },
    });
  }

  async listTenantMembers(user: User, tenantId: string) {
    this.requirePlatformAdmin(user);
    await this.requireTenant(tenantId);
    return this.repos.platform.listTenantMembers(tenantId);
  }

  async addTenantMember(
    user: User,
    tenantId: string,
    input: { email: string; name?: string; role: Role; password?: string },
  ) {
    this.requirePlatformAdmin(user);
    await this.requireTenant(tenantId);
    const existing = await this.repos.users.getByEmail(input.email);
    if (existing && (await this.repos.memberships.getRole(tenantId, existing.id))) {
      throw new ConflictError('This user is already a member of the tenant');
    }
    const { invite } = await this.options.users.insertMember(tenantId, user.id, input, existing);
    const members = await this.repos.platform.listTenantMembers(tenantId);
    return { ...members.find(m => m.email === input.email)!, invite };
  }

  async updateTenantMemberRole(user: User, tenantId: string, userId: string, role: Role) {
    this.requirePlatformAdmin(user);
    const member = await this.repos.memberships.getMember(tenantId, userId);
    if (!member) {
      throw new NotFoundError('Member not found');
    }
    await this.repos.memberships.updateRole(tenantId, userId, role);
    await this.options.audit.record({
      tenantId,
      userId: user.id,
      action: 'ROLE_CHANGED',
      resourceType: 'user',
      resourceId: userId,
      metadata: { from: member.role, to: role, byPlatformAdmin: true },
    });
    const members = await this.repos.platform.listTenantMembers(tenantId);
    return members.find(m => m.userId === userId)!;
  }

  async removeTenantMember(user: User, tenantId: string, userId: string) {
    this.requirePlatformAdmin(user);
    const member = await this.repos.memberships.getMember(tenantId, userId);
    if (!member) {
      throw new NotFoundError('Member not found');
    }
    if (userId === user.id) {
      throw new InputError('You cannot remove yourself');
    }
    await this.repos.memberships.remove(tenantId, userId);
    await this.repos.projectMembers.removeUserFromTenant(tenantId, userId);
    await this.options.audit.record({
      tenantId,
      userId: user.id,
      action: 'USER_REMOVED',
      resourceType: 'user',
      resourceId: userId,
      metadata: { role: member.role, byPlatformAdmin: true },
    });
  }

  async listUsers(user: User) {
    this.requirePlatformAdmin(user);
    const users = await this.repos.platform.listUsers();
    return users.map(u => ({ ...u, isPlatformAdmin: this.options.isPlatformAdmin(u) }));
  }

  async listProjects(user: User, options: { tenantId?: string } = {}) {
    this.requirePlatformAdmin(user);
    return this.repos.platform.listProjects(options);
  }
}
