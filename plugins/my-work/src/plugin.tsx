import { createFrontendPlugin, createRouteRef, PageBlueprint } from '@backstage/frontend-plugin-api';
import StarIcon from '@material-ui/icons/Star';
import { matchesPath, RoleUi } from '@internal/backstage-plugin-tenant-react';
import { userBrand } from './brand';
import { UserSidebar } from './Sidebar';
import { userTheme } from './theme';

const rootRouteRef = createRouteRef();

const page = PageBlueprint.make({
  params: {
    path: '/me',
    routeRef: rootRouteRef,
    title: 'My projects',
    icon: <StarIcon />,
    loader: () => import('./UserApp').then(m => <m.UserApp />),
  },
});

/** User UI: only the projects the user is assigned to. */
export const userPlugin = createFrontendPlugin({
  pluginId: 'my-work',
  title: 'My projects',
  icon: <StarIcon />,
  routes: { root: rootRouteRef },
  extensions: [page],
});

export const userUi: RoleUi = {
  id: 'user',
  brand: userBrand,
  theme: userTheme,
  landingPath: '/me',
  // Only their projects and their settings
  isPathAllowed: pathname => matchesPath(pathname, ['/me', '/settings']),
  Sidebar: UserSidebar,
};
