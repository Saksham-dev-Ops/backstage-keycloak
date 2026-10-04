# Department plugin

The departments console of the platform admin UI (OpenForge design), as a
full-stack plugin:

| Package | Path | Role |
| --- | --- | --- |
| `@internal/backstage-plugin-department` | `frontend/` | Pages under `/admin/departments`, `/admin/ministries`, `/admin/audit` |
| `@internal/plugin-department-backend` | `backend/` | REST API at `/api/department`, plus `tenantModuleDepartmentQuota` |

## Data model

A **department is a tenant** of the tenant plugin (`plugins/tenant-backend`):
the tenant is the isolation unit, its OWNER/ADMIN members are the department
admins, and its members and projects are the department's users and
projects. Users, memberships and projects live only in the tenant plugin.

This plugin's own database (`backstage_plugin_department`) stores what the
tenant plugin does not know about:

- `ministries` (`id`, unique `name` and `slug`, `description`, timestamps)
- `departments` (`tenant_id` PK = tenant id, `ministry_id` → `ministries`
  ON DELETE RESTRICT, `user_limit`, `project_limit`, `created_by`, timestamps;
  index on `ministry_id`)
- `department_audit_logs` (indexes on `created_at` and `(tenant_id, created_at)`)

Department status is derived: `suspended` (tenant suspended), `no_admin` (no
OWNER/ADMIN), `invite_pending` (no admin has ever signed in, from the tenant
plugin's `users.last_sign_in_at`), otherwise `active`.

## Request pipeline

```
React page → departmentApiRef (DepartmentClient: discoveryApi + fetchApi)
  → /api/department (router.ts: authenticate + validate only)
  → auth/tenantContext.ts: Backstage token → caller + memberships, read from
    the tenant plugin's /me on behalf of the user (never from the client)
  → auth/authorization.ts: role in the department, 404 if not visible
  → services → repositories (keyed by tenant_id) / TenantClient (on behalf of
    the user, so the tenant plugin re-checks membership and roles)
```

## Roles

| | PLATFORM_ADMIN | ORGANIZATION_ADMIN (OWNER/ADMIN) | USER (DEVELOPER/VIEWER) |
| --- | :-: | :-: | :-: |
| List / view departments | all | own | own |
| Create, edit, suspend, delete departments; stats | ✓ | | |
| Ministries, audit log | ✓ | | |
| List users of a department | ✓ | own | |
| Add / change / remove users | ✓ | own, no escalation | |
| List projects of a department | all | own, all | own, assigned only |

Departments the caller cannot see return 404, not 403, so their existence is
not leaked. Organization admins act through the tenant plugin's tenant-scoped
endpoints, so its rules apply: nobody changes their own membership or grants a
role above their own.

## Limits

`tenantModuleDepartmentQuota` installs a quota provider in the tenant plugin
(`tenantQuotaExtensionPoint`). The tenant plugin then refuses (409) new
members or projects beyond a department's limits from every UI, including the
organization UI. The provider reads `/api/department/internal/departments/:id/limits`
with a service token and fails closed.

## Errors

All errors are `{ "error": { "code": "DEPARTMENT_NOT_FOUND", "message": "..." } }`
with 400/401/403/404/409; unexpected errors are logged and returned as a
generic 500 without details.

## Tests

`yarn test` in `backend/` starts the real tenant and department plugins in one
test backend and covers CRUD, validation, tenant isolation, authorization,
limits and the audit log. It runs on SQLite, and on PostgreSQL when Docker is
available or `BACKSTAGE_TEST_DATABASE_POSTGRES17_CONNECTION_STRING` is set.
