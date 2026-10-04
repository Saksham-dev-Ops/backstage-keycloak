import {
  ApiRef,
  BackstageIdentityApi,
  createApiRef,
  OpenIdConnectApi,
  ProfileInfoApi,
  SessionApi,
} from '@backstage/core-plugin-api';

/** Keycloak sign-in, backed by the backend's `oidc` auth provider. */
export const keycloakAuthApiRef: ApiRef<
  OpenIdConnectApi & ProfileInfoApi & BackstageIdentityApi & SessionApi
> = createApiRef({ id: 'internal.auth.keycloak' });
