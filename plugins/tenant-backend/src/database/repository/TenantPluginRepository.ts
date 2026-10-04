import { Knex, toBool } from '../knex';

export class TenantPluginRepository {
  constructor(private readonly db: Knex) {}

  /** Explicit switches of a tenant; plugins without a row are enabled. */
  async listSwitches(tenantId: string): Promise<Map<string, boolean>> {
    const rows = await this.db('tenant_plugins')
      .where({ tenant_id: tenantId })
      .select('plugin_id', 'enabled');
    return new Map(rows.map(row => [row.plugin_id, toBool(row.enabled)]));
  }

  /** Tenants (out of the given ones) that have turned the plugin off. */
  async listDisabledTenants(tenantIds: string[], pluginId: string): Promise<Set<string>> {
    if (!tenantIds.length) {
      return new Set();
    }
    const rows = await this.db('tenant_plugins')
      .whereIn('tenant_id', tenantIds)
      .andWhere({ plugin_id: pluginId, enabled: false })
      .select('tenant_id');
    return new Set(rows.map(row => row.tenant_id));
  }

  async setEnabled(tenantId: string, pluginId: string, enabled: boolean) {
    await this.db('tenant_plugins')
      .insert({ tenant_id: tenantId, plugin_id: pluginId, enabled })
      .onConflict(['tenant_id', 'plugin_id'])
      .merge({ enabled, updated_at: this.db.fn.now() });
  }
}
