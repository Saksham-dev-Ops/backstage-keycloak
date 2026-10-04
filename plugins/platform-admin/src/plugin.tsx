import { createFrontendPlugin, createRouteRef, PageBlueprint } from '@backstage/frontend-plugin-api';
import SecurityIcon from '@material-ui/icons/Security';
import { matchesPath, RoleUi } from '@internal/backstage-plugin-tenant-react';
import { platformAdminBrand } from './brand';
import { PlatformAdminSidebar } from './Sidebar';
import { platformAdminTheme } from './theme';

const rootRouteRef = createRouteRef();

const page = PageBlueprint.make({
  params: {
    path: '/admin',
    routeRef: rootRouteRef,
    title: 'Platform admin',
    icon: <SecurityIcon />,
    loader: () => import('./PlatformAdminApp').then(m => <m.PlatformAdminApp />),
  },
});

/** Platform admin UI: all organizations, users and projects. */
export const platformAdminPlugin = createFrontendPlugin({
  pluginId: 'platform-admin',
  title: 'Platform admin',
  icon: <SecurityIcon />,
  routes: { root: rootRouteRef },
  extensions: [page],
});

export const platformAdminUi: RoleUi = {
  id: 'platform-admin',
  brand: platformAdminBrand,
  theme: platformAdminTheme,
  landingPath: '/admin/departments',
  // Everything but the organization and user UIs
  isPathAllowed: pathname => !matchesPath(pathname, ['/org', '/me']),
  Sidebar: PlatformAdminSidebar,
};
