import { PlatformTenant, TenantAdmin } from '../clients/TenantClient';
import {
  AdminProfile,
  DepartmentProfile,
} from '../database/departmentRepository';
import { CAPABILITY_IDS } from './capabilities';
import {
  Department,
  DepartmentRole,
  DepartmentStats,
  DepartmentStatus,
  Ministry,
} from '../types';

/**
 * - suspended: the tenant is suspended
 * - no_admin: nobody is OWNER or ADMIN
 * - invite_pending: admins are assigned but none has signed in yet
 * - active: otherwise
 */
export function deriveStatus(
  tenant: { status: string },
  admins: TenantAdmin[],
): DepartmentStatus {
  if (tenant.status !== 'active') {
    return 'suspended';
  }
  if (!admins.length) {
    return 'no_admin';
  }
  return admins.some(a => a.lastSignInAt) ? 'active' : 'invite_pending';
}

export function toDepartment(
  tenant: PlatformTenant,
  profile: DepartmentProfile | undefined,
  ministries: Map<string, Pick<Ministry, 'id' | 'name'>>,
  callerRole: DepartmentRole,
  adminProfiles?: Map<string, AdminProfile>,
): Department {
  const ministry = profile?.ministryId
    ? ministries.get(profile.ministryId)
    : undefined;
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    status: deriveStatus(tenant, tenant.admins),
    ministry: ministry ? { id: ministry.id, name: ministry.name } : undefined,
    admins: tenant.admins.map(a => ({
      userId: a.userId,
      name: a.name,
      email: a.email,
      role: a.role,
      hasSignedIn: !!a.lastSignInAt,
      designation: adminProfiles?.get(a.email)?.designation,
      mobile: adminProfiles?.get(a.email)?.mobile,
    })),
    userCount: tenant.memberCount,
    projectCount: tenant.projectCount,
    userLimit: profile?.userLimit,
    projectLimit: profile?.projectLimit,
    createdAt: tenant.createdAt,
    ...profileFields(tenant.slug, profile),
    callerRole,
  };
}

/** Fields of a department that come from its profile and slug. */
export function profileFields(
  slug: string,
  profile: DepartmentProfile | undefined,
) {
  return {
    shortCode: slug.toUpperCase(),
    // Departments from before capabilities keep all of them
    capabilities: profile?.capabilities ?? [...CAPABILITY_IDS],
    adminsCanApproveJoinRequests:
      profile?.adminsCanApproveJoinRequests ?? false,
    adminsCanCreateCustomRoles: profile?.adminsCanCreateCustomRoles ?? false,
  };
}

export function computeStats(departments: Department[]): DepartmentStats {
  const count = (status: DepartmentStatus) =>
    departments.filter(d => d.status === status).length;
  return {
    total: departments.length,
    active: count('active'),
    invitePending: count('invite_pending'),
    noAdmin: count('no_admin'),
    suspended: count('suspended'),
  };
}

/** Lowercase letters, digits and single dashes; at most 63 characters. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/g, '');
}
