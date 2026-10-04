import { LoggerService } from '@backstage/backend-plugin-api';
import { TenantPluginConfig } from '../config';
import { Repositories } from '../database/repository';
import { TenantQuotaProvider } from '../quota/TenantQuotaProvider';
import { SecretProvider } from '../secrets/SecretProvider';
import { AuditService } from './auditService';
import { AuthorizationService } from './authorizationService';
import { ConfigurationService } from './configurationService';
import { EnvironmentService } from './environmentService';
import { InviteService } from './inviteService';
import { PlatformService } from './platformService';
import { PluginService } from './pluginService';
import { ProjectService } from './projectService';
import { TenantService } from './tenantService';
import { UserService } from './userService';

export type Services = ReturnType<typeof createServices>;

export function createServices(options: {
  repos: Repositories;
  config: TenantPluginConfig;
  secrets: SecretProvider;
  quota: TenantQuotaProvider;
  logger: LoggerService;
}) {
  const { repos, config, secrets, quota, logger } = options;
  const authz = new AuthorizationService(repos);
  const audit = new AuditService(repos, logger);
  const isPlatformAdmin = (user: { email: string }) =>
    config.platformAdmins.includes(user.email.toLowerCase());
  const invites = new InviteService(repos, audit, {
    localAuthEnabled: config.localAuth.enabled,
    isPlatformAdmin,
  });
  const tenants = new TenantService(repos, authz, audit, invites, {
    platformAdmins: config.platformAdmins,
    localAuthEnabled: config.localAuth.enabled,
  });
  const users = new UserService(repos, authz, audit, {
    localAuthEnabled: config.localAuth.enabled,
    isPlatformAdmin: user => tenants.isPlatformAdmin(user),
    quota,
    invites,
  });
  return {
    authz,
    audit,
    invites,
    tenants,
    users,
    plugins: new PluginService(repos, authz, audit, {
      isPlatformAdmin: user => tenants.isPlatformAdmin(user),
    }),
    platform: new PlatformService(repos, {
      isPlatformAdmin: user => tenants.isPlatformAdmin(user),
      users,
      audit,
      secrets,
      logger,
    }),
    projects: new ProjectService(repos, authz, audit, secrets, logger, quota),
    environments: new EnvironmentService(repos, authz, audit, secrets, logger),
    configurations: new ConfigurationService(repos, authz, audit, secrets, logger),
  };
}
