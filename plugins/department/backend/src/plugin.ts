import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { TenantClient } from './clients/TenantClient';
import { applyMigrations } from './database/knex';
import { createRepositories } from './database/repository';
import { seedFromConfig } from './seed';
import { createServices } from './service';
import { createRouter } from './service/router';

/**
 * Departments (the tenants of the tenant plugin), their ministries and
 * limits, for the platform admin console. Mounted at /api/department.
 */
export const departmentPlugin = createBackendPlugin({
  pluginId: 'department',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        httpAuth: coreServices.httpAuth,
        auth: coreServices.auth,
        discovery: coreServices.discovery,
        database: coreServices.database,
        rootConfig: coreServices.rootConfig,
        logger: coreServices.logger,
      },
      async init({
        httpRouter,
        httpAuth,
        auth,
        discovery,
        database,
        rootConfig,
        logger,
      }) {
        const db = await database.getClient();
        if (!database.migrations?.skip) {
          await applyMigrations(db);
        }
        const repos = createRepositories(db);
        const seedAssignments = await seedFromConfig(repos, rootConfig, logger);
        const tenants = new TenantClient({ discovery, auth });

        httpRouter.use(
          await createRouter({
            services: createServices({
              repos,
              tenants,
              logger,
              seedAssignments,
            }),
            tenants,
            httpAuth,
            logger,
          }),
        );
      },
    });
  },
});
