import { HttpAuthService } from '@backstage/backend-plugin-api';
import { parseEntityRef } from '@backstage/catalog-model';
import { AuthenticationError } from '@backstage/errors';
import { Request } from 'express';
import { User } from '../types';
import { UserService } from '../service/userService';
import { idSchema } from '../validation';

/**
 * Backstage identities issued by the tenant sign-in resolver have the form
 * `user:default/<application user id>`.
 */
export function userEntityRefFor(userId: string) {
  return `user:default/${userId}`;
}

/** Catalog namespace holding one Group entity per tenant. */
export const TENANT_GROUP_NAMESPACE = 'tenant';

/**
 * Each tenant is a catalog Group, `group:tenant/<slug>`. Catalog entities
 * belong to a tenant by setting it as `spec.owner`, and members carry it in
 * their ownership claims.
 */
export function tenantGroupRefFor(slug: string) {
  return `group:${TENANT_GROUP_NAMESPACE}/${slug}`;
}

export class IdentityResolver {
  constructor(
    private readonly httpAuth: HttpAuthService,
    private readonly users: UserService,
  ) {}

  /** Returns the application user behind the request's Backstage token. */
  async resolveUser(req: Request): Promise<User> {
    const credentials = await this.httpAuth.credentials(req, { allow: ['user'] });
    const ref = parseEntityRef(credentials.principal.userEntityRef);
    const user =
      // Other identities (e.g. `user:default/guest`) are not ids: PostgreSQL
      // would reject them in a uuid comparison
      ref.kind === 'user' && ref.namespace === 'default' && idSchema.safeParse(ref.name).success
        ? await this.users.getById(ref.name)
        : undefined;
    if (!user) {
      throw new AuthenticationError('User is not registered with any tenant');
    }
    return user;
  }
}
