import { useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { Permission, tenantApiRef } from './api';

/** Current tenant context; re-renders when the tenant changes. */
export function useTenant() {
  const tenantApi = useApi(tenantApiRef);
  const [state, setState] = useState(() => tenantApi.getState());

  useEffect(() => tenantApi.subscribe(setState), [tenantApi]);

  return {
    ...state,
    currentTenant: state.current?.tenant,
    role: state.current?.role,
    can: (permission: Permission) =>
      state.current?.permissions.includes(permission) ?? false,
    /** Plugins are on unless the current organization turned them off */
    isPluginEnabled: (pluginId: string) =>
      state.plugins.find(p => p.id === pluginId)?.enabled ?? true,
    switchTenant: (tenantId: string) => tenantApi.switchTenant(tenantId),
    reload: () => tenantApi.reload(),
  };
}
