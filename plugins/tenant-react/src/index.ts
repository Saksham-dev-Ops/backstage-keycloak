/**
 * Shared frontend code of the tenant (organization) features: the tenant API,
 * tenant components and the building blocks of the role UIs.
 */
export * from './api';
export { useTenant } from './useTenant';
export { TENANT_PLUGIN_UI, findTenantPluginForPath } from './tenantPlugins';
export { keycloakAuthApiRef } from './keycloak';
export { OrganizationChooser, TenantSignInPage } from './TenantSignInPage';

export { ConfigTab } from './components/ConfigTab';
export { CreateOrganizationDialog } from './components/CreateOrganizationDialog';
export { PluginsPage } from './components/PluginsPage';
export { AuditTab, MembersTab, ProjectDetailPage } from './components/ProjectDetailPage';
export { ProjectListPage } from './components/ProjectListPage';
export { ProjectTeamTab } from './components/ProjectTeamTab';
export { TenantGate } from './components/TenantGate';
export { TenantSwitcher } from './components/TenantSwitcher';
export {
  confirmAction,
  EnvironmentSelect,
  slugify,
  useAction,
  useLoader,
} from './components/shared';

export * from './roles/types';
export * from './roles/createRoleTheme';
export { RoleSidebarLogo } from './roles/RoleSidebarLogo';
export { StatTile } from './roles/StatTile';

export { consoleTokens } from './console/tokens';
export { BrandMark, GridIcon } from './console/icons';
