import { RequestContext } from '../auth/tenantContext';
import { DepartmentAuthorizer } from '../auth/authorization';
import { TenantDirectory } from '../clients/TenantClient';
import { DepartmentProject } from '../types';

/**
 * Projects of a department. Projects are created and managed by department
 * admins in the organization UI (tenant plugin), where the project limit is
 * enforced; this service gives the role-appropriate read view.
 */
export class DepartmentProjectService {
  constructor(
    private readonly tenants: TenantDirectory,
    private readonly authz: DepartmentAuthorizer,
  ) {}

  /**
   * Platform admins and department admins see every project; users only the
   * projects assigned to them (filtered by the tenant plugin).
   */
  async list(
    ctx: RequestContext,
    departmentId: string,
  ): Promise<DepartmentProject[]> {
    const role = this.authz.roleIn(ctx.caller, departmentId);
    const projects =
      role === 'PLATFORM_ADMIN'
        ? await this.tenants.listProjectsAsAdmin(ctx.credentials, departmentId)
        : await this.tenants.listProjects(ctx.credentials, departmentId);
    return projects.map(p => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      environmentCount: p.environmentCount,
      assignedMemberCount: p.assignedMemberCount,
      updatedAt: p.updatedAt,
    }));
  }
}
