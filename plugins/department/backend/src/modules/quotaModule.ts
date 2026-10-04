import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { ServiceUnavailableError } from '@backstage/errors';
import { tenantQuotaExtensionPoint } from '@internal/plugin-tenant-backend';

/**
 * Makes the tenant plugin enforce each department's user and project limits
 * whenever members or projects are added, from any UI.
 *
 * Fails closed: if the limits cannot be read, the addition is refused.
 */
export const tenantModuleDepartmentQuota = createBackendModule({
  pluginId: 'tenant',
  moduleId: 'department-quota',
  register(reg) {
    reg.registerInit({
      deps: {
        quota: tenantQuotaExtensionPoint,
        discovery: coreServices.discovery,
        auth: coreServices.auth,
      },
      async init({ quota, discovery, auth }) {
        quota.setQuotaProvider({
          async getLimits(tenantId) {
            const [baseUrl, { token }] = await Promise.all([
              discovery.getBaseUrl('department'),
              auth.getPluginRequestToken({
                onBehalfOf: await auth.getOwnServiceCredentials(),
                targetPluginId: 'department',
              }),
            ]);
            const response = await fetch(
              `${baseUrl}/internal/departments/${encodeURIComponent(
                tenantId,
              )}/limits`,
              { headers: { Authorization: `Bearer ${token}` } },
            );
            if (!response.ok) {
              throw new ServiceUnavailableError(
                'Could not check the department limits',
              );
            }
            return response.json();
          },
        });
      },
    });
  },
});
