import { LoggerService } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';
import { hashPassword } from './auth/password';
import { Repositories } from './database/repository';
import { emailSchema, parse, roleSchema, slugSchema } from './validation';

/** Creates configured users, tenants, memberships and projects if missing. */
export async function seedFromConfig(
  repos: Repositories,
  config: Config,
  logger: LoggerService,
) {
  const seed = config.getOptionalConfig('tenant.seed');
  if (!seed) {
    return;
  }

  const ensureUser = async (rawEmail: string, name?: string) => {
    const email = parse(emailSchema, rawEmail);
    const existing = await repos.users.getByEmail(email);
    if (existing) {
      return existing.id;
    }
    logger.info(`Seeding user ${email}`);
    return repos.users.create({ email, name: name ?? email });
  };

  for (const userConfig of seed.getOptionalConfigArray('users') ?? []) {
    const userId = await ensureUser(
      userConfig.getString('email'),
      userConfig.getOptionalString('name'),
    );
    const password = userConfig.getOptionalString('password');
    if (password && !(await repos.users.getPasswordHash(userId))) {
      await repos.users.setPasswordHash(userId, await hashPassword(password));
    }
  }

  for (const tenantConfig of seed.getOptionalConfigArray('tenants') ?? []) {
    const slug = parse(slugSchema, tenantConfig.getString('slug'));
    let tenant = await repos.tenants.getBySlug(slug);
    if (!tenant) {
      logger.info(`Seeding tenant ${slug}`);
      await repos.tenants.create({ slug, name: tenantConfig.getString('name') });
      tenant = (await repos.tenants.getBySlug(slug))!;
    }

    for (const memberConfig of tenantConfig.getOptionalConfigArray('members') ?? []) {
      const userId = await ensureUser(memberConfig.getString('email'));
      if (!(await repos.memberships.getRole(tenant.id, userId))) {
        await repos.memberships.add(
          tenant.id,
          userId,
          parse(roleSchema, memberConfig.getString('role')),
        );
      }
    }

    const existingProjects = await repos.projects.list(tenant.id);
    for (const projectConfig of tenantConfig.getOptionalConfigArray('projects') ?? []) {
      const projectSlug = parse(slugSchema, projectConfig.getString('slug'));
      let projectId = existingProjects.find(p => p.slug === projectSlug)?.id;
      if (!projectId) {
        projectId = await repos.projects.create(tenant.id, {
          slug: projectSlug,
          name: projectConfig.getString('name'),
          description: projectConfig.getOptionalString('description'),
        });
        for (const env of projectConfig.getOptionalStringArray('environments') ?? [
          'development',
          'staging',
          'production',
        ]) {
          await repos.environments.create(projectId, env);
        }
      }

      // Assignments of developers and viewers; they must be tenant members
      for (const rawEmail of projectConfig.getOptionalStringArray('members') ?? []) {
        const userId = await ensureUser(rawEmail);
        if (!(await repos.memberships.getRole(tenant.id, userId))) {
          logger.warn(`Not assigning ${rawEmail} to ${projectSlug}: not a member of ${slug}`);
          continue;
        }
        await repos.projectMembers.add(projectId, userId);
      }
    }
  }
}
