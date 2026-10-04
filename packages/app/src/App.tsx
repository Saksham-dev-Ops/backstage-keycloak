import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import { navModule } from './modules/nav';
import { homeModule } from './modules/home';
import { catalogModule } from './modules/catalog';
import { tenantAppModule, tenantPlugin, tenantSignInModule } from './modules/tenant';
import {
  departmentPlugin,
  organizationPlugin,
  platformAdminPlugin,
  rolesModule,
  userPlugin,
} from './modules/roles';

export default createApp({
  features: [
    catalogPlugin,
    catalogModule,
    navModule,
    homeModule,
    tenantPlugin,
    tenantSignInModule,
    tenantAppModule,
    rolesModule,
    platformAdminPlugin,
    departmentPlugin,
    organizationPlugin,
    userPlugin,
  ],
});
