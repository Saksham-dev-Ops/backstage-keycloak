/*
 * Hi!
 *
 * Note that this is an EXAMPLE Backstage backend. Please check the README.
 *
 * Happy hacking!
 */

import { createBackend } from '@backstage/backend-defaults';
import { authModuleTenantKeycloakProvider } from '@internal/plugin-tenant-backend';
import { tenantModuleDepartmentQuota } from '@internal/plugin-department-backend';

const backend = createBackend();

backend.add(import('@backstage/plugin-app-backend'));
backend.add(import('@backstage/plugin-proxy-backend'));

// scaffolder plugin
backend.add(import('@backstage/plugin-scaffolder-backend'));
backend.add(import('@backstage/plugin-scaffolder-backend-module-github'));
backend.add(
  import('@backstage/plugin-scaffolder-backend-module-notifications'),
);

// techdocs plugin
backend.add(import('@backstage/plugin-techdocs-backend'));

// tenant plugin: tenants, memberships, projects, environments and configuration
backend.add(import('@internal/plugin-tenant-backend'));

// department plugin: ministries and department limits for the platform admin console.
// Departments are the tenants above; the quota module makes the tenant plugin
// enforce each department's user and project limits.
backend.add(import('@internal/plugin-department-backend'));
backend.add(tenantModuleDepartmentQuota);

// auth plugin
backend.add(import('@backstage/plugin-auth-backend'));
// Keycloak sign-in (`oidc` provider, configured under auth.providers.oidc), the
// only way to sign in. Keycloak users are matched to tenant users by verified email.
backend.add(authModuleTenantKeycloakProvider);

// catalog plugin
backend.add(import('@backstage/plugin-catalog-backend'));

backend.add(
  import('@internal/plugin-catalog-backend-module-database'),
);
backend.add(
  import('@backstage/plugin-catalog-backend-module-scaffolder-entity-model'),
);

// See https://backstage.io/docs/features/software-catalog/configuration#subscribing-to-catalog-errors
backend.add(import('@backstage/plugin-catalog-backend-module-logs'));

// permission plugin
backend.add(import('@backstage/plugin-permission-backend'));
// See https://backstage.io/docs/permissions/getting-started for how to create your own permission policy
// Tenant isolation for projects/configuration is enforced inside the tenant plugin itself.
backend.add(
  import('@backstage/plugin-permission-backend-module-allow-all-policy'),
);

// search plugin
backend.add(import('@backstage/plugin-search-backend'));

// search engine
// See https://backstage.io/docs/features/search/search-engines
backend.add(import('@backstage/plugin-search-backend-module-pg'));

// search collators
backend.add(import('@backstage/plugin-search-backend-module-catalog'));
backend.add(import('@backstage/plugin-search-backend-module-techdocs'));

// kubernetes plugin
backend.add(import('@backstage/plugin-kubernetes-backend'));

// user settings plugin
backend.add(import('@backstage/plugin-user-settings-backend'));

// notifications and signals plugins
backend.add(import('@backstage/plugin-notifications-backend'));
backend.add(import('@backstage/plugin-signals-backend'));

// mcp actions plugin
backend.add(import('@backstage/plugin-mcp-actions-backend'));
backend.add(import('@internal/backstage-plugin-companydata-backend'));


backend.start();
