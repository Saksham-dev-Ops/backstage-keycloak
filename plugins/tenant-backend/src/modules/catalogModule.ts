import {
  coreServices,
  createBackendModule,
  LoggerService,
} from '@backstage/backend-plugin-api';
import {
  ANNOTATION_LOCATION,
  ANNOTATION_ORIGIN_LOCATION,
  GroupEntity,
} from '@backstage/catalog-model';
import {
  catalogProcessingExtensionPoint,
  EntityProvider,
  EntityProviderConnection,
} from '@backstage/plugin-catalog-node';
import { TENANT_GROUP_NAMESPACE } from '../auth/identity';
import { TenantUserClient } from '../TenantUserClient';

const LOCATION = 'tenant:groups';

/**
 * Publishes every active tenant as a catalog Group, `group:tenant/<slug>`, so
 * that entities can name their tenant as `spec.owner`.
 */
class TenantGroupEntityProvider implements EntityProvider {
  private connection?: EntityProviderConnection;

  constructor(
    private readonly client: TenantUserClient,
    private readonly logger: LoggerService,
  ) {}

  getProviderName() {
    return 'tenant-groups';
  }

  async connect(connection: EntityProviderConnection) {
    this.connection = connection;
  }

  async refresh() {
    if (!this.connection) {
      return;
    }
    const tenants = await this.client.listTenants();
    await this.connection.applyMutation({
      type: 'full',
      entities: tenants.map(tenant => {
        const entity: GroupEntity = {
          apiVersion: 'backstage.io/v1alpha1',
          kind: 'Group',
          metadata: {
            name: tenant.slug,
            namespace: TENANT_GROUP_NAMESPACE,
            title: tenant.name,
            annotations: {
              [ANNOTATION_LOCATION]: LOCATION,
              [ANNOTATION_ORIGIN_LOCATION]: LOCATION,
            },
          },
          spec: {
            type: 'organization',
            profile: { displayName: tenant.name },
            children: [],
          },
        };
        return { entity, locationKey: this.getProviderName() };
      }),
    });
    this.logger.debug(`Published ${tenants.length} tenant groups to the catalog`);
  }
}

export const catalogModuleTenantGroups = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'tenant-groups',
  register(reg) {
    reg.registerInit({
      deps: {
        catalog: catalogProcessingExtensionPoint,
        discovery: coreServices.discovery,
        auth: coreServices.auth,
        scheduler: coreServices.scheduler,
        logger: coreServices.logger,
      },
      async init({ catalog, discovery, auth, scheduler, logger }) {
        const provider = new TenantGroupEntityProvider(
          new TenantUserClient(discovery, auth),
          logger,
        );
        catalog.addEntityProvider(provider);
        // New tenants show up in the catalog within a minute
        await scheduler.scheduleTask({
          id: 'tenant-groups-refresh',
          frequency: { minutes: 1 },
          timeout: { minutes: 1 },
          fn: () => provider.refresh(),
        });
      },
    });
  },
});
