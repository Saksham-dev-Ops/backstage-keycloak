/**
 * Roles of the department plugin, derived on every request from the tenant
 * plugin (never stored here or taken from the client):
 * - PLATFORM_ADMIN: `tenant.platformAdmins`, every department
 * - ORGANIZATION_ADMIN: OWNER or ADMIN of the department's tenant
 * - USER: DEVELOPER or VIEWER of the department's tenant
 */
export const DEPARTMENT_ROLES = [
  'PLATFORM_ADMIN',
  'ORGANIZATION_ADMIN',
  'USER',
] as const;
export type DepartmentRole = (typeof DEPARTMENT_ROLES)[number];

/** Roles inside a tenant, as defined by the tenant plugin. */
export const TENANT_ROLES = ['OWNER', 'ADMIN', 'DEVELOPER', 'VIEWER'] as const;
export type TenantRole = (typeof TENANT_ROLES)[number];

export const DEPARTMENT_STATUSES = [
  'active',
  'invite_pending',
  'no_admin',
  'suspended',
] as const;
export type DepartmentStatus = (typeof DEPARTMENT_STATUSES)[number];

export type Ministry = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  departmentCount: number;
  createdAt: string;
  updatedAt: string;
};

export type DepartmentAdmin = {
  userId: string;
  name: string;
  email: string;
  role: TenantRole;
  hasSignedIn: boolean;
  /** From the onboarding form; only shown to platform admins */
  designation?: string;
  mobile?: string;
};

export type Department = {
  /** The tenant id */
  id: string;
  name: string;
  slug: string;
  status: DepartmentStatus;
  ministry?: { id: string; name: string };
  admins: DepartmentAdmin[];
  /** Only known to platform and organization admins */
  userCount?: number;
  projectCount?: number;
  /** Undefined means unlimited */
  userLimit?: number;
  projectLimit?: number;
  createdAt?: string;
  /** Uppercase; the tenant slug. Unique and immutable. */
  shortCode: string;
  /** Enabled capability ids (see GET /capabilities) */
  capabilities: string[];
  adminsCanApproveJoinRequests: boolean;
  adminsCanCreateCustomRoles: boolean;
  /** The caller's role in this department */
  callerRole: DepartmentRole;
};

/** A one-time link for a new admin to set their password */
export type AdminInvite = {
  userId: string;
  email: string;
  name: string;
  token: string;
  expiresAt: string;
};

export type DepartmentUser = {
  userId: string;
  name: string;
  email: string;
  role: TenantRole;
  createdAt: string;
  lastSignInAt?: string;
  /** Platform admin view only: whether the user has set a password */
  hasPassword?: boolean;
  designation?: string;
};

export type DepartmentProject = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  environmentCount: number;
  assignedMemberCount?: number;
  updatedAt: string;
};

export type DepartmentStats = {
  total: number;
  active: number;
  invitePending: number;
  noAdmin: number;
  suspended: number;
};

export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type AuditLogEntry = {
  id: string;
  departmentId?: string;
  actorUserId?: string;
  actorEmail?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

/** The authenticated caller, resolved from the Backstage token. */
export type CallerContext = {
  user: { id: string; email: string; name: string };
  isPlatformAdmin: boolean;
  /** Active tenants the caller is a member of, with their tenant role */
  memberships: Array<{
    id: string;
    name: string;
    slug: string;
    role: TenantRole;
  }>;
};
