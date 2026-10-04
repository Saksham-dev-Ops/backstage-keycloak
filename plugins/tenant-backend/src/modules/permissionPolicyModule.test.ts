import { catalogEntityReadPermission } from '@backstage/plugin-catalog-common/alpha';
import { AuthorizeResult, createPermission } from '@backstage/plugin-permission-common';
import { PolicyQueryUser } from '@backstage/plugin-permission-node';
import { TenantPermissionPolicy } from './permissionPolicyModule';

const userIn = (...ownershipEntityRefs: string[]) =>
  ({
    info: { userEntityRef: 'user:default/u1', ownershipEntityRefs },
  }) as PolicyQueryUser;

describe('TenantPermissionPolicy', () => {
  const policy = new TenantPermissionPolicy();

  it('allows permissions that are not about catalog entities', async () => {
    const permission = createPermission({ name: 'x.use', attributes: {} });
    await expect(policy.handle({ permission }, userIn())).resolves.toEqual({
      result: AuthorizeResult.ALLOW,
    });
  });

  it("limits catalog entities to the user's tenants", async () => {
    const decision = await policy.handle(
      { permission: catalogEntityReadPermission },
      userIn('user:default/u1', 'group:tenant/acme'),
    );
    expect(decision).toEqual({
      result: AuthorizeResult.CONDITIONAL,
      pluginId: 'catalog',
      resourceType: 'catalog-entity',
      conditions: {
        anyOf: [
          expect.objectContaining({
            rule: 'IS_ENTITY_OWNER',
            params: { claims: ['user:default/u1', 'group:tenant/acme'] },
          }),
          expect.objectContaining({ rule: 'IS_ENTITY_KIND' }),
          {
            allOf: [
              expect.objectContaining({ rule: 'IS_ENTITY_KIND', params: { kinds: ['Group'] } }),
              expect.objectContaining({ params: { key: 'namespace', value: 'tenant' } }),
              expect.objectContaining({ params: { key: 'name', value: 'acme' } }),
            ],
          },
        ],
      },
    });
  });
});
