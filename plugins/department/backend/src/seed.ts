import {
  LoggerService,
  RootConfigService,
} from '@backstage/backend-plugin-api';
import { isUniqueViolation } from './database/knex';
import { Repositories } from './database/repository';
import { slugify } from './models/department';
import { SeedAssignments } from './service/departmentService';

/**
 * Creates the ministries from `department.seed` if missing, and returns where
 * seeded organizations belong. For local development.
 */
export async function seedFromConfig(
  repos: Repositories,
  config: RootConfigService,
  logger: LoggerService,
): Promise<SeedAssignments> {
  const assignments: SeedAssignments = new Map();
  for (const ministry of config.getOptionalConfigArray(
    'department.seed.ministries',
  ) ?? []) {
    const name = ministry.getString('name');
    if (!(await repos.ministries.getByName(name))) {
      try {
        await repos.ministries.create({ name, slug: slugify(name) });
        logger.info(`Seeded ministry ${name}`);
      } catch (error) {
        if (!isUniqueViolation(error)) {
          throw error;
        }
      }
    }
    for (const department of ministry.getOptionalConfigArray('departments') ??
      []) {
      assignments.set(department.getString('tenantSlug'), {
        ministryName: name,
        userLimit: department.getOptionalNumber('userLimit'),
        projectLimit: department.getOptionalNumber('projectLimit'),
      });
    }
  }
  return assignments;
}
