/**
 * Plugins that each tenant can turn on or off. The frontend hides the pages of
 * disabled plugins; `backendPaths` are blocked for the tenant's members by
 * `createTenantPluginGate`. Plugins not listed here are always available.
 */
export const TENANT_PLUGINS = [
  {
    id: 'scaffolder',
    title: 'Create (Software Templates)',
    description: 'Create new components from software templates',
    backendPaths: ['/api/scaffolder'],
  },
  {
    id: 'techdocs',
    title: 'Docs (TechDocs)',
    description: 'Technical documentation of catalog entities',
    backendPaths: ['/api/techdocs'],
  },
  {
    id: 'api-docs',
    title: 'APIs',
    description: 'Browse API definitions',
    backendPaths: [],
  },
  {
    id: 'catalog-graph',
    title: 'Catalog Graph',
    description: 'Visualize relations between catalog entities',
    backendPaths: [],
  },
  {
    id: 'catalog-import',
    title: 'Register Existing Component',
    description: 'Register existing catalog-info.yaml files in the catalog',
    backendPaths: ['/api/catalog/analyze-location'],
  },
  {
    id: 'search',
    title: 'Search',
    description: 'Search the catalog and documentation',
    backendPaths: ['/api/search'],
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'In-app notifications',
    backendPaths: ['/api/notifications'],
  },
  {
    id: 'kubernetes',
    title: 'Kubernetes',
    description: 'Kubernetes resources of catalog entities',
    backendPaths: ['/api/kubernetes'],
  },
] as const;

export type TenantPluginId = (typeof TENANT_PLUGINS)[number]['id'];

export const TENANT_PLUGIN_IDS = TENANT_PLUGINS.map(p => p.id) as [
  TenantPluginId,
  ...TenantPluginId[],
];

/** The tenant plugin whose backend serves this request path, if any. */
export function findTenantPluginForPath(path: string) {
  return TENANT_PLUGINS.find(plugin =>
    plugin.backendPaths.some(prefix => path === prefix || path.startsWith(`${prefix}/`)),
  );
}
