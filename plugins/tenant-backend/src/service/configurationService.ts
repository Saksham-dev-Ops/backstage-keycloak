import { randomUUID } from 'node:crypto';
import { LoggerService } from '@backstage/backend-plugin-api';
import { ConflictError, InputError, NotFoundError } from '@backstage/errors';
import { isUniqueViolation } from '../database/knex';
import { Repositories } from '../database/repository';
import { SecretProvider, secretReference } from '../secrets/SecretProvider';
import { Configuration, TenantContext } from '../types';
import { AuditService } from './auditService';
import { AuthorizationService, Permission } from './authorizationService';
import { deleteSecrets } from './projectService';

/** What the API returns: secret values are never included. */
export type ConfigurationView = Omit<Configuration, 'secretRef' | 'value'> & {
  value: string | null;
};

function toView(config: Configuration): ConfigurationView {
  return {
    id: config.id,
    projectId: config.projectId,
    environmentId: config.environmentId,
    key: config.key,
    value: config.isSecret ? null : config.value ?? '',
    isSecret: config.isSecret,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

function writePermission(isSecret: boolean): Permission {
  return isSecret ? 'secret.write' : 'config.write';
}

function duplicateKey(error: unknown): never {
  if (isUniqueViolation(error)) {
    throw new ConflictError('This key already exists in the environment');
  }
  throw error;
}

export class ConfigurationService {
  constructor(
    private readonly repos: Repositories,
    private readonly authz: AuthorizationService,
    private readonly audit: AuditService,
    private readonly secrets: SecretProvider,
    private readonly logger: LoggerService,
  ) {}

  async list(ctx: TenantContext, projectId: string, environmentId?: string) {
    if (environmentId) {
      await this.authz.authorizeEnvironmentAccess(ctx, projectId, environmentId, 'config.read');
    } else {
      await this.authz.authorizeProjectAccess(ctx, projectId, 'config.read');
    }
    const configs = await this.repos.configurations.list(
      ctx.tenant.id,
      projectId,
      environmentId,
    );
    return configs.map(toView);
  }

  async create(
    ctx: TenantContext,
    projectId: string,
    input: { environmentId: string; key: string; value: string; isSecret: boolean },
  ) {
    await this.authz.authorizeEnvironmentAccess(
      ctx,
      projectId,
      input.environmentId,
      writePermission(input.isSecret),
    );

    const id = randomUUID();
    const secretRef = input.isSecret
      ? secretReference(ctx.tenant.id, projectId, id)
      : null;
    if (secretRef) {
      await this.secrets.setSecret(secretRef, input.value);
    }
    try {
      await this.repos.configurations.create({
        id,
        projectId,
        environmentId: input.environmentId,
        key: input.key,
        value: input.isSecret ? null : input.value,
        isSecret: input.isSecret,
        secretRef,
      });
    } catch (error) {
      if (secretRef) {
        await deleteSecrets(this.secrets, [secretRef], this.logger);
      }
      duplicateKey(error);
    }

    await this.audit.record({
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
      action: 'CONFIG_CREATED',
      resourceType: 'configuration',
      resourceId: id,
      metadata: {
        projectId,
        environmentId: input.environmentId,
        key: input.key,
        isSecret: input.isSecret,
      },
    });
    return toView((await this.repos.configurations.get(ctx.tenant.id, projectId, id))!);
  }

  private async getConfig(ctx: TenantContext, projectId: string, configId: string) {
    await this.authz.authorizeProjectAccess(ctx, projectId, 'config.read');
    const config = await this.repos.configurations.get(ctx.tenant.id, projectId, configId);
    if (!config) {
      throw new NotFoundError('Configuration not found');
    }
    return config;
  }

  async update(
    ctx: TenantContext,
    projectId: string,
    configId: string,
    changes: { key?: string; value?: string },
  ) {
    const config = await this.getConfig(ctx, projectId, configId);
    this.authz.requirePermission(ctx, writePermission(config.isSecret));

    if (config.isSecret && changes.value !== undefined && config.secretRef) {
      await this.secrets.setSecret(config.secretRef, changes.value);
    }
    await this.repos.configurations
      .update(ctx.tenant.id, projectId, configId, {
        key: changes.key,
        value: config.isSecret ? undefined : changes.value,
      })
      .catch(duplicateKey);

    await this.audit.record({
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
      action:
        config.isSecret && changes.value !== undefined
          ? 'SECRET_UPDATED'
          : 'CONFIG_UPDATED',
      resourceType: 'configuration',
      resourceId: configId,
      metadata: {
        projectId,
        key: changes.key ?? config.key,
        fields: Object.keys(changes).join(','),
      },
    });
    return toView((await this.repos.configurations.get(ctx.tenant.id, projectId, configId))!);
  }

  async delete(ctx: TenantContext, projectId: string, configId: string) {
    const config = await this.getConfig(ctx, projectId, configId);
    this.authz.requirePermission(ctx, writePermission(config.isSecret));
    await this.repos.configurations.delete(ctx.tenant.id, projectId, configId);
    if (config.secretRef) {
      await deleteSecrets(this.secrets, [config.secretRef], this.logger);
    }
    await this.audit.record({
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
      action: 'CONFIG_DELETED',
      resourceType: 'configuration',
      resourceId: configId,
      metadata: { projectId, key: config.key, isSecret: config.isSecret },
    });
  }

  /** Returns a secret's plaintext value. Always audited. */
  async revealSecret(ctx: TenantContext, projectId: string, configId: string) {
    const config = await this.getConfig(ctx, projectId, configId);
    this.authz.requirePermission(ctx, 'secret.read');
    if (!config.isSecret || !config.secretRef) {
      throw new InputError('This configuration value is not a secret');
    }
    const value = await this.secrets.getSecret(config.secretRef);
    await this.audit.record({
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
      action: 'SECRET_ACCESSED',
      resourceType: 'configuration',
      resourceId: configId,
      metadata: { projectId, key: config.key },
    });
    return { id: config.id, key: config.key, value };
  }
}
