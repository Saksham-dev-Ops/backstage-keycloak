import { RequestContext } from '../auth/tenantContext';
import { DepartmentAuthorizer } from '../auth/authorization';
import {
  NewMember,
  TenantDirectory,
  TenantMember,
} from '../clients/TenantClient';
import { Repositories } from '../database/repository';
import { AdminInvite, DepartmentUser, TenantRole } from '../types';
import { notFound } from './errors';
import { AuditService } from './auditService';

function toUser(member: TenantMember, designation?: string): DepartmentUser {
  return {
    userId: member.userId,
    name: member.name,
    email: member.email,
    role: member.role,
    createdAt: member.createdAt,
    lastSignInAt: member.lastSignInAt,
    hasPassword: member.hasPassword,
    designation,
  };
}

/**
 * Users of a department. Platform admins act through the tenant plugin's
 * platform endpoints; department admins through its tenant-scoped endpoints,
 * where the tenant plugin also prevents privilege escalation (no changes to
 * one's own membership, no granting or touching roles above one's own).
 * The user limit is enforced by the tenant plugin through the quota module.
 */
export class DepartmentUserService {
  constructor(
    private readonly repos: Repositories,
    private readonly tenants: TenantDirectory,
    private readonly authz: DepartmentAuthorizer,
    private readonly audit: AuditService,
  ) {}

  async list(
    ctx: RequestContext,
    departmentId: string,
  ): Promise<DepartmentUser[]> {
    const role = this.authz.requireDepartmentAdmin(ctx.caller, departmentId);
    if (role !== 'PLATFORM_ADMIN') {
      return (
        await this.tenants.listMembers(ctx.credentials, departmentId)
      ).map(m => toUser(m));
    }
    const [members, profiles] = await Promise.all([
      this.tenants.listTenantMembersAsAdmin(ctx.credentials, departmentId),
      this.repos.departments.listAdminProfiles(departmentId),
    ]);
    return members.map(m => toUser(m, profiles.get(m.email)?.designation));
  }

  /**
   * A new one-time invite link for a member who has not set a password yet.
   * Platform admins only; the tenant plugin refuses users with a password.
   */
  async createInvite(
    ctx: RequestContext,
    departmentId: string,
    userId: string,
  ): Promise<AdminInvite> {
    this.authz.requirePlatformAdmin(ctx.caller);
    const members = await this.tenants.listTenantMembersAsAdmin(
      ctx.credentials,
      departmentId,
    );
    const member = members.find(m => m.userId === userId);
    if (!member) {
      throw notFound('USER_NOT_FOUND', 'User not found in this department');
    }
    const invite = await this.tenants.regenerateInvite(ctx.credentials, userId);
    await this.audit.record(ctx.caller, {
      departmentId,
      action: 'DEPARTMENT_USER_INVITED',
      resourceType: 'user',
      resourceId: userId,
      metadata: { email: member.email },
    });
    return { userId, email: member.email, name: member.name, ...invite };
  }

  async add(
    ctx: RequestContext,
    departmentId: string,
    input: NewMember,
  ): Promise<DepartmentUser & { invite?: AdminInvite }> {
    const role = this.authz.requireDepartmentAdmin(ctx.caller, departmentId);
    const member =
      role === 'PLATFORM_ADMIN'
        ? await this.tenants.addTenantMemberAsAdmin(
            ctx.credentials,
            departmentId,
            input,
          )
        : await this.tenants.addMember(ctx.credentials, departmentId, input);
    await this.audit.record(ctx.caller, {
      departmentId,
      action: 'DEPARTMENT_USER_ADDED',
      resourceType: 'user',
      resourceId: member.userId,
      metadata: { email: member.email, role: member.role },
    });
    const invite = member.invite && {
      userId: member.userId,
      email: member.email,
      name: member.name,
      ...member.invite,
    };
    return { ...toUser(member), invite };
  }

  async updateRole(
    ctx: RequestContext,
    departmentId: string,
    userId: string,
    newRole: TenantRole,
  ): Promise<DepartmentUser> {
    const role = this.authz.requireDepartmentAdmin(ctx.caller, departmentId);
    const member =
      role === 'PLATFORM_ADMIN'
        ? await this.tenants.updateTenantMemberAsAdmin(
            ctx.credentials,
            departmentId,
            userId,
            newRole,
          )
        : await this.tenants.updateMember(
            ctx.credentials,
            departmentId,
            userId,
            newRole,
          );
    await this.audit.record(ctx.caller, {
      departmentId,
      action: 'DEPARTMENT_USER_UPDATED',
      resourceType: 'user',
      resourceId: userId,
      metadata: { role: newRole },
    });
    return toUser(member);
  }

  async remove(ctx: RequestContext, departmentId: string, userId: string) {
    const role = this.authz.requireDepartmentAdmin(ctx.caller, departmentId);
    const members =
      role === 'PLATFORM_ADMIN'
        ? await this.tenants.listTenantMembersAsAdmin(
            ctx.credentials,
            departmentId,
          )
        : await this.tenants.listMembers(ctx.credentials, departmentId);
    const email = members.find(m => m.userId === userId)?.email;
    if (role === 'PLATFORM_ADMIN') {
      await this.tenants.removeTenantMemberAsAdmin(
        ctx.credentials,
        departmentId,
        userId,
      );
    } else {
      await this.tenants.removeMember(ctx.credentials, departmentId, userId);
    }
    if (email) {
      // Their contact details are not kept once they leave
      await this.repos.departments.deleteAdminProfile(departmentId, email);
    }
    await this.audit.record(ctx.caller, {
      departmentId,
      action: 'DEPARTMENT_USER_REMOVED',
      resourceType: 'user',
      resourceId: userId,
    });
  }
}
