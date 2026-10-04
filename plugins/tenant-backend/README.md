# Tenant backend plugin

Multi-tenant project, environment and configuration management, mounted at
`/api/tenant`. Data lives in the plugin's own PostgreSQL database
(`backstage_plugin_tenant`), created and migrated on startup.

## Request pipeline

Every tenant-scoped request goes through the same steps (`router.ts` → `withTenant`):

1. **Authenticate**: Backstage token → `user:default/<user id>` (`auth/identity.ts`)
2. **Load the user** from the `users` table
3. **Current tenant**: from the `x-tenant-id` header, re-validated against
   `user_tenants` on every request (`auth/tenantResolver.ts`). Non-members get 404.
4. **RBAC and resource checks**: `service/authorizationService.ts`
5. **Tenant-scoped queries**: repositories never look up tenant-owned rows
   without a tenant id (environments and configurations join through `projects`).

Tokens never contain tenants or roles; those are always read from the database.

## Roles

| Permission           | OWNER | ADMIN | DEVELOPER | VIEWER |
| -------------------- | :---: | :---: | :-------: | :----: |
| tenant.manage        |   ✓   |       |           |        |
| member.manage        |   ✓   |   ✓   |           |        |
| project.create/update/delete, environment.manage | ✓ | ✓ | | |
| config.write         |   ✓   |   ✓   |     ✓     |        |
| secret.write         |   ✓   |   ✓   |     ✓     |        |
| secret.read (reveal) |   ✓   |   ✓   |           |        |
| audit.read           |   ✓   |   ✓   |           |        |
| member/project/config.read | ✓ | ✓ | ✓ | ✓ |

Nobody can change their own membership. Nobody can grant, change or remove a
role above their own, so admins cannot touch owners.

## Catalog isolation

Each active tenant is published to the catalog as a Group, `group:tenant/<slug>`
(`catalogModuleTenantGroups`), and signed-in users carry the groups of their
tenants in their ownership claims. `permissionModuleTenantPolicy` then only
lets users see and act on catalog entities owned by one of their tenants:

```yaml
spec:
  owner: group:tenant/acme
```

Entities owned by anything else (for example `guests`) are hidden from
everyone; Templates and Users are shared. A user who belongs to several tenants
sees the entities of all of them. Membership changes apply when the user's
Backstage token is next refreshed.

## Keycloak sign-in

Keycloak is the only way to sign in. `authModuleTenantKeycloakProvider`
registers the `oidc` auth provider with `createTenantSignInResolver`: a
Keycloak user signs in as the tenant user with the same email. The email must
be verified in Keycloak (`email_verified`), and the user must exist in the
tenant database and belong to a tenant (or be listed in `tenant.platformAdmins`).
Admins add users by email (Add user, Add department, New organization); those
users then sign in with their Keycloak account. No passwords are stored, and
`tenant.localAuth` (email/password sign-in and invite links) stays disabled.

Configuration (`app-config.yaml`, values from `.env`, start with `yarn start:local`):

| Variable                      | Value                                                        |
| ----------------------------- | ------------------------------------------------------------ |
| `AUTH_OIDC_METADATA_URL`      | `https://<keycloak>/realms/<realm>/.well-known/openid-configuration` |
| `AUTH_OIDC_CLIENT_ID`         | Client ID of the Keycloak client                             |
| `AUTH_OIDC_CLIENT_SECRET`     | Client secret (Credentials tab)                              |
| `AUTH_SESSION_SECRET`         | Any long random string                                       |
| `AUTH_ENVIRONMENT`            | `development` or `production`                                |
| `TENANT_PLATFORM_ADMIN_EMAIL` | Email of the Keycloak account that runs the admin console    |

In the Keycloak client:

- **Client authentication** on, **Standard flow** enabled
- **Valid redirect URIs**: `<backend.baseUrl>/api/auth/oidc/handler/frame`
  (`http://localhost:7007/api/auth/oidc/handler/frame` locally)
- **Valid post logout redirect URIs**: `<app.baseUrl>` (`http://localhost:3000`
  locally). Signing out also ends the Keycloak session, so the next sign-in
  asks for credentials again.
- The `email` and `profile` client scopes assigned

Other providers (Google, Microsoft, Okta, ...) work the same way: register
their authenticator with `createTenantSignInResolver`, see
`modules/authModule.ts`.

## Secret providers

By default, secrets are encrypted with AES-256-GCM (`tenant.secrets.encryptionKey`)
and stored in the `secrets` table. Only a reference is kept in `configurations`.
To use Vault, AWS Secrets Manager, Azure Key Vault or GCP Secret Manager,
implement `SecretProvider` in a backend module:

```ts
createBackendModule({
  pluginId: 'tenant',
  moduleId: 'vault-secrets',
  register(reg) {
    reg.registerInit({
      deps: { secrets: tenantSecretProviderExtensionPoint },
      async init({ secrets }) {
        secrets.setSecretProvider(new MyVaultSecretProvider(/* ... */));
      },
    });
  },
});
```

## Tests

`yarn test` in this package runs the tenant-isolation and RBAC suite against
SQLite, and also against PostgreSQL 17 when Docker is available or
`BACKSTAGE_TEST_DATABASE_POSTGRES17_CONNECTION_STRING` is set.
