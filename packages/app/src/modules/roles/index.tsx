import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { AppRootWrapperBlueprint } from '@backstage/plugin-app-react';
import { RoleGuard } from './RoleGuard';

export { departmentPlugin } from '@internal/backstage-plugin-department';
export { organizationPlugin } from '@internal/backstage-plugin-organization';
export { platformAdminPlugin } from '@internal/backstage-plugin-platform-admin';
export { userPlugin } from '@internal/backstage-plugin-my-work';
export { useRoleUi } from './roleUi';
export type { RoleNav } from '@internal/backstage-plugin-tenant-react';

const roleGuard = AppRootWrapperBlueprint.make({
  name: 'role-guard',
  params: { component: RoleGuard },
});

/** A separate UI per role: platform admin, organization and user. */
export const rolesModule = createFrontendModule({
  pluginId: 'app',
  extensions: [roleGuard],
});
