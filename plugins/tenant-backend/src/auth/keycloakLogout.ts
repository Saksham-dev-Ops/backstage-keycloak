import { LoggerService } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';

export type KeycloakLogout = { endSessionEndpoint: string; clientId: string };

/**
 * Where the browser ends its Keycloak session on sign-out (RP-initiated
 * logout). Signing out of Backstage alone keeps the Keycloak SSO session, so
 * "Sign in with Keycloak" would sign the same user straight back in.
 * Read from the realm metadata of auth.providers.oidc.<auth.environment>.
 */
export function createKeycloakLogoutResolver(
  rootConfig: Config,
  logger: LoggerService,
): () => Promise<KeycloakLogout | undefined> {
  const environment =
    rootConfig.getOptionalString('auth.environment') ?? 'development';
  const providerConfig = rootConfig.getOptionalConfig(
    `auth.providers.oidc.${environment}`,
  );
  const metadataUrl = providerConfig?.getOptionalString('metadataUrl');
  const clientId = providerConfig?.getOptionalString('clientId');
  let cached: Promise<KeycloakLogout | undefined> | undefined;

  return () => {
    if (!metadataUrl || !clientId) {
      return Promise.resolve(undefined);
    }
    cached ??= fetch(metadataUrl)
      .then(async response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const { end_session_endpoint } = await response.json();
        return typeof end_session_endpoint === 'string'
          ? { endSessionEndpoint: end_session_endpoint, clientId }
          : undefined;
      })
      .catch(error => {
        // Retry on the next sign-out instead of caching the failure
        cached = undefined;
        logger.warn(
          `Unable to read Keycloak metadata from ${metadataUrl}: ${error}`,
        );
        return undefined;
      });
    return cached;
  };
}
