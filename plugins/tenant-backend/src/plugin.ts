import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createKeycloakLogoutResolver } from './auth/keycloakLogout';
import { readTenantPluginConfig } from './config';
import { applyMigrations } from './database/knex';
import { createRepositories } from './database/repository';
import { createRouter } from './router';
import { EncryptedDatabaseSecretProvider } from './secrets/EncryptedDatabaseSecretProvider';
import {
  SecretProvider,
  tenantSecretProviderExtensionPoint,
} from './secrets/SecretProvider';
import {
  TenantQuotaProvider,
  tenantQuotaExtensionPoint,
  unlimitedQuota,
} from './quota/TenantQuotaProvider';
import { seedFromConfig } from './seed';
import { createServices } from './service';

/**
 * Multi-tenant project, environment and configuration management.
 * Mounted at /api/tenant.
 */
export const tenantPlugin = createBackendPlugin({
  pluginId: 'tenant',
  register(env) {
    let customSecretProvider: SecretProvider | undefined;
    env.registerExtensionPoint(tenantSecretProviderExtensionPoint, {
      setSecretProvider(provider) {
        if (customSecretProvider) {
          throw new Error('A tenant secret provider has already been set');
        }
        customSecretProvider = provider;
      },
    });

    let quotaProvider: TenantQuotaProvider | undefined;
    env.registerExtensionPoint(tenantQuotaExtensionPoint, {
      setQuotaProvider(provider) {
        if (quotaProvider) {
          throw new Error('A tenant quota provider has already been set');
        }
        quotaProvider = provider;
      },
    });

    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        httpAuth: coreServices.httpAuth,
        database: coreServices.database,
        rootConfig: coreServices.rootConfig,
        logger: coreServices.logger,
      },
      async init({ httpRouter, httpAuth, database, rootConfig, logger }) {
        const config = readTenantPluginConfig(rootConfig);
        const db = await database.getClient();
        if (!database.migrations?.skip) {
          await applyMigrations(db);
        }
        const repos = createRepositories(db);

        let secrets = customSecretProvider;
        if (!secrets) {
          const encryptionKey = rootConfig.getOptionalString('tenant.secrets.encryptionKey');
          if (!encryptionKey) {
            throw new Error(
              'Set tenant.secrets.encryptionKey or install a secret provider module',
            );
          }
          secrets = new EncryptedDatabaseSecretProvider(db, encryptionKey);
        }

        await seedFromConfig(repos, rootConfig, logger);

        httpRouter.use(
          await createRouter({
            services: createServices({
              repos,
              config,
              secrets,
              quota: quotaProvider ?? unlimitedQuota,
              logger,
            }),
            httpAuth,
            config,
            keycloakLogout: createKeycloakLogoutResolver(rootConfig, logger),
            secureCookies: rootConfig.getString('backend.baseUrl').startsWith('https:'),
          }),
        );
        httpRouter.addAuthPolicy({ path: '/session', allow: 'unauthenticated' });
      },
    });
  },
});
