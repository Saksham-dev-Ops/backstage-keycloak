import { NotAllowedError, NotFoundError } from '@backstage/errors';
import { Repositories } from '../database/repository';
import { Environment, Project, Role, TenantContext, User } from '../types';

export const PERMISSIONS = [
  'tenant.manage',
  'member.read',
  'member.manage',
  'project.read',
  'project.read.all',
  'project.create',
  'project.update',
  'project.delete',
  'environment.manage',
  'config.read',
  'config.write',
  'secret.read',
  'secret.write',
  'audit.read',
  'plugin.manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

// Viewers and developers only see the projects they are assigned to, and not
// the member list of the tenant
const VIEWER: Permission[] = ['project.read', 'config.read'];
// Developers may set secret values but never read them back
const DEVELOPER: Permission[] = [...VIEWER, 'config.write', 'secret.write'];
const ADMIN: Permission[] = [
  ...DEVELOPER,
  'member.read',
  'member.manage',
  'project.read.all',
  'project.create',
  'project.update',
  'project.delete',
  'environment.manage',
  'secret.read',
  'audit.read',
  'plugin.manage',
];
const OWNER: Permission[] = [...ADMIN, 'tenant.manage'];

const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  OWNER: new Set(OWNER),
  ADMIN: new Set(ADMIN),
  DEVELOPER: new Set(DEVELOPER),
  VIEWER: new Set(VIEWER),
};

const ROLE_RANK: Record<Role, number> = {
  OWNER: 4,
  ADMIN: 3,
  DEVELOPER: 2,
  VIEWER: 1,
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function permissionsForRole(role: Role): Permission[] {
  return PERMISSIONS.filter(p => ROLE_PERMISSIONS[role].has(p));
}

/**
 * The single place where tenant membership, roles and resource ownership are
 * checked. Resources outside the current tenant are reported as not found so
 * that their existence is not leaked.
 */
export class AuthorizationService {
  constructor(private readonly repos: Repositories) {}

  /** Resolves the caller's membership of a tenant, or 404s. */
  async authorizeTenantAccess(user: User, tenantId: string): Promise<TenantContext> {
    const [tenant, role] = await Promise.all([
      this.repos.tenants.getById(tenantId),
      this.repos.memberships.getRole(tenantId, user.id),
    ]);
    if (!tenant || !role || tenant.status !== 'active') {
      throw new NotFoundError('Tenant not found');
    }
    return { user, tenant, role };
  }

  requirePermission(ctx: TenantContext, permission: Permission) {
    if (!hasPermission(ctx.role, permission)) {
      throw new NotAllowedError(
        `Your role in this tenant does not allow '${permission}'`,
      );
    }
  }

  async authorizeProjectAccess(
    ctx: TenantContext,
    projectId: string,
    permission: Permission,
  ): Promise<Project> {
    const project = await this.repos.projects.get(ctx.tenant.id, projectId);
    if (!project || !(await this.canSeeProject(ctx, projectId))) {
      throw new NotFoundError('Project not found');
    }
    this.requirePermission(ctx, permission);
    return project;
  }

  /** Owners and admins see every project; others only those assigned to them. */
  canSeeAllProjects(ctx: TenantContext) {
    return hasPermission(ctx.role, 'project.read.all');
  }

  private async canSeeProject(ctx: TenantContext, projectId: string) {
    return (
      this.canSeeAllProjects(ctx) ||
      (await this.repos.projectMembers.isMember(projectId, ctx.user.id))
    );
  }

  async authorizeEnvironmentAccess(
    ctx: TenantContext,
    projectId: string,
    environmentId: string,
    permission: Permission,
  ): Promise<{ project: Project; environment: Environment }> {
    const project = await this.authorizeProjectAccess(ctx, projectId, permission);
    const environment = await this.repos.environments.get(
      ctx.tenant.id,
      projectId,
      environmentId,
    );
    if (!environment) {
      throw new NotFoundError('Environment not found');
    }
    return { project, environment };
  }

  /**
   * Guards membership changes against privilege escalation:
   * nobody changes their own membership, and nobody grants, modifies or
   * removes a role above their own (so admins cannot touch owners).
   */
  assertCanManageMember(
    ctx: TenantContext,
    target: { userId: string; currentRole?: Role; newRole?: Role },
  ) {
    this.requirePermission(ctx, 'member.manage');
    if (target.userId === ctx.user.id) {
      throw new NotAllowedError('You cannot change your own membership');
    }
    const ownRank = ROLE_RANK[ctx.role];
    if (target.currentRole && ROLE_RANK[target.currentRole] > ownRank) {
      throw new NotAllowedError('You cannot manage a member with a higher role');
    }
    if (target.newRole && ROLE_RANK[target.newRole] > ownRank) {
      throw new NotAllowedError('You cannot grant a role higher than your own');
    }
  }
}
