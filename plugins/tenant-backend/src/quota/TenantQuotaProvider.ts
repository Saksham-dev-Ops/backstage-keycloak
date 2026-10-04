import { createExtensionPoint } from '@backstage/backend-plugin-api';
import { ConflictError } from '@backstage/errors';

/** Maximum members and projects of a tenant; undefined means unlimited. */
export type TenantLimits = {
  maxMembers?: number;
  maxProjects?: number;
};

/**
 * Supplies per-tenant limits, for example from the department plugin. Without
 * a provider, tenants are unlimited.
 */
export interface TenantQuotaProvider {
  getLimits(tenantId: string): Promise<TenantLimits>;
}

export interface TenantQuotaExtensionPoint {
  setQuotaProvider(provider: TenantQuotaProvider): void;
}

export const tenantQuotaExtensionPoint =
  createExtensionPoint<TenantQuotaExtensionPoint>({
    id: 'tenant.quota-provider',
  });

export const unlimitedQuota: TenantQuotaProvider = {
  async getLimits() {
    return {};
  },
};

/** Throws a 409 when adding one more item would exceed the limit. */
export function assertWithinLimit(
  limit: number | undefined,
  current: number,
  what: 'user' | 'project',
) {
  if (limit !== undefined && current >= limit) {
    throw new ConflictError(
      `The ${what} limit of this organization (${limit}) has been reached`,
    );
  }
}
