import {
  BackstageCredentials,
  HttpAuthService,
} from '@backstage/backend-plugin-api';
import { Request } from 'express';
import { TenantDirectory } from '../clients/TenantClient';
import { CallerContext } from '../types';

/** The verified Backstage credentials of a request plus the resolved caller. */
export type RequestContext = {
  credentials: BackstageCredentials;
  caller: CallerContext;
};

/**
 * Resolves who is calling and which tenants (departments) they belong to.
 * Everything comes from the verified Backstage token and the tenant plugin's
 * database: tenant ids, roles or headers sent by the client are never trusted.
 */
export class TenantContextResolver {
  constructor(
    private readonly httpAuth: HttpAuthService,
    private readonly tenants: TenantDirectory,
  ) {}

  async resolve(req: Request): Promise<RequestContext> {
    const credentials = await this.httpAuth.credentials(req, {
      allow: ['user'],
    });
    const me = await this.tenants.me(credentials);
    return {
      credentials,
      caller: {
        user: me.user,
        isPlatformAdmin: me.isPlatformAdmin,
        // `/me` only lists active tenants the user is a member of
        memberships: me.tenants
          .filter(t => t.status === 'active')
          .map(({ id, name, slug, role }) => ({ id, name, slug, role })),
      },
    };
  }
}
