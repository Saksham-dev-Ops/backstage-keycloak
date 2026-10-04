import { ConflictError, NotFoundError } from '@backstage/errors';
import { hashPassword, verifyPassword } from '../auth/password';
import { isUniqueViolation } from '../database/knex';
import { Repositories } from '../database/repository';
import { assertWithinLimit, TenantQuotaProvider } from '../quota/TenantQuotaProvider';
import { Role, TenantContext, User } from '../types';
import { AuditService } from './auditService';
import { AuthorizationService } from './authorizationService';
import { CreatedInvite, InviteService } from './inviteService';

// Compared against when the user does not exist, to keep timing uniform
const DUMMY_HASH_PROMISE = hashPassword('not-a-real-password');

export class UserService {
  constructor(
    private readonly repos: Repositories,
    private readonly authz: AuthorizationService,
    private readonly audit: AuditService,
    private readonly options: {
      localAuthEnabled: boolean;
      isPlatformAdmin: (user: User) => boolean;
      quota: TenantQuotaProvider;
      invites: InviteService;
    },
  ) {}

  getById(userId: string) {
    return this.repos.users.getById(userId);
  }

  /**
   * Maps an identity asserted by an auth provider to an application user.
   * Users need at least one tenant membership (or be platform admins).
   */
  async resolveForSignIn(email: string, provider: string): Promise<User | undefined> {
    const user = await this.repos.users.getByEmail(email);
    if (!user) {
      return undefined;
    }
    const memberships = await this.repos.memberships.listTenantsForUser(user.id);
    if (!memberships.length && !this.options.isPlatformAdmin(user)) {
      return undefined;
    }
    await this.repos.users.recordSignIn(user.id);
    // Local sign-ins are audited when the password is checked instead
    if (provider !== 'local') {
      await this.audit.record({
        userId: user.id,
        action: 'USER_LOGIN',
        resourceType: 'user',
        resourceId: user.id,
        metadata: { provider },
      });
    }
    return user;
  }

  async verifyLocalCredentials(email: string, password: string) {
    const user = await this.repos.users.getByEmail(email);
    const hash = user ? await this.repos.users.getPasswordHash(user.id) : undefined;
    const valid = await verifyPassword(password, hash ?? (await DUMMY_HASH_PROMISE));
    if (!user || !hash || !valid) {
      return undefined;
    }
    await this.audit.record({
      userId: user.id,
      action: 'USER_LOGIN',
      resourceType: 'user',
      resourceId: user.id,
      metadata: { provider: 'local' },
    });
    return user;
  }

  async listMembers(ctx: TenantContext) {
    this.authz.requirePermission(ctx, 'member.read');
    return this.repos.memberships.listMembers(ctx.tenant.id);
  }

  async addMember(
    ctx: TenantContext,
    input: { email: string; name?: string; role: Role; password?: string },
  ) {
    const existing = await this.repos.users.getByEmail(input.email);
    this.authz.assertCanManageMember(ctx, {
      userId: existing?.id ?? '',
      newRole: input.role,
    });

    return this.insertMember(ctx.tenant.id, ctx.user.id, input, existing);
  }

  /**
   * Adds a member to a tenant without any role checks: callers must have
   * authorized the actor (tenant admin or platform admin) already.
   */
  async insertMember(
    tenantId: string,
    actorUserId: string,
    input: { email: string; name?: string; role: Role; password?: string },
    existing?: User,
  ) {
    const { maxMembers } = await this.options.quota.getLimits(tenantId);
    assertWithinLimit(maxMembers, await this.repos.memberships.countMembers(tenantId), 'user');

    let invite: CreatedInvite | undefined;
    const userId = await this.repos.db
      .transaction(async tx => {
        let id = existing?.id;
        if (!id) {
          id = await this.repos.users.create(
            { email: input.email, name: input.name ?? input.email },
            tx,
          );
          // Passwords are only set for brand-new users: an admin of one tenant
          // must never be able to take over an account shared with another.
          if (input.password && this.options.localAuthEnabled) {
            await this.repos.users.setPasswordHash(
              id,
              await hashPassword(input.password),
              tx,
            );
          } else {
            // Without a password, the new user sets one through an invite link
            invite = await this.options.invites.createFor(id, actorUserId, tx);
          }
        }
        await this.repos.memberships.add(tenantId, id, input.role, tx);
        return id;
      })
      .catch(error => {
        if (isUniqueViolation(error)) {
          throw new ConflictError('This user is already a member of the tenant');
        }
        throw error;
      });

    await this.audit.record({
      tenantId,
      userId: actorUserId,
      action: 'USER_ADDED',
      resourceType: 'user',
      resourceId: userId,
      metadata: { role: input.role, email: input.email, invited: !!invite },
    });
    const member = await this.repos.memberships.getMember(tenantId, userId);
    return { ...member!, invite };
  }

  async updateMemberRole(ctx: TenantContext, userId: string, role: Role) {
    const member = await this.repos.memberships.getMember(ctx.tenant.id, userId);
    if (!member) {
      throw new NotFoundError('Member not found');
    }
    this.authz.assertCanManageMember(ctx, {
      userId,
      currentRole: member.role,
      newRole: role,
    });
    await this.repos.memberships.updateRole(ctx.tenant.id, userId, role);
    await this.audit.record({
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
      action: 'ROLE_CHANGED',
      resourceType: 'user',
      resourceId: userId,
      metadata: { from: member.role, to: role },
    });
    return this.repos.memberships.getMember(ctx.tenant.id, userId);
  }

  async removeMember(ctx: TenantContext, userId: string) {
    const member = await this.repos.memberships.getMember(ctx.tenant.id, userId);
    if (!member) {
      throw new NotFoundError('Member not found');
    }
    this.authz.assertCanManageMember(ctx, { userId, currentRole: member.role });
    await this.repos.memberships.remove(ctx.tenant.id, userId);
    await this.repos.projectMembers.removeUserFromTenant(ctx.tenant.id, userId);
    await this.audit.record({
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
      action: 'USER_REMOVED',
      resourceType: 'user',
      resourceId: userId,
      metadata: { role: member.role },
    });
  }
}
