import { ReactNode, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { alertApiRef, useApi } from '@backstage/core-plugin-api';
import { FetchMiddleware } from '@backstage/core-app-api';
import {
  findTenantPluginForPath,
  getCurrentTenantId,
  useTenant,
} from '@internal/backstage-plugin-tenant-react';

const TENANT_HEADER = 'x-tenant-id';

/**
 * Sends the selected organization to every backend plugin, so that the
 * backend can block plugins the organization has turned off.
 */
export function injectTenantHeader(backendBaseUrl: string): FetchMiddleware {
  const base = backendBaseUrl.replace(/\/$/, '');
  return {
    apply: next => async (input, init) => {
      const tenantId = getCurrentTenantId();
      const request = new Request(input, init);
      const isBackend = request.url === base || request.url.startsWith(`${base}/`);
      if (!tenantId || !isBackend || request.headers.has(TENANT_HEADER)) {
        return next(input, init);
      }
      request.headers.set(TENANT_HEADER, tenantId);
      return next(request);
    },
  };
}

/**
 * Keeps users out of the pages of plugins that their organization turned off,
 * including via direct links, by sending them back to the home page.
 */
export function TenantPluginGuard(props: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const alertApi = useApi(alertApiRef);
  const { currentTenant, plugins, isPluginEnabled } = useTenant();

  const pluginId = findTenantPluginForPath(pathname);
  const blocked = !!currentTenant && !!pluginId && !isPluginEnabled(pluginId);

  useEffect(() => {
    if (!blocked || !currentTenant) {
      return;
    }
    const title = plugins.find(p => p.id === pluginId)?.title ?? 'This plugin';
    alertApi.post({
      message: `${title} is not enabled for ${currentTenant.name}`,
      severity: 'warning',
      display: 'transient',
    });
    navigate('/', { replace: true });
  }, [blocked, pluginId, plugins, currentTenant, alertApi, navigate]);

  return <>{blocked ? null : props.children}</>;
}
