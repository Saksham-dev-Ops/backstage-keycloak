import { createExtensionPoint } from '@backstage/backend-plugin-api';

/**
 * Stores secret configuration values outside of the configurations table.
 * Implement this for AWS Secrets Manager, HashiCorp Vault, Azure Key Vault,
 * GCP Secret Manager etc., and install it through
 * {@link tenantSecretProviderExtensionPoint}.
 *
 * References are opaque, tenant-prefixed paths such as
 * `tenants/<tenantId>/projects/<projectId>/configs/<configId>`.
 */
export interface SecretProvider {
  getSecret(reference: string): Promise<string>;
  setSecret(reference: string, value: string): Promise<void>;
  deleteSecret(reference: string): Promise<void>;
}

export interface TenantSecretProviderExtensionPoint {
  setSecretProvider(provider: SecretProvider): void;
}

export const tenantSecretProviderExtensionPoint =
  createExtensionPoint<TenantSecretProviderExtensionPoint>({
    id: 'tenant.secret-provider',
  });

export function secretReference(tenantId: string, projectId: string, configId: string) {
  return `tenants/${tenantId}/projects/${projectId}/configs/${configId}`;
}
