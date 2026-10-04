import { RoleId, TenantState, useTenant } from '@internal/backstage-plugin-tenant-react';

export function roleFor(state: TenantState): RoleId | undefined {
  if (state.isPlatformAdmin) {
    return 'platform-admin';
  }
  if (!state.current) {
    return undefined;
  }
  return state.current.role === 'OWNER' || state.current.role === 'ADMIN'
    ? 'organization'
    : 'user';
}

/**
 * The UI of the signed-in user: platform admin, organization (owners and
 * admins) or user (developers and viewers). Follows the current organization,
 * so switching organizations can switch the UI.
 */
export function useRole() {
  const tenant = useTenant();
  return { ...tenant, roleId: roleFor(tenant) };
}
