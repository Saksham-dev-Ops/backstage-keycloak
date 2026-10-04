import {
  createFrontendPlugin,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';

import ExtensionIcon from '@material-ui/icons/Extension';

import { rootRouteRef } from './routes';

export const page = PageBlueprint.make({
  params: {
    path: '/companydata',
    routeRef: rootRouteRef,
    icon: <ExtensionIcon />,
    title: "Company Data",
    loader: () =>
      import('./components/TodoPage').then(m => (
        <m.TodoPage />
      )),
  },
});

export const companydataPlugin = createFrontendPlugin({
  pluginId: 'companydata',
  extensions: [page],
  icon: <ExtensionIcon />,
  title: "Company Data",
  routes: {
    root: rootRouteRef,
  }
});
