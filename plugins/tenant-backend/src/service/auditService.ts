import { LoggerService } from '@backstage/backend-plugin-api';
import { AuditEntry, AuditLog, Repositories } from '../database/repository';

/** Records security-relevant actions. Entries must never contain secret values. */
export class AuditService {
  constructor(
    private readonly repos: Repositories,
    private readonly logger: LoggerService,
  ) {}

  async record(entry: AuditEntry) {
    await this.repos.auditLogs.insert(entry);
    this.logger.info(`Audit: ${entry.action}`, {
      tenantId: entry.tenantId,
      userId: entry.userId,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
    });
  }

  list(tenantId: string, limit: number): Promise<AuditLog[]> {
    return this.repos.auditLogs.list(tenantId, limit);
  }
}
