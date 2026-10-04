import { LoggerService } from '@backstage/backend-plugin-api';
import { DepartmentAuthorizer } from '../auth/authorization';
import { TenantDirectory } from '../clients/TenantClient';
import { Repositories } from '../database/repository';
import { AuditService } from './auditService';
import { DepartmentService, SeedAssignments } from './departmentService';
import { MinistryService } from './ministryService';
import { DepartmentProjectService } from './projectService';
import { DepartmentUserService } from './userService';
import { CAPABILITIES } from '../models/capabilities';

export type Services = ReturnType<typeof createServices>;

export function createServices(options: {
  repos: Repositories;
  tenants: TenantDirectory;
  logger: LoggerService;
  seedAssignments?: SeedAssignments;
}) {
  const { repos, tenants, logger, seedAssignments } = options;
  const authz = new DepartmentAuthorizer();
  const audit = new AuditService(repos, authz, logger);
  return {
    authz,
    audit,
    departments: new DepartmentService(
      repos,
      tenants,
      authz,
      audit,
      logger,
      seedAssignments,
    ),
    ministries: new MinistryService(repos, authz, audit),
    users: new DepartmentUserService(repos, tenants, authz, audit),
    projects: new DepartmentProjectService(tenants, authz),
    capabilities: CAPABILITIES,
  };
}
