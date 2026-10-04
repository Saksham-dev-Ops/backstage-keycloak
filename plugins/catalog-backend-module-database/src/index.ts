import { createBackendModule } from '@backstage/backend-plugin-api';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node';
import { DatabaseEntitiesProcessor } from './processor';

export default createBackendModule({
  pluginId: 'catalog',
  moduleId: 'database',

  register(env) {
    env.registerInit({
      deps: {
        catalog: catalogProcessingExtensionPoint,
      },
      async init({ catalog }) {
        catalog.addProcessor(new DatabaseEntitiesProcessor());
      },
    });
  },
});
