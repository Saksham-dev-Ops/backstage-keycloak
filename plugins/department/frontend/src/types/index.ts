/**
 * Types of the department API. Kept separate from the backend package, which
 * the frontend must not depend on.
 */
export type DepartmentRole = 'PLATFORM_ADMIN' | 'ORGANIZATION_ADMIN' | 'USER';
export type TenantRole = 'OWNER' | 'ADMIN' | 'DEVELOPER' | 'VIEWER';
export const TENANT_ROLES: TenantRole[] = [
  'OWNER',
  'ADMIN',
  'DEVELOPER',
  'VIEWER',
];

export type DepartmentStatus =
  | 'active'
  | 'invite_pending'
  | 'no_admin'
  | 'suspended';
export const DEPARTMENT_STATUSES: DepartmentStatus[] = [
  'active',
  'invite_pending',
  'no_admin',
  'suspended',
];

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
  designation?: string;
  mobile?: string;
};

/** An area a department can use, with the tools it includes */
export type Capability = {
  id: string;
  title: string;
  description: string;
  included: string[];
  comingSoon: string[];
};

/** A one-time link for a new admin to set their password */
export type AdminInvite = {
  userId: string;
  email: string;
  name: string;
  token: string;
  expiresAt: string;
};

export type Department = {
  id: string;
  name: string;
  slug: string;
  status: DepartmentStatus;
  ministry?: { id: string; name: string };
  admins: DepartmentAdmin[];
  userCount?: number;
  projectCount?: number;
  userLimit?: number;
  projectLimit?: number;
  createdAt?: string;
  shortCode: string;
  capabilities: string[];
  adminsCanApproveJoinRequests: boolean;
  adminsCanCreateCustomRoles: boolean;
  callerRole: DepartmentRole;
};

export type DepartmentUser = {
  userId: string;
  name: string;
  email: string;
  role: TenantRole;
  createdAt: string;
  lastSignInAt?: string;
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

export type DepartmentQuery = {
  page: number;
  pageSize: number;
  ministryId?: string;
  status?: DepartmentStatus;
  search?: string;
  admin?: string;
};

export type NewDepartmentAdmin = {
  name: string;
  email: string;
  designation: string;
  /** With country code, e.g. "+91 9876543210" */
  mobile: string;
};

export type CreateDepartmentRequest = {
  ministryId: string;
  name: string;
  shortCode: string;
  capabilities: string[];
  userLimit: number;
  projectLimit: number;
  adminsCanApproveJoinRequests: boolean;
  adminsCanCreateCustomRoles: boolean;
  admins: NewDepartmentAdmin[];
};

export type CreateDepartmentResponse = {
  department: Department;
  /** Returned once: links for new admins to set their password */
  invites: AdminInvite[];
};

export type UpdateDepartmentRequest = {
  name?: string;
  ministryId?: string;
  userLimit?: number | null;
  projectLimit?: number | null;
  status?: 'active' | 'suspended';
};

export type AddUserRequest = {
  name?: string;
  email: string;
  role: TenantRole;
  password?: string;
};

/** Error returned by the API: `{ error: { code, message } }` */
export class DepartmentApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = 'DepartmentApiError';
  }
}
