import { ReactNode, useCallback, useEffect, useState } from 'react';
import {
  Content,
  Header,
  InfoCard,
  Page,
  Progress,
  UserIdentity,
} from '@backstage/core-components';
import {
  configApiRef,
  DiscoveryApi,
  discoveryApiRef,
  IdentityApi,
  SignInPageProps,
  useApi,
} from '@backstage/core-plugin-api';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import Typography from '@material-ui/core/Typography';
import {
  readErrorMessage,
  readTenantPreference,
  TenantMembership,
  writeTenantPreference,
} from './api';
import { keycloakAuthApiRef } from './keycloak';

type KeycloakApi = typeof keycloakAuthApiRef.T;

function CenteredCard(props: { title: string; children: ReactNode }) {
  const configApi = useApi(configApiRef);
  return (
    <Page themeId="home">
      <Header title={configApi.getOptionalString('app.title') ?? 'Backstage'} />
      <Content>
        <Grid container justifyContent="center">
          <Grid item xs={12} sm={8} md={5} lg={4}>
            <InfoCard title={props.title}>{props.children}</InfoCard>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
}

/** The Keycloak session as an IdentityApi, or undefined if there is none. */
async function keycloakIdentity(
  keycloakApi: KeycloakApi,
  options: { optional?: boolean; instantPopup?: boolean },
): Promise<IdentityApi | undefined> {
  const response = await keycloakApi.getBackstageIdentity(options);
  if (!response) {
    return undefined;
  }
  return UserIdentity.create({
    identity: response.identity,
    authApi: keycloakApi,
    profile: await keycloakApi.getProfile(),
  });
}

/**
 * Ends the Backstage session and then the Keycloak session (RP-initiated
 * logout): the browser leaves for Keycloak and comes back to the app. Without
 * the second step, Keycloak's SSO cookie would sign the same user straight
 * back in.
 */
async function signOutOfKeycloak(
  keycloakApi: KeycloakApi,
  discoveryApi: DiscoveryApi,
  signOutOfBackstage: () => Promise<void>,
) {
  const idToken = await keycloakApi
    .getIdToken({ optional: true })
    .catch(() => undefined);
  await signOutOfBackstage();
  const baseUrl = await discoveryApi.getBaseUrl('tenant');
  const logout: { endSessionEndpoint?: string; clientId?: string } =
    await fetch(`${baseUrl}/session/keycloak-logout`)
      .then(r => (r.ok ? r.json() : {}))
      .catch(() => ({}));
  if (!logout.endSessionEndpoint || !logout.clientId) {
    return;
  }
  const url = new URL(logout.endSessionEndpoint);
  url.searchParams.set('client_id', logout.clientId);
  url.searchParams.set('post_logout_redirect_uri', window.location.origin);
  if (idToken) {
    url.searchParams.set('id_token_hint', idToken);
  }
  window.location.assign(url.toString());
  // Keep the app from navigating elsewhere while the browser leaves
  await new Promise(() => {});
}

/** "Choose Organization" step, shown when the user belongs to several tenants. */
export function OrganizationChooser(props: {
  tenants: TenantMembership[];
  onChoose: (tenant: TenantMembership) => void;
}) {
  const preferred = readTenantPreference();
  return (
    <List>
      {props.tenants.map(tenant => (
        <ListItem
          key={tenant.id}
          button
          selected={tenant.id === preferred}
          onClick={() => props.onChoose(tenant)}
        >
          <ListItemText primary={tenant.name} secondary={tenant.role} />
        </ListItem>
      ))}
    </List>
  );
}

type Step =
  | { type: 'checking' }
  | { type: 'signIn'; error?: string; submitting?: boolean }
  | { type: 'loading' }
  | { type: 'choosing'; identity: IdentityApi; tenants: TenantMembership[] }
  | { type: 'error'; message: string };

/**
 * Sign-in flow: Keycloak (the backend's `oidc` provider) → load tenant
 * memberships → pick a tenant. Keycloak is the only way to sign in.
 */
export function TenantSignInPage(props: SignInPageProps) {
  const { onSignInSuccess } = props;
  const discoveryApi = useApi(discoveryApiRef);
  const keycloakApi = useApi(keycloakAuthApiRef);
  const [step, setStep] = useState<Step>({ type: 'checking' });

  const tenantFetch = useCallback(
    async (identity: IdentityApi, path: string, init?: RequestInit) => {
      const { token } = await identity.getCredentials();
      const baseUrl = await discoveryApi.getBaseUrl('tenant');
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          ...init?.headers,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      return response.json();
    },
    [discoveryApi],
  );

  const finish = useCallback(
    (identity: IdentityApi) =>
      onSignInSuccess({
        getProfileInfo: () => identity.getProfileInfo(),
        getBackstageIdentity: () => identity.getBackstageIdentity(),
        getCredentials: () => identity.getCredentials(),
        signOut: () =>
          signOutOfKeycloak(keycloakApi, discoveryApi, () =>
            identity.signOut(),
          ),
      }),
    [discoveryApi, keycloakApi, onSignInSuccess],
  );

  const choose = useCallback(
    async (identity: IdentityApi, tenant: TenantMembership) => {
      try {
        await tenantFetch(identity, '/switch', {
          method: 'POST',
          body: JSON.stringify({ tenantId: tenant.id }),
        });
        writeTenantPreference(tenant.id);
        finish(identity);
      } catch (e) {
        setStep({ type: 'error', message: (e as Error).message });
      }
    },
    [tenantFetch, finish],
  );

  const handleAuthenticated = useCallback(
    async (identity: IdentityApi) => {
      setStep({ type: 'loading' });
      try {
        const me = await tenantFetch(identity, '/me');
        const tenants: TenantMembership[] = me.tenants;
        if (me.isPlatformAdmin) {
          // The platform admin UI covers every organization
          finish(identity);
        } else if (tenants.length === 1) {
          writeTenantPreference(tenants[0].id);
          finish(identity);
        } else if (tenants.length > 1) {
          setStep({ type: 'choosing', identity, tenants });
        } else {
          setStep({
            type: 'error',
            message: 'You are not a member of any organization.',
          });
        }
      } catch (e) {
        setStep({ type: 'error', message: (e as Error).message });
      }
    },
    [tenantFetch, finish],
  );

  // Resume an existing Keycloak session (e.g. after a page reload) without a popup
  useEffect(() => {
    let cancelled = false;
    keycloakIdentity(keycloakApi, { optional: true })
      .then(identity => {
        if (cancelled) return;
        if (identity) {
          handleAuthenticated(identity);
        } else {
          setStep({ type: 'signIn' });
        }
      })
      .catch(() => !cancelled && setStep({ type: 'signIn' }));
    return () => {
      cancelled = true;
    };
  }, [keycloakApi, handleAuthenticated]);

  const signIn = async () => {
    setStep({ type: 'signIn', submitting: true });
    try {
      const identity = await keycloakIdentity(keycloakApi, {
        instantPopup: true,
      });
      if (!identity) {
        throw new Error('Keycloak sign-in was cancelled');
      }
      await handleAuthenticated(identity);
    } catch (e) {
      setStep({ type: 'signIn', error: (e as Error).message });
    }
  };

  if (step.type === 'checking' || step.type === 'loading') {
    return <Progress />;
  }

  if (step.type === 'choosing') {
    return (
      <CenteredCard title="Choose Organization">
        <OrganizationChooser
          tenants={step.tenants}
          onChoose={tenant => choose(step.identity, tenant)}
        />
      </CenteredCard>
    );
  }

  if (step.type === 'error') {
    return (
      <CenteredCard title="Unable to sign in">
        <Typography color="error" paragraph>
          {step.message}
        </Typography>
        <Button
          variant="outlined"
          onClick={async () => {
            await signOutOfKeycloak(keycloakApi, discoveryApi, () =>
              keycloakApi.signOut(),
            );
            setStep({ type: 'signIn' });
          }}
        >
          Sign in as someone else
        </Button>
      </CenteredCard>
    );
  }

  return (
    <CenteredCard title="Sign in">
      {step.error && (
        <Typography color="error" role="alert" paragraph>
          {step.error}
        </Typography>
      )}
      <Button
        color="primary"
        variant="contained"
        disabled={step.submitting}
        onClick={signIn}
        fullWidth
      >
        {step.submitting ? 'Signing in…' : 'Sign in with Keycloak'}
      </Button>
      {step.error && (
        <Button
          variant="outlined"
          style={{ marginTop: 16 }}
          onClick={() =>
            signOutOfKeycloak(keycloakApi, discoveryApi, async () => {})
          }
          fullWidth
        >
          Use a different Keycloak account
        </Button>
      )}
    </CenteredCard>
  );
}
