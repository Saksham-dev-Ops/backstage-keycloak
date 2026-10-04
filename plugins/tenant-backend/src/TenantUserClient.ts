import { AuthService, DiscoveryService } from '@backstage/backend-plugin-api';
import { ResponseError } from '@backstage/errors';

export type ResolvedTenantUser = {
  userId: string;
  userEntityRef: string;
  /** Catalog groups of the user's active tenants, `group:tenant/<slug>` */
  ownershipEntityRefs: string[];
  email: string;
  name: string;
};

/** Lets the auth plugin resolve application users through the tenant plugin. */
export class TenantUserClient {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly auth: AuthService,
  ) {}

  /** Returns undefined if there is no registered user with tenant access. */
  async resolve(
    query: { email: string } | { userId: string },
    provider: string,
  ): Promise<ResolvedTenantUser | undefined> {
    const baseUrl = await this.discovery.getBaseUrl('tenant');
    const { token } = await this.auth.getPluginRequestToken({
      onBehalfOf: await this.auth.getOwnServiceCredentials(),
      targetPluginId: 'tenant',
    });
    const response = await fetch(`${baseUrl}/internal/resolve-user`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...query, provider }),
    });
    if (response.status === 404) {
      return undefined;
    }
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }
    return response.json();
  }

  /** All active tenants, for publishing them to the catalog. */
  async listTenants(): Promise<Array<{ id: string; name: string; slug: string }>> {
    const baseUrl = await this.discovery.getBaseUrl('tenant');
    const { token } = await this.auth.getPluginRequestToken({
      onBehalfOf: await this.auth.getOwnServiceCredentials(),
      targetPluginId: 'tenant',
    });
    const response = await fetch(`${baseUrl}/internal/tenants`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }
    return (await response.json()).items;
  }
}
