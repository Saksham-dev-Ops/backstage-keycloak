import {
  ApiBlueprint,
  configApiRef,
  createFrontendModule,
  createFrontendPlugin,
  discoveryApiRef,
  fetchApiRef,
  identityApiRef,
  oauthRequestApiRef,
} from '@backstage/frontend-plugin-api';
import {
  createFetchApi,
  FetchMiddlewares,
  OAuth2,
} from '@backstage/core-app-api';
import {
  AppRootWrapperBlueprint,
  SignInPageBlueprint,
} from '@backstage/plugin-app-react';
import {
  keycloakAuthApiRef,
  TenantClient,
  tenantApiRef,
} from '@internal/backstage-plugin-tenant-react';
import { injectTenantHeader, TenantPluginGuard } from './TenantPluginGuard';

export {
  TENANT_PLUGIN_UI,
  TenantSwitcher,
  useTenant,
} from '@internal/backstage-plugin-tenant-react';

const tenantSignInPage = SignInPageBlueprint.make({
  params: {
    loader: () =>
      import('@internal/backstage-plugin-tenant-react').then(
        m => m.TenantSignInPage,
      ),
  },
});

// Keycloak sign-in through the backend's `oidc` auth provider
const keycloakAuthApi = ApiBlueprint.make({
  name: 'keycloak-auth',
  params: defineParams =>
    defineParams({
      api: keycloakAuthApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        oauthRequestApi: oauthRequestApiRef,
        configApi: configApiRef,
      },
      factory: ({ discoveryApi, oauthRequestApi, configApi }) =>
        OAuth2.create({
          configApi,
          discoveryApi,
          oauthRequestApi,
          provider: { id: 'oidc', title: 'Keycloak', icon: () => null },
          environment: configApi.getOptionalString('auth.environment'),
          defaultScopes: ['openid', 'profile', 'email'],
        }),
    }),
});

/** Replaces the default sign-in page with tenant sign-in and organization selection. */
export const tenantSignInModule = createFrontendModule({
  pluginId: 'app',
  extensions: [tenantSignInPage, keycloakAuthApi],
});

// Replaces the app's default fetch API (`api:app/fetch`) with one that also
// sends the selected organization to the backend
const tenantFetchApi = ApiBlueprint.make({
  name: 'fetch',
  params: defineParams =>
    defineParams({
      api: fetchApiRef,
      deps: {
        configApi: configApiRef,
        identityApi: identityApiRef,
        discoveryApi: discoveryApiRef,
      },
      factory: ({ configApi, identityApi, discoveryApi }) =>
        createFetchApi({
          middleware: [
            FetchMiddlewares.resolvePluginProtocol({ discoveryApi }),
            injectTenantHeader(configApi.getString('backend.baseUrl')),
            FetchMiddlewares.injectIdentityAuth({
              identityApi,
              config: configApi,
            }),
          ],
        }),
    }),
});

const tenantPluginGuard = AppRootWrapperBlueprint.make({
  name: 'tenant-plugin-guard',
  params: { component: TenantPluginGuard },
});

/** Per-organization plugin switches: tenant header on backend calls and page guard. */
export const tenantAppModule = createFrontendModule({
  pluginId: 'app',
  extensions: [tenantFetchApi, tenantPluginGuard],
});

const tenantApi = ApiBlueprint.make({
  params: defineParams =>
    defineParams({
      api: tenantApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) =>
        new TenantClient({ discoveryApi, fetchApi }),
    }),
});

/** Tenant API; the pages live in the role UI plugins (`plugins/platform-admin`, `plugins/organization`, `plugins/my-work`). */
export const tenantPlugin = createFrontendPlugin({
  pluginId: 'tenant',
  extensions: [tenantApi],
});
