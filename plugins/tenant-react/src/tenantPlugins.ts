/**
 * Frontend side of the per-organization plugin switches: the sidebar items
 * and page paths of each plugin that organizations can turn off. The list of
 * plugins itself comes from the tenant backend (`TENANT_PLUGINS`).
 */
export const TENANT_PLUGIN_UI: Record<string, { navItems: string[]; paths: string[] }> = {
  scaffolder: { navItems: ['page:scaffolder'], paths: ['/create'] },
  techdocs: { navItems: ['page:techdocs'], paths: ['/docs'] },
  'api-docs': { navItems: ['page:api-docs'], paths: ['/api-docs'] },
  'catalog-graph': { navItems: ['page:catalog-graph'], paths: ['/catalog-graph'] },
  'catalog-import': { navItems: ['page:catalog-import'], paths: ['/catalog-import'] },
  search: { navItems: ['page:search'], paths: ['/search'] },
  notifications: { navItems: ['page:notifications'], paths: ['/notifications'] },
  kubernetes: { navItems: [], paths: ['/kubernetes'] },
};

/** The organization-switchable plugin that owns a page path, if any. */
export function findTenantPluginForPath(pathname: string) {
  return Object.keys(TENANT_PLUGIN_UI).find(id =>
    TENANT_PLUGIN_UI[id].paths.some(
      path => pathname === path || pathname.startsWith(`${path}/`),
    ),
  );
}
