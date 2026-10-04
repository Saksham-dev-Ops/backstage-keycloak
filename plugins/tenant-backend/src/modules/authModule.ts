import {
  AuthService,
  coreServices,
  createBackendModule,
  DiscoveryService,
} from '@backstage/backend-plugin-api';
import { AuthenticationError, NotAllowedError } from '@backstage/errors';
import {
  authProvidersExtensionPoint,
  createOAuthProviderFactory,
  createProxyAuthenticator,
  createProxyAuthProviderFactory,
  OAuthAuthenticatorResult,
  SignInResolver,
} from '@backstage/plugin-auth-node';
import {
  OidcAuthResult,
  oidcAuthenticator,
} from '@backstage/plugin-auth-backend-module-oidc-provider';
import { readSessionCookie, SessionCodec } from '../auth/session';
import { readTenantPluginConfig } from '../config';
import { TenantUserClient } from '../TenantUserClient';

/**
 * Sign-in resolver for any auth provider (Google, Okta, Microsoft Entra ID,
 * Keycloak/OIDC, ...). It looks the user up by verified email in the tenant
 * database and issues an identity with the user id plus the catalog groups of
 * the user's tenants (used for catalog ownership); roles stay server-side.
 */
export function createTenantSignInResolver(options: {
  discovery: DiscoveryService;
  auth: AuthService;
  providerId: string;
}): SignInResolver<unknown> {
  const client = new TenantUserClient(options.discovery, options.auth);
  return async ({ profile }, ctx) => {
    if (!profile.email) {
      throw new AuthenticationError(
        'Sign-in failed: the provider did not return an email',
      );
    }
    const user = await client.resolve(
      { email: profile.email },
      options.providerId,
    );
    if (!user) {
      throw new NotAllowedError(
        `Sign-in failed: ${profile.email} is not a member of any tenant`,
      );
    }
    return ctx.issueToken({
      claims: {
        sub: user.userEntityRef,
        ent: [user.userEntityRef, ...user.ownershipEntityRefs],
      },
    });
  };
}

type LocalSession = { userId: string };

/**
 * The `local` provider: signs in users that authenticated with email and
 * password at POST /api/tenant/session/login.
 */
export const authModuleTenantLocalProvider = createBackendModule({
  pluginId: 'auth',
  moduleId: 'tenant-local-provider',
  register(reg) {
    reg.registerInit({
      deps: {
        providers: authProvidersExtensionPoint,
        config: coreServices.rootConfig,
        discovery: coreServices.discovery,
        auth: coreServices.auth,
      },
      async init({ providers, config, discovery, auth }) {
        const { localAuth } = readTenantPluginConfig(config);
        if (!localAuth.enabled || !localAuth.sessionSecret) {
          return;
        }
        const sessions = new SessionCodec(
          localAuth.sessionSecret,
          localAuth.sessionDurationSeconds,
        );
        const client = new TenantUserClient(discovery, auth);

        const authenticator = createProxyAuthenticator<
          void,
          LocalSession,
          undefined
        >({
          defaultProfileTransform: async () => ({ profile: {} }),
          initialize() {},
          async authenticate({ req }) {
            const userId = sessions.decode(readSessionCookie(req));
            if (!userId) {
              throw new AuthenticationError('No valid session');
            }
            return { result: { userId } };
          },
        });

        providers.registerProvider({
          providerId: 'local',
          factory: createProxyAuthProviderFactory({
            authenticator,
            async profileTransform(result) {
              const user = await client.resolve(result, 'local');
              return {
                profile: user
                  ? { email: user.email, displayName: user.name }
                  : {},
              };
            },
            async signInResolver({ result }, ctx) {
              // Re-resolved on every refresh, so removed users lose access
              const user = await client.resolve(result, 'local');
              if (!user) {
                throw new NotAllowedError('You are not a member of any tenant');
              }
              return ctx.issueToken({
                claims: {
                  sub: user.userEntityRef,
                  ent: [user.userEntityRef, ...user.ownershipEntityRefs],
                },
              });
            },
          }),
        });
      },
    });
  },
});

/**
 * Keycloak sign-in through the generic OIDC provider (`auth.providers.oidc`).
 * Keycloak users are matched to tenant users by email, so the email must be
 * verified in Keycloak: otherwise anyone able to set an arbitrary email on
 * their Keycloak account could sign in as that tenant user.
 */
export const authModuleTenantKeycloakProvider = createBackendModule({
  pluginId: 'auth',
  moduleId: 'tenant-keycloak-provider',
  register(reg) {
    reg.registerInit({
      deps: {
        providers: authProvidersExtensionPoint,
        discovery: coreServices.discovery,
        auth: coreServices.auth,
      },
      async init({ providers, discovery, auth }) {
        const resolveTenantUser = createTenantSignInResolver({
          discovery,
          auth,
          providerId: 'oidc',
        });
        const signInResolver: SignInResolver<
          OAuthAuthenticatorResult<OidcAuthResult>
        > = async (info, ctx) => {
          const claims = {
            ...info.result.fullProfile.tokenset.claims(),
            ...info.result.fullProfile.userinfo,
          };
          if (claims.email_verified !== true) {
            throw new NotAllowedError(
              'Sign-in failed: your email address is not verified in Keycloak',
            );
          }
          return resolveTenantUser(info, ctx);
        };

        providers.registerProvider({
          providerId: 'oidc',
          factory: createOAuthProviderFactory({
            authenticator: oidcAuthenticator,
            signInResolver,
          }),
        });
      },
    });
  },
});
