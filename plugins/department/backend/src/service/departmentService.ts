import {
  BackstageCredentials,
  LoggerService,
} from '@backstage/backend-plugin-api';
import { ConflictError } from '@backstage/errors';
import { RequestContext } from '../auth/tenantContext';
import { DepartmentAuthorizer, departmentRoleFor } from '../auth/authorization';
import { PlatformTenant, TenantDirectory } from '../clients/TenantClient';
import {
  DepartmentProfile,
  ProfileChanges,
} from '../database/departmentRepository';
import { Repositories } from '../database/repository';
import {
  computeStats,
  profileFields,
  toDepartment,
} from '../models/department';
import {
  AdminInvite,
  Department,
  DepartmentStats,
  DepartmentStatus,
  Page,
} from '../types';
import { AuditService } from './auditService';
import { badRequest, conflict, notFound } from './errors';

export type DepartmentQuery = {
  page: number;
  pageSize: number;
  ministryId?: string;
  status?: DepartmentStatus;
  search?: string;
  admin?: string;
};

export type CreateDepartmentInput = {
  ministryId: string;
  name: string;
  shortCode: string;
  capabilities: string[];
  userLimit: number;
  projectLimit: number;
  adminsCanApproveJoinRequests: boolean;
  adminsCanCreateCustomRoles: boolean;
  admins: Array<{
    name: string;
    email: string;
    designation: string;
    mobile: string;
  }>;
};

export type UpdateDepartmentInput = {
  name?: string;
  ministryId?: string;
  userLimit?: number | null;
  projectLimit?: number | null;
  status?: 'active' | 'suspended';
};

/** Department placements from `department.seed`, by tenant slug */
export type SeedAssignments = Map<
  string,
  { ministryName: string; userLimit?: number; projectLimit?: number }
>;

export class DepartmentService {
  constructor(
    private readonly repos: Repositories,
    private readonly tenants: TenantDirectory,
    private readonly authz: DepartmentAuthorizer,
    private readonly audit: AuditService,
    private readonly logger: LoggerService,
    private readonly seedAssignments: SeedAssignments = new Map(),
  ) {}

