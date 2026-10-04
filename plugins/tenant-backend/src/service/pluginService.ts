import { NotFoundError } from '@backstage/errors';
import { Repositories } from '../database/repository';
import { TENANT_PLUGINS, TenantPluginId } from '../tenantPlugins';
import { TenantContext, User } from '../types';
import { AuditService } from './auditService';
import { AuthorizationService } from './authorizationService';

export type TenantPluginState = {
  id: TenantPluginId;
  title: string;
  description: string;
  enabled: boolean;
};

/** Which plugins are turned on for a tenant. */
export class PluginService {
  constructor(
    private readonly repos: Repositories,
    private readonly authz: AuthorizationService,
    private readonly audit: AuditService,
    private readonly options: { isPlatformAdmin: (user: User) => boolean },
  ) {}

  /** Every member may see which plugins their tenant has. */
  async list(ctx: TenantContext): Promise<TenantPluginState[]> {
    const switches = await this.repos.tenantPlugins.listSwitches(ctx.tenant.id);
    return TENANT_PLUGINS.map(({ id, title, description }) => ({
      id,
      title,
      description,
      enabled: switches.get(id) ?? true,
    }));
  }

  async setEnabled(ctx: TenantContext, pluginId: TenantPluginId, enabled: boolean) {
    this.authz.requirePermission(ctx, 'plugin.manage');
    await this.repos.tenantPlugins.setEnabled(ctx.tenant.id, pluginId, enabled);
    await this.audit.record({
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
      action: enabled ? 'PLUGIN_ENABLED' : 'PLUGIN_DISABLED',
      resourceType: 'plugin',
      resourceId: pluginId,
    });
    const plugins = await this.list(ctx);
    const plugin = plugins.find(p => p.id === pluginId);
    if (!plugin) {
      throw new NotFoundError('Plugin not found');
    }
    return plugin;
  }

  /**
   * Whether a user may use a plugin's backend. With a tenant, the user must be
   * a member and the tenant must have the plugin on. Requests that name no
   * tenant are allowed if any of the user's tenants has the plugin on.
   */
  async canUse(user: User, tenantId: string | undefined, pluginId: TenantPluginId) {
    if (tenantId) {
      const ctx = await this.authz.authorizeTenantAccess(user, tenantId);
      const switches = await this.repos.tenantPlugins.listSwitches(ctx.tenant.id);
      return switches.get(pluginId) ?? true;
    }
    const tenantIds = (await this.repos.memberships.listTenantsForUser(user.id))
      .filter(m => m.tenant.status === 'active')
      .map(m => m.tenant.id);
    if (!tenantIds.length) {
      return this.options.isPlatformAdmin(user);
    }
    const disabled = await this.repos.tenantPlugins.listDisabledTenants(tenantIds, pluginId);
    return tenantIds.some(id => !disabled.has(id));
  }
}
