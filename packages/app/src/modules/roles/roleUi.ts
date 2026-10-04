import { RoleId, RoleUi } from '@internal/backstage-plugin-tenant-react';
import { organizationUi } from '@internal/backstage-plugin-organization';
import { platformAdminUi } from '@internal/backstage-plugin-platform-admin';
import { userUi } from '@internal/backstage-plugin-my-work';
import { useRole } from './shared/useRole';

export const ROLE_UI: Record<RoleId, RoleUi> = {
  'platform-admin': platformAdminUi,
  organization: organizationUi,
  user: userUi,
};

/** The UI of the signed-in user's role, once known. */
export function useRoleUi(): RoleUi | undefined {
  const { roleId } = useRole();
  return roleId ? ROLE_UI[roleId] : undefined;
}
