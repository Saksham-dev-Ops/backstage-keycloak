import { ConflictError, InputError, NotAllowedError } from '@backstage/errors';
import { hashPassword } from '../auth/password';
import { isUniqueViolation } from '../database/knex';
import { Repositories } from '../database/repository';
import { TenantContext, User } from '../types';
import { AuditService } from './auditService';
import { AuthorizationService, permissionsForRole } from './authorizationService';
import { CreatedInvite, InviteService } from './inviteService';

export class TenantService {
  constructor(
    private readonly repos: Repositories,
    private readonly authz: AuthorizationService,
    private readonly audit: AuditService,
    private readonly invites: InviteService,
    private readonly options: { platformAdmins: string[]; localAuthEnabled: boolean },
  ) {}

  isPlatformAdmin(user: Pick<User, 'email'>) {
    return this.options.platformAdmins.includes(user.email.toLowerCase());
  }

  listActiveTenants() {
    return this.repos.tenants.listActive();
  }

  async listUserTenants(user: User) {
    const memberships = await this.repos.memberships.listTenantsForUser(user.id);
    return memberships
      .filter(m => m.tenant.status === 'active')
      .map(m => ({ ...m.tenant, role: m.role }));
  }

  describe(ctx: TenantContext) {
    return {
      tenant: ctx.tenant,
      role: ctx.role,
      permissions: permissionsForRole(ctx.role),
    };
  }

  /** Membership is re-validated here and on every subsequent request. */
  async switchTenant(user: User, tenantId: string) {
    const ctx = await this.authz.authorizeTenantAccess(user, tenantId);
    await this.audit.record({
      tenantId: ctx.tenant.id,
      userId: user.id,
      action: 'TENANT_SWITCH',
      resourceType: 'tenant',
      resourceId: ctx.tenant.id,
    });
    return this.describe(ctx);
  }

  /**
   * Creates a tenant with one or more OWNERs, atomically. Owners who are new
   * users get an account; with local sign-in they either get the initial
   * password given here or, without one, a one-time invite link to set it.
   * Existing users keep their password: it is never overwritten here.
   */
  async createTenant(
    user: User,
    input: {
      name: string;
      slug: string;
      ownerEmail?: string;
      ownerName?: string;
      ownerPassword?: string;
      additionalOwners?: Array<{ email: string; name?: string }>;
    },
  ) {
    if (!this.isPlatformAdmin(user)) {
      throw new NotAllowedError('Only platform admins can create tenants');
    }
    const requested = [
      { email: input.ownerEmail ?? user.email, name: input.ownerName, password: input.ownerPassword },
      ...(input.additionalOwners ?? []).map(o => ({ ...o, password: undefined })),
    ];
    if (new Set(requested.map(o => o.email)).size !== requested.length) {
      throw new InputError('Each owner can only be added once');
    }
    const owners = await Promise.all(
      requested.map(async o => {
        const existing = await this.repos.users.getByEmail(o.email);
        const passwordHash =
          !existing && o.password && this.options.localAuthEnabled
            ? await hashPassword(o.password)
            : undefined;
        return { ...o, existing, passwordHash };
      }),
    );

    const { tenantId, created } = await this.repos.db
      .transaction(async tx => {
        const id = await this.repos.tenants.create(input, tx);
        const result = [];
        for (const owner of owners) {
          let userId = owner.existing?.id;
          let invite: CreatedInvite | undefined;
          if (!userId) {
            userId = await this.repos.users.create(
              { email: owner.email, name: owner.name ?? owner.email },
              tx,
            );
            if (owner.passwordHash) {
              await this.repos.users.setPasswordHash(userId, owner.passwordHash, tx);
            } else {
              invite = await this.invites.createFor(userId, user.id, tx);
            }
          }
          await this.repos.memberships.add(id, userId, 'OWNER', tx);
          result.push({ userId, email: owner.email, accountCreated: !owner.existing, invite });
        }
        return { tenantId: id, created: result };
      })
      .catch(error => {
        if (isUniqueViolation(error)) {
          throw new ConflictError('A tenant with this slug already exists');
        }
        throw error;
      });

    await this.audit.record({
      tenantId,
      userId: user.id,
      action: 'TENANT_CREATED',
      resourceType: 'tenant',
      resourceId: tenantId,
      metadata: { slug: input.slug },
    });
    for (const owner of created) {
      await this.audit.record({
        tenantId,
        userId: user.id,
        action: 'USER_ADDED',
        resourceType: 'user',
        resourceId: owner.userId,
        metadata: {
          role: 'OWNER',
          email: owner.email,
          newAccount: owner.accountCreated,
          invited: !!owner.invite,
        },
      });
    }
    const [first] = created;
    return {
      tenant: await this.repos.tenants.getById(tenantId),
      // The first owner, as before
      owner: { userId: first.userId, email: first.email, accountCreated: first.accountCreated },
      owners: created,
    };
  }

  async updateTenant(ctx: TenantContext, changes: { name: string }) {
    this.authz.requirePermission(ctx, 'tenant.manage');
    await this.repos.tenants.update(ctx.tenant.id, changes);
    await this.audit.record({
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
      action: 'TENANT_UPDATED',
      resourceType: 'tenant',
      resourceId: ctx.tenant.id,
      metadata: { fields: Object.keys(changes).join(',') },
    });
    return this.repos.tenants.getById(ctx.tenant.id);
  }

  async listAuditLogs(ctx: TenantContext, limit: number) {
    this.authz.requirePermission(ctx, 'audit.read');
    return this.audit.list(ctx.tenant.id, limit);
  }
}
