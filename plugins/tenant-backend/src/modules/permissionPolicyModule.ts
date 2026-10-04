import { createBackendModule } from '@backstage/backend-plugin-api';
import { parseEntityRef } from '@backstage/catalog-model';
import {
  catalogConditions,
  createCatalogConditionalDecision,
} from '@backstage/plugin-catalog-backend/alpha';
import {
  AuthorizeResult,
  isResourcePermission,
  PermissionCondition,
  PermissionCriteria,
  PolicyDecision,
} from '@backstage/plugin-permission-common';
import {
  PermissionPolicy,
  PolicyQuery,
  PolicyQueryUser,
} from '@backstage/plugin-permission-node';
import { policyExtensionPoint } from '@backstage/plugin-permission-node/alpha';
import { TENANT_GROUP_NAMESPACE } from '../auth/identity';

/** Matches the catalog Group entity of a tenant. */
function isTenantGroup(slug: string): PermissionCriteria<PermissionCondition<'catalog-entity'>> {
  return {
    allOf: [
      catalogConditions.isEntityKind({ kinds: ['Group'] }),
      catalogConditions.hasMetadata({ key: 'namespace', value: TENANT_GROUP_NAMESPACE }),
      catalogConditions.hasMetadata({ key: 'name', value: slug }),
    ],
  };
}

/** Kinds that are shared by all tenants. */
const SHARED_KINDS = ['Template', 'User'];

/**
 * Tenant isolation for the catalog: users can see and act on entities owned
 * (`spec.owner`) by one of their tenants' groups or by themselves, plus the
 * Group entities of their own tenants and shared kinds such as Templates.
 * Everything else is allowed; tenant data outside the catalog is protected by
 * the tenant plugin itself.
 */
export class TenantPermissionPolicy implements PermissionPolicy {
  async handle(request: PolicyQuery, user?: PolicyQueryUser): Promise<PolicyDecision> {
    if (!isResourcePermission(request.permission, 'catalog-entity')) {
      return { result: AuthorizeResult.ALLOW };
    }

    const claims = user?.info.ownershipEntityRefs ?? [];
    const tenantSlugs = claims
      .map(ref => parseEntityRef(ref))
      .filter(ref => ref.kind === 'group' && ref.namespace === TENANT_GROUP_NAMESPACE)
      .map(ref => ref.name);

    return createCatalogConditionalDecision(request.permission, {
      anyOf: [
        catalogConditions.isEntityOwner({ claims }),
        catalogConditions.isEntityKind({ kinds: SHARED_KINDS }),
        ...tenantSlugs.map(isTenantGroup),
      ],
    });
  }
}

export const permissionModuleTenantPolicy = createBackendModule({
  pluginId: 'permission',
  moduleId: 'tenant-policy',
  register(reg) {
    reg.registerInit({
      deps: { policy: policyExtensionPoint },
      async init({ policy }) {
        policy.setPolicy(new TenantPermissionPolicy());
      },
    });
  },
});
