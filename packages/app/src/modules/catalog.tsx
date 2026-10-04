import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { CatalogFilterBlueprint } from '@backstage/plugin-catalog-react/alpha';
import { EntityKindPicker } from '@backstage/plugin-catalog-react';

export const databaseKindFilter = CatalogFilterBlueprint.makeWithOverrides({
  name: 'kind',

  factory(originalFactory) {
    return originalFactory({
      loader: async () => {
        return (
          <EntityKindPicker
            allowedKinds={[
              'API',
              'Component',
              'Custom',
              'Database',
              'Group',
              'Location',
              'Resource',
              'System',
              'Template',
              'User',
              'Service'
            ]}
          />
        );
      },
    });
  },
});

export const catalogModule = createFrontendModule({
  pluginId: 'catalog',
  extensions: [databaseKindFilter],
});