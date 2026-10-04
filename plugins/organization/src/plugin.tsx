import { createFrontendPlugin, createRouteRef, PageBlueprint } from '@backstage/frontend-plugin-api';
import BusinessIcon from '@material-ui/icons/Business';
import { matchesPath, RoleUi } from '@internal/backstage-plugin-tenant-react';
import { organizationBrand } from './brand';
import { OrganizationSidebar } from './Sidebar';
import { organizationTheme } from './theme';

const rootRouteRef = createRouteRef();

const page = PageBlueprint.make({
  params: {
    path: '/org',
    routeRef: rootRouteRef,
    title: 'Organization',
    icon: <BusinessIcon />,
    loader: () => import('./OrganizationApp').then(m => <m.OrganizationApp />),
  },
});

/** Organization UI: members and projects of the current organization. */
export const organizationPlugin = createFrontendPlugin({
  pluginId: 'organization',
  title: 'Organization',
  icon: <BusinessIcon />,
  routes: { root: rootRouteRef },
  extensions: [page],
});

export const organizationUi: RoleUi = {
  id: 'organization',
  brand: organizationBrand,
  theme: organizationTheme,
  landingPath: '/org',
  // Everything but the platform admin and user UIs
  isPathAllowed: pathname => !matchesPath(pathname, ['/admin', '/me']),
  Sidebar: OrganizationSidebar,
};
