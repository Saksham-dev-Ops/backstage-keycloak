/**
 * Multi-tenant project, environment and configuration management.
 */
export { tenantPlugin as default } from './plugin';
export {
  authModuleTenantKeycloakProvider,
  authModuleTenantLocalProvider,
  createTenantSignInResolver,
} from './modules/authModule';
export { catalogModuleTenantGroups } from './modules/catalogModule';
export {
  permissionModuleTenantPolicy,
  TenantPermissionPolicy,
} from './modules/permissionPolicyModule';
export { createTenantPluginGate } from './pluginGate';
export { TENANT_PLUGINS, type TenantPluginId } from './tenantPlugins';
export {
  tenantSecretProviderExtensionPoint,
  type SecretProvider,
  type TenantSecretProviderExtensionPoint,
} from './secrets/SecretProvider';
export {
  tenantQuotaExtensionPoint,
  type TenantLimits,
  type TenantQuotaExtensionPoint,
  type TenantQuotaProvider,
} from './quota/TenantQuotaProvider';
