import { randomUUID } from 'node:crypto';
import { Knex, toIso } from '../knex';

export const AUDIT_ACTIONS = [
  'USER_LOGIN',
  'INVITE_CREATED',
  'INVITE_ACCEPTED',
  'TENANT_CREATED',
  'TENANT_UPDATED',
  'TENANT_DELETED',
  'TENANT_SWITCH',
  'PROJECT_CREATED',
  'PROJECT_UPDATED',
  'PROJECT_DELETED',
  'ENVIRONMENT_CREATED',
  'ENVIRONMENT_DELETED',
  'CONFIG_CREATED',
  'CONFIG_UPDATED',
  'CONFIG_DELETED',
  'SECRET_ACCESSED',
  'SECRET_UPDATED',
  'USER_ADDED',
  'USER_REMOVED',
  'ROLE_CHANGED',
  'PROJECT_MEMBER_ADDED',
  'PROJECT_MEMBER_REMOVED',
  'PLUGIN_ENABLED',
  'PLUGIN_DISABLED',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditEntry = {
  tenantId?: string;
  userId?: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  /** Must never contain secret or configuration values */
  metadata?: Record<string, string | number | boolean | null>;
};

export type AuditLog = AuditEntry & { id: string; createdAt: string };

export class AuditLogRepository {
  constructor(private readonly db: Knex) {}

  async insert(entry: AuditEntry) {
    await this.db('audit_logs').insert({
      id: randomUUID(),
      tenant_id: entry.tenantId ?? null,
      user_id: entry.userId ?? null,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId ?? null,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
    });
  }

  async list(tenantId: string, limit: number): Promise<AuditLog[]> {
    const rows = await this.db('audit_logs')
      .where({ tenant_id: tenantId })
      .orderBy('created_at', 'desc')
      .limit(limit);
    return rows.map(row => ({
      id: row.id,
      tenantId: row.tenant_id ?? undefined,
      userId: row.user_id ?? undefined,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id ?? undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: toIso(row.created_at),
    }));
  }
}
