import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';

import {
  Entity,
  getCompoundEntityRef,
  parseEntityRef,
  RELATION_OWNED_BY,
  RELATION_OWNER_OF,
} from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';

export class DatabaseEntitiesProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'DatabaseEntitiesProcessor';
  }

  async validateEntityKind(entity: Entity): Promise<boolean> {
    return isCustomKind(entity);
  }

  async postProcessEntity(
    entity: Entity,
    _location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<Entity> {
    // Ownership relations drive the Owner column, "Owned" filter and the
    // tenant permission policy, just like for the built-in kinds
    const owner = entity.spec?.owner;
    if (isCustomKind(entity) && typeof owner === 'string') {
      const selfRef = getCompoundEntityRef(entity);
      const ownerRef = parseEntityRef(owner, {
        defaultKind: 'Group',
        defaultNamespace: selfRef.namespace,
      });
      emit(processingResult.relation({ source: selfRef, type: RELATION_OWNED_BY, target: ownerRef }));
      emit(processingResult.relation({ source: ownerRef, type: RELATION_OWNER_OF, target: selfRef }));
    }
    return entity;
  }
}

function isCustomKind(entity: Entity) {
  return (
    entity.apiVersion === 'mycompany.io/v1alpha1' &&
    (entity.kind === 'Database' || entity.kind === 'Custom' || entity.kind === 'Service')
  );
}
