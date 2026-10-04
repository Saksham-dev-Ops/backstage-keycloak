import { randomUUID } from 'node:crypto';
import { AuditLogEntry } from '../types';
import { Knex, toIso } from './knex';

export type AuditAction =
  | 'DEPARTMENT_CREATED'
  | 'DEPARTMENT_UPDATED'
  | 'DEPARTMENT_SUSPENDED'
  | 'DEPARTMENT_ACTIVATED'
  | 'DEPARTMENT_DELETED'
  | 'DEPARTMENT_USER_ADDED'
  | 'DEPARTMENT_USER_UPDATED'
  | 'DEPARTMENT_USER_REMOVED'
  | 'DEPARTMENT_USER_INVITED'
  | 'MINISTRY_CREATED'
  | 'MINISTRY_UPDATED'
  | 'MINISTRY_DELETED';

export type NewAuditEntry = {
  departmentId?: string;
  actor: { id: string; email: string };
  action: AuditAction;
  resourceType: 'department' | 'ministry' | 'user';
  resourceId?: string;
  /** Must never contain passwords or other secrets */
  metadata?: Record<string, string | number | boolean | null>;
};

export class AuditRepository {
  constructor(private readonly db: Knex) {}

  async insert(entry: NewAuditEntry) {
    await this.db('department_audit_logs').insert({
      id: randomUUID(),
      tenant_id: entry.departmentId ?? null,
      actor_user_id: entry.actor.id,
      actor_email: entry.actor.email,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId ?? null,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
    });
  }

  async list(options: {
    limit: number;
    departmentId?: string;
  }): Promise<AuditLogEntry[]> {
    const query = this.db('department_audit_logs')
      .orderBy('created_at', 'desc')
      .limit(options.limit);
    if (options.departmentId) {
      query.where({ tenant_id: options.departmentId });
    }
    const rows = await query;
    return rows.map(row => ({
      id: row.id,
      departmentId: row.tenant_id ?? undefined,
      actorUserId: row.actor_user_id ?? undefined,
      actorEmail: row.actor_email ?? undefined,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id ?? undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: toIso(row.created_at),
    }));
  }
}
