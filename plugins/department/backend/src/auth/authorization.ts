import { forbidden, notFound } from '../service/errors';
import { CallerContext, DepartmentRole, TenantRole } from '../types';

const ADMIN_ROLES: ReadonlySet<TenantRole> = new Set(['OWNER', 'ADMIN']);

export function departmentRoleFor(tenantRole: TenantRole): DepartmentRole {
  return ADMIN_ROLES.has(tenantRole) ? 'ORGANIZATION_ADMIN' : 'USER';
}

/**
 * The single place where access to departments is decided.
 *
 * - PLATFORM_ADMIN: every department (cross-tenant)
 * - ORGANIZATION_ADMIN: their own departments, including users and projects
 * - USER: their own departments, and only the projects assigned to them
 *
 * Departments the caller cannot see are reported as not found, so that their
 * existence is not leaked.
 */
export class DepartmentAuthorizer {
  requirePlatformAdmin(caller: CallerContext) {
    if (!caller.isPlatformAdmin) {
      throw forbidden('Only platform admins can do this');
    }
  }

  /** The caller's role in a department, or a 404 if they cannot see it. */
  roleIn(caller: CallerContext, departmentId: string): DepartmentRole {
    if (caller.isPlatformAdmin) {
      return 'PLATFORM_ADMIN';
    }
    const membership = caller.memberships.find(m => m.id === departmentId);
    if (!membership) {
      throw notFound('DEPARTMENT_NOT_FOUND', 'Department not found');
    }
    return departmentRoleFor(membership.role);
  }

  /** Platform admins and the department's own admins. */
  requireDepartmentAdmin(
    caller: CallerContext,
    departmentId: string,
  ): DepartmentRole {
    const role = this.roleIn(caller, departmentId);
    if (role === 'USER') {
      throw forbidden('Only admins of this department can do this');
    }
    return role;
  }
}
