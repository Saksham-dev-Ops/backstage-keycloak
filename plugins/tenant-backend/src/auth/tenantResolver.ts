import { InputError } from '@backstage/errors';
import { Request } from 'express';
import { AuthorizationService } from '../service/authorizationService';
import { TenantContext, User } from '../types';
import { idSchema } from '../validation';

export const TENANT_HEADER = 'x-tenant-id';

/**
 * Establishes the current tenant from the `x-tenant-id` header. The header is
 * only a selector: membership is verified against the database on every
 * request, so a forged header yields a 404.
 */
export class TenantResolver {
  constructor(private readonly authz: AuthorizationService) {}

  async resolve(req: Request, user: User): Promise<TenantContext> {
    const tenantId = req.header(TENANT_HEADER);
    if (!tenantId) {
      throw new InputError(`Missing ${TENANT_HEADER} header`);
    }
    if (!idSchema.safeParse(tenantId).success) {
      throw new InputError(`Invalid ${TENANT_HEADER} header`);
    }
    return this.authz.authorizeTenantAccess(user, tenantId);
  }
}
