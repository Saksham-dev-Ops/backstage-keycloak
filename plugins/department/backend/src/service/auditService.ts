import { LoggerService } from '@backstage/backend-plugin-api';
import { NewAuditEntry } from '../database/auditRepository';
import { Repositories } from '../database/repository';
import { RequestContext } from '../auth/tenantContext';
import { DepartmentAuthorizer } from '../auth/authorization';
import { CallerContext } from '../types';

/** Records what platform and department admins change. Never stores secrets. */
export class AuditService {
  constructor(
    private readonly repos: Repositories,
    private readonly authz: DepartmentAuthorizer,
    private readonly logger: LoggerService,
  ) {}

  async record(caller: CallerContext, entry: Omit<NewAuditEntry, 'actor'>) {
    await this.repos.audit.insert({
      ...entry,
      actor: { id: caller.user.id, email: caller.user.email },
    });
    this.logger.info(`Audit: ${entry.action}`, {
      departmentId: entry.departmentId,
      userId: caller.user.id,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
    });
  }

  async list(
    ctx: RequestContext,
    options: { limit: number; departmentId?: string },
  ) {
    this.authz.requirePlatformAdmin(ctx.caller);
    return this.repos.audit.list(options);
  }
}
