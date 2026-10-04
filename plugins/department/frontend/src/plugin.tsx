import {
  ApiBlueprint,
  createFrontendPlugin,
  createRouteRef,
  discoveryApiRef,
  fetchApiRef,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';
import AccountBalanceOutlinedIcon from '@material-ui/icons/AccountBalanceOutlined';
import HistoryIcon from '@material-ui/icons/History';
import { departmentApiRef } from './api/DepartmentApi';
import { DepartmentClient } from './api/DepartmentClient';
import { GridIcon } from './components/Common/icons';

export const departmentsRouteRef = createRouteRef();
export const ministriesRouteRef = createRouteRef();
export const auditLogRouteRef = createRouteRef();

const departmentApi = ApiBlueprint.make({
  params: defineParams =>
    defineParams({
      api: departmentApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) => new DepartmentClient({ discoveryApi, fetchApi }),
    }),
});

const departmentsPage = PageBlueprint.make({
  name: 'departments',
  params: {
    path: '/admin/departments',
    routeRef: departmentsRouteRef,
    title: 'Departments',
    icon: <GridIcon />,
    // The console pages bring their own breadcrumb header
    noHeader: true,
    loader: () => import('./pages/DepartmentRoutes').then(m => <m.DepartmentRoutes />),
  },
});

const ministriesPage = PageBlueprint.make({
  name: 'ministries',
  params: {
    path: '/admin/ministries',
    routeRef: ministriesRouteRef,
    title: 'Ministries',
    icon: <AccountBalanceOutlinedIcon />,
    // The console pages bring their own breadcrumb header
    noHeader: true,
    loader: () => import('./pages/MinistriesPage').then(m => <m.MinistriesPage />),
  },
});

const auditLogPage = PageBlueprint.make({
  name: 'audit',
  params: {
    path: '/admin/audit',
    routeRef: auditLogRouteRef,
    title: 'Audit log',
    icon: <HistoryIcon />,
    // The console pages bring their own breadcrumb header
    noHeader: true,
    loader: () => import('./pages/AuditLogPage').then(m => <m.AuditLogPage />),
  },
});

/**
 * The admin console's departments, ministries and audit log, backed by the
 * department backend (`/api/department`).
 */
export const departmentPlugin = createFrontendPlugin({
  pluginId: 'department',
  title: 'Departments',
  icon: <GridIcon />,
  routes: {
    departments: departmentsRouteRef,
    ministries: ministriesRouteRef,
    auditLog: auditLogRouteRef,
  },
  extensions: [departmentApi, departmentsPage, ministriesPage, auditLogPage],
});
