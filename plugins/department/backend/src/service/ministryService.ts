import { RequestContext } from '../auth/tenantContext';
import { DepartmentAuthorizer } from '../auth/authorization';
import { isUniqueViolation } from '../database/knex';
import { Repositories } from '../database/repository';
import { slugify } from '../models/department';
import { Ministry } from '../types';
import { AuditService } from './auditService';
import { badRequest, conflict, notFound } from './errors';

/** Ministries group departments. Platform-level: platform admins only. */
export class MinistryService {
  constructor(
    private readonly repos: Repositories,
    private readonly authz: DepartmentAuthorizer,
    private readonly audit: AuditService,
  ) {}

  async list(ctx: RequestContext): Promise<Ministry[]> {
    this.authz.requirePlatformAdmin(ctx.caller);
    return this.repos.ministries.list();
  }

  async get(ctx: RequestContext, id: string): Promise<Ministry> {
    this.authz.requirePlatformAdmin(ctx.caller);
    return this.getOr404(id);
  }

  async create(
    ctx: RequestContext,
    input: { name: string; description?: string },
  ) {
    this.authz.requirePlatformAdmin(ctx.caller);
    const id = await this.write(() =>
      this.repos.ministries.create({
        ...input,
        slug: this.slugFor(input.name),
      }),
    );
    await this.audit.record(ctx.caller, {
      action: 'MINISTRY_CREATED',
      resourceType: 'ministry',
      resourceId: id,
      metadata: { name: input.name },
    });
    return this.getOr404(id);
  }

  async update(
    ctx: RequestContext,
    id: string,
    changes: { name?: string; description?: string },
  ) {
    this.authz.requirePlatformAdmin(ctx.caller);
    await this.getOr404(id);
    await this.write(() =>
      this.repos.ministries.update(id, {
        ...changes,
        ...(changes.name ? { slug: this.slugFor(changes.name) } : {}),
      }),
    );
    await this.audit.record(ctx.caller, {
      action: 'MINISTRY_UPDATED',
      resourceType: 'ministry',
      resourceId: id,
      metadata: { fields: Object.keys(changes).join(',') },
    });
    return this.getOr404(id);
  }

  async delete(ctx: RequestContext, id: string) {
    this.authz.requirePlatformAdmin(ctx.caller);
    const ministry = await this.getOr404(id);
    if (ministry.departmentCount > 0) {
      throw conflict(
        'MINISTRY_HAS_DEPARTMENTS',
        'Move or delete the departments of this ministry first',
      );
    }
    await this.repos.ministries.delete(id);
    await this.audit.record(ctx.caller, {
      action: 'MINISTRY_DELETED',
      resourceType: 'ministry',
      resourceId: id,
      metadata: { name: ministry.name },
    });
  }

  private async getOr404(id: string) {
    const ministry = await this.repos.ministries.get(id);
    if (!ministry) {
      throw notFound('MINISTRY_NOT_FOUND', 'Ministry not found');
    }
    return ministry;
  }

  private slugFor(name: string) {
    const slug = slugify(name);
    if (!slug) {
      throw badRequest(
        'VALIDATION_FAILED',
        'Invalid name: must contain letters or digits',
      );
    }
    return slug;
  }

  private async write<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict(
          'MINISTRY_EXISTS',
          'A ministry with this name already exists',
        );
      }
      throw error;
    }
  }
}