  async list(
    ctx: RequestContext,
    query: DepartmentQuery,
  ): Promise<Page<Department>> {
    const all = await this.visibleDepartments(ctx);
    const search = query.search?.toLowerCase();
    const admin = query.admin?.toLowerCase();
    const filtered = all.filter(
      d =>
        (!query.ministryId ||
          (query.ministryId === 'unassigned'
            ? !d.ministry
            : d.ministry?.id === query.ministryId)) &&
        (!query.status || d.status === query.status) &&
        (!search || d.name.toLowerCase().includes(search)) &&
        (!admin ||
          d.admins.some(
            a =>
              a.name.toLowerCase().includes(admin) || a.email.includes(admin),
          )),
    );
    const start = (query.page - 1) * query.pageSize;
    return {
      items: filtered.slice(start, start + query.pageSize),
      total: filtered.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async stats(ctx: RequestContext): Promise<DepartmentStats> {
    this.authz.requirePlatformAdmin(ctx.caller);
    return computeStats(await this.visibleDepartments(ctx));
  }

  async get(ctx: RequestContext, departmentId: string): Promise<Department> {
    const role = this.authz.roleIn(ctx.caller, departmentId);
    if (role === 'PLATFORM_ADMIN') {
      const tenant = await this.getTenantOr404(ctx.credentials, departmentId);
      const [profile, ministries, adminProfiles] = await Promise.all([
        this.repos.departments.get(departmentId),
        this.ministryNames(),
        this.repos.departments.listAdminProfiles(departmentId),
      ]);
      return toDepartment(tenant, profile, ministries, role, adminProfiles);
    }
    return this.describeForMember(ctx, departmentId);
  }

  /**
   * Creates a department from the onboarding form: the tenant with all its
   * admins as owners (atomically, in the tenant plugin), then what this
   * plugin stores. New admins get one-time invite links, returned once.
   */
  async create(
    ctx: RequestContext,
    input: CreateDepartmentInput,
  ): Promise<{ department: Department; invites: AdminInvite[] }> {
    this.authz.requirePlatformAdmin(ctx.caller);
    const ministry = await this.repos.ministries.get(input.ministryId);
    if (!ministry) {
      throw badRequest(
        'MINISTRY_NOT_FOUND',
        'The selected ministry does not exist',
      );
    }
    const [firstAdmin, ...otherAdmins] = input.admins;

    let created: Awaited<ReturnType<TenantDirectory['createTenant']>>;
    try {
      created = await this.tenants.createTenant(ctx.credentials, {
        name: input.name,
        slug: input.shortCode.toLowerCase(),
        ownerEmail: firstAdmin.email,
        ownerName: firstAdmin.name,
        additionalOwners: otherAdmins.map(a => ({
          email: a.email,
          name: a.name,
        })),
      });
    } catch (error) {
      if (error instanceof ConflictError) {
        throw conflict(
          'SHORT_CODE_TAKEN',
          'This short code is already used by another department',
        );
      }
      throw error;
    }
    const tenantId = created.id;

    try {
      await this.repos.departments.create(
        tenantId,
        {
          ministryId: ministry.id,
          userLimit: input.userLimit,
          projectLimit: input.projectLimit,
          adminsCanApproveJoinRequests: input.adminsCanApproveJoinRequests,
          adminsCanCreateCustomRoles: input.adminsCanCreateCustomRoles,
          capabilities: [...new Set(input.capabilities)],
          admins: input.admins.map(({ email, designation, mobile }) => ({
            email,
            designation,
            mobile,
          })),
        },
        ctx.caller.user.id,
      );
    } catch (error) {
      // Do not leave a department behind without its ministry and limits
      this.logger.error(
        `Failed to store department ${tenantId}, rolling back`,
        error as Error,
      );
      await this.tenants
        .deleteTenant(ctx.credentials, tenantId)
        .catch(rollbackError =>
          this.logger.error(
            `Rollback of department ${tenantId} failed`,
            rollbackError,
          ),
        );
      throw error;
    }

    await this.audit.record(ctx.caller, {
      departmentId: tenantId,
      action: 'DEPARTMENT_CREATED',
      resourceType: 'department',
      resourceId: tenantId,
      metadata: {
        name: input.name,
        shortCode: input.shortCode.toUpperCase(),
        ministry: ministry.name,
        admins: input.admins.length,
        capabilities: input.capabilities.join(','),
      },
    });

    const names = new Map(input.admins.map(a => [a.email, a.name]));
    const invites: AdminInvite[] = created.owners.flatMap(o =>
      o.invite
        ? [
            {
              userId: o.userId,
              email: o.email,
              name: names.get(o.email) ?? o.email,
              ...o.invite,
            },
          ]
        : [],
    );
    return { department: await this.get(ctx, tenantId), invites };
  }

  /** Whether a short code is still free (short codes become tenant slugs). */
  async isShortCodeAvailable(ctx: RequestContext, shortCode: string) {
    this.authz.requirePlatformAdmin(ctx.caller);
    const slug = shortCode.toLowerCase();
    const tenants = await this.tenants.listTenants(ctx.credentials);
    return !tenants.some(t => t.slug === slug);
  }

  async update(
    ctx: RequestContext,
    departmentId: string,
    input: UpdateDepartmentInput,
  ): Promise<Department> {
    this.authz.requirePlatformAdmin(ctx.caller);
    const tenant = await this.getTenantOr404(ctx.credentials, departmentId);

    if (
      input.ministryId &&
      !(await this.repos.ministries.get(input.ministryId))
    ) {
      throw badRequest(
        'MINISTRY_NOT_FOUND',
        'The selected ministry does not exist',
      );
    }
    if (
      typeof input.userLimit === 'number' &&
      input.userLimit < tenant.memberCount
    ) {
      throw conflict(
        'LIMIT_BELOW_USAGE',
        `The user limit cannot be lower than the current number of users (${tenant.memberCount})`,
      );
    }
    if (
      typeof input.projectLimit === 'number' &&
      input.projectLimit < tenant.projectCount
    ) {
      throw conflict(
        'LIMIT_BELOW_USAGE',
        `The project limit cannot be lower than the current number of projects (${tenant.projectCount})`,
      );
    }

    if (input.name !== undefined || input.status !== undefined) {
      await this.tenants.updateTenant(ctx.credentials, departmentId, {
        name: input.name,
        status: input.status,
      });
    }
    const profileChanges: ProfileChanges = {
      ministryId: input.ministryId,
      userLimit: input.userLimit,
      projectLimit: input.projectLimit,
    };
    if (Object.values(profileChanges).some(v => v !== undefined)) {
      await this.repos.departments.upsert(
        departmentId,
        profileChanges,
        ctx.caller.user.id,
      );
    }

    let action:
      | 'DEPARTMENT_UPDATED'
      | 'DEPARTMENT_SUSPENDED'
      | 'DEPARTMENT_ACTIVATED' = 'DEPARTMENT_UPDATED';
    if (input.status && input.status !== tenant.status) {
      action =
        input.status === 'suspended'
          ? 'DEPARTMENT_SUSPENDED'
          : 'DEPARTMENT_ACTIVATED';
    }
    await this.audit.record(ctx.caller, {
      departmentId,
      action,
      resourceType: 'department',
      resourceId: departmentId,
      metadata: { fields: Object.keys(input).join(',') },
    });
    return this.get(ctx, departmentId);
  }

  async delete(ctx: RequestContext, departmentId: string) {
    this.authz.requirePlatformAdmin(ctx.caller);
    const tenant = await this.getTenantOr404(ctx.credentials, departmentId);
    await this.tenants.deleteTenant(ctx.credentials, departmentId);
    await this.repos.departments.delete(departmentId);
    await this.audit.record(ctx.caller, {
      departmentId,
      action: 'DEPARTMENT_DELETED',
      resourceType: 'department',
      resourceId: departmentId,
      metadata: { name: tenant.name, slug: tenant.slug },
    });
  }

  /** Limits for the tenant plugin's quota checks (service-to-service only). */
  async limitsFor(departmentId: string) {
    const profile = await this.repos.departments.get(departmentId);
    return {
      maxMembers: profile?.userLimit,
      maxProjects: profile?.projectLimit,
    };
  }

  // --- Helpers ----------------------------------------------------------------

  /** Platform admins see every department; everyone else only their own. */
  private async visibleDepartments(ctx: RequestContext): Promise<Department[]> {
    if (ctx.caller.isPlatformAdmin) {
      const tenants = await this.tenants.listTenants(ctx.credentials);
      const profiles = await this.repos.departments.listForTenants(
        tenants.map(t => t.id),
      );
      await this.applySeedAssignments(tenants, profiles);
      const ministries = await this.ministryNames();
      return tenants.map(t =>
        toDepartment(t, profiles.get(t.id), ministries, 'PLATFORM_ADMIN'),
      );
    }
    return Promise.all(
      ctx.caller.memberships.map(m => this.describeForMember(ctx, m.id)),
    );
  }

  /**
   * A department as seen by one of its members. Organization admins also get
   * the admins and usage; users only get the department itself.
   */
  private async describeForMember(
    ctx: RequestContext,
    departmentId: string,
  ): Promise<Department> {
    const membership = ctx.caller.memberships.find(m => m.id === departmentId);
    if (!membership) {
      throw notFound('DEPARTMENT_NOT_FOUND', 'Department not found');
    }
    const role = departmentRoleFor(membership.role);
    const [profile, ministries] = await Promise.all([
      this.repos.departments.get(departmentId),
      this.ministryNames(),
    ]);
    const ministry = profile?.ministryId
      ? ministries.get(profile.ministryId)
      : undefined;
    const department: Department = {
      id: membership.id,
      name: membership.name,
      slug: membership.slug,
      status: 'active',
      ministry,
      admins: [],
      userLimit: profile?.userLimit,
      projectLimit: profile?.projectLimit,
      ...profileFields(membership.slug, profile),
      callerRole: role,
    };
    if (role === 'ORGANIZATION_ADMIN') {
      const [members, projects] = await Promise.all([
        this.tenants.listMembers(ctx.credentials, departmentId),
        this.tenants.listProjects(ctx.credentials, departmentId),
      ]);
      department.admins = members
        .filter(m => m.role === 'OWNER' || m.role === 'ADMIN')
        .map(m => ({
          userId: m.userId,
          name: m.name,
          email: m.email,
          role: m.role,
          // The caller is an admin who signed in; others are not known here
          hasSignedIn: m.userId === ctx.caller.user.id,
        }));
      department.userCount = members.length;
      department.projectCount = projects.length;
    }
    return department;
  }

  private async getTenantOr404(
    credentials: BackstageCredentials,
    departmentId: string,
  ) {
    try {
      return await this.tenants.getTenant(credentials, departmentId);
    } catch (error) {
      if ((error as Error).name === 'NotFoundError') {
        throw notFound('DEPARTMENT_NOT_FOUND', 'Department not found');
      }
      throw error;
    }
  }

  private async ministryNames() {
    const ministries = await this.repos.ministries.list();
    return new Map(ministries.map(m => [m.id, { id: m.id, name: m.name }]));
  }

  /** Places seeded organizations under their ministry, once. */
  private async applySeedAssignments(
    tenants: PlatformTenant[],
    profiles: Map<string, DepartmentProfile>,
  ) {
    for (const tenant of tenants) {
      const seed = this.seedAssignments.get(tenant.slug);
      if (!seed || profiles.has(tenant.id)) {
        continue;
      }
      const ministry = await this.repos.ministries.getByName(seed.ministryName);
      if (!ministry) {
        continue;
      }
      // Concurrent requests may seed the same department: first one wins
      await this.repos.departments.insertIfMissing(tenant.id, {
        ministryId: ministry.id,
        userLimit: seed.userLimit,
        projectLimit: seed.projectLimit,
      });
      const profile = await this.repos.departments.get(tenant.id);
      if (profile) {
        profiles.set(tenant.id, profile);
      }
    }
  }
}
