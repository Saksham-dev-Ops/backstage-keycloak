import {
  createFrontendPlugin,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';
import ExtensionIcon from '@material-ui/icons/Extension';

import { rootRouteRef } from './routes';

// Pages need both a title and an icon to get a sidebar item
export const page = PageBlueprint.make({
  params: {
    path: '/my-plugin',
    routeRef: rootRouteRef,
    title: 'My Plugin',
    icon: <ExtensionIcon />,
    loader: () =>
      import('./components/TodoPage').then(m => (
        <m.TodoPage />
      )),
  },
});

export const myPluginPlugin = createFrontendPlugin({
  pluginId: 'my-plugin',
  title: 'My Plugin',
  icon: <ExtensionIcon />,
  extensions: [page],
  routes: {
    root: rootRouteRef,
  }
});
