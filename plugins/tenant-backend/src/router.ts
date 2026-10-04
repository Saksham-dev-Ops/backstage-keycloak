import { HttpAuthService } from '@backstage/backend-plugin-api';
import { AuthenticationError, NotFoundError } from '@backstage/errors';
import express, { Request, Response } from 'express';
import Router from 'express-promise-router';
import { IdentityResolver, tenantGroupRefFor, userEntityRefFor } from './auth/identity';
import { KeycloakLogout } from './auth/keycloakLogout';
import {
  LoginRateLimiter,
  SessionCodec,
  sessionCookieHeader,
} from './auth/session';
import { TENANT_HEADER, TenantResolver } from './auth/tenantResolver';
import { TenantPluginConfig } from './config';
import { Services } from './service';
import { findTenantPluginForPath } from './tenantPlugins';
import { TenantContext } from './types';
import { idSchema, parse, parseId, schemas } from './validation';

export async function createRouter(options: {
  services: Services;
  httpAuth: HttpAuthService;
  config: TenantPluginConfig;
  secureCookies: boolean;
  keycloakLogout?: () => Promise<KeycloakLogout | undefined>;
}): Promise<express.Router> {
  const { services, httpAuth, config, secureCookies, keycloakLogout } = options;
  const identity = new IdentityResolver(httpAuth, services.users);
  const tenantResolver = new TenantResolver(services.authz);

  const router = Router();
  router.use(express.json({ limit: '256kb' }));

  /**
   * Every tenant-scoped route goes through here: authenticate, load the
   * application user, then verify membership of the requested tenant.
   */
  const withTenant =
    (handler: (ctx: TenantContext, req: Request, res: Response) => Promise<unknown>) =>
    async (req: Request, res: Response) => {
      const user = await identity.resolveUser(req);
      const ctx = await tenantResolver.resolve(req, user);
      await handler(ctx, req, res);
    };

  // --- Local email/password sessions ----------------------------------------

  const sessions =
    config.localAuth.enabled && config.localAuth.sessionSecret
      ? new SessionCodec(
          config.localAuth.sessionSecret,
          config.localAuth.sessionDurationSeconds,
        )
      : undefined;
  const rateLimiter = new LoginRateLimiter();

  router.post('/session/login', async (req, res) => {
    if (!sessions) {
      throw new NotFoundError('Local sign-in is disabled');
    }
    const { email, password } = parse(schemas.login, req.body);
    if (rateLimiter.isBlocked(email)) {
      res.status(429).json({ error: { name: 'TooManyRequests', message: 'Too many failed sign-in attempts, try again later' } });
      return;
    }
    const user = await services.users.verifyLocalCredentials(email, password);
    if (!user) {
      rateLimiter.recordFailure(email);
      throw new AuthenticationError('Invalid email or password');
    }
    rateLimiter.reset(email);
    res.setHeader(
      'Set-Cookie',
      sessionCookieHeader(sessions.encode(user.id), {
        maxAgeSeconds: sessions.durationSeconds,
        secure: secureCookies,
      }),
    );
    res.status(204).end();
  });

  router.post('/session/logout', async (_req, res) => {
    res.setHeader(
      'Set-Cookie',
      sessionCookieHeader('', { maxAgeSeconds: 0, secure: secureCookies }),
    );
    res.status(204).end();
  });

  // Where the browser ends its Keycloak session on sign-out
  router.get('/session/keycloak-logout', async (_req, res) => {
    res.json((await keycloakLogout?.()) ?? {});
  });

  // --- Invites (unauthenticated; tokens are sent in bodies, never in URLs) ----

  router.post('/session/invite/lookup', async (req, res) => {
    const { token } = parse(schemas.inviteToken, req.body);
    res.setHeader('Cache-Control', 'no-store');
    res.json(await services.invites.lookup(token));
  });

  router.post('/session/invite/accept', async (req, res) => {
    const { token, password } = parse(schemas.acceptInvite, req.body);
    res.json(await services.invites.accept(token, password));
  });

  // --- Internal, used by the auth module's sign-in resolver --------------------

  router.post('/internal/resolve-user', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['service'] });
    const input = parse(schemas.resolveUser, req.body);
    const email =
      'email' in input ? input.email : (await services.users.getById(input.userId))?.email;
    const user = email
      ? await services.users.resolveForSignIn(email, input.provider)
      : undefined;
    if (!user) {
      throw new NotFoundError('User not found');
    }
    const tenants = await services.tenants.listUserTenants(user);
    res.json({
      userId: user.id,
      userEntityRef: userEntityRefFor(user.id),
      ownershipEntityRefs: tenants.map(t => tenantGroupRefFor(t.slug)),
      email: user.email,
      name: user.name,
    });
  });

  // Used by the catalog module that publishes tenants as Group entities
  router.get('/internal/tenants', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['service'] });
    const tenants = await services.tenants.listActiveTenants();
    res.json({ items: tenants.map(({ id, name, slug }) => ({ id, name, slug })) });
  });

  /**
   * Used by `createTenantPluginGate`: may the caller of a backend request use
   * the plugin serving `path`? The original request's Authorization and
   * tenant headers are forwarded here.
   */
  router.post('/internal/plugin-access', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user', 'service'] });
    const { path } = parse(schemas.pluginAccess, req.body);
    const plugin = findTenantPluginForPath(path);
    if (!plugin || credentials.principal.type === 'service') {
      res.json({ allowed: true });
      return;
    }
    const user = await identity.resolveUser(req);
    const tenantId = req.header(TENANT_HEADER) || undefined;
    let allowed: boolean;
    try {
      allowed = await services.plugins.canUse(
        user,
        tenantId && idSchema.safeParse(tenantId).success ? tenantId : undefined,
        plugin.id,
      );
    } catch (error) {
      if (!(error instanceof NotFoundError)) {
        throw error;
      }
      // Not a member of the requested tenant
      allowed = false;
    }
    res.json({ allowed, pluginId: plugin.id, pluginTitle: plugin.title });
  });

  // --- Current user and tenant selection ------------------------------------

  router.get('/me', async (req, res) => {
    const user = await identity.resolveUser(req);
    res.json({
      user,
      isPlatformAdmin: services.tenants.isPlatformAdmin(user),
      tenants: await services.tenants.listUserTenants(user),
    });
  });

  router.post('/switch', async (req, res) => {
    const user = await identity.resolveUser(req);
    const { tenantId } = parse(schemas.switchTenant, req.body);
    res.json(await services.tenants.switchTenant(user, tenantId));
  });

  router.post('/tenants', async (req, res) => {
    const user = await identity.resolveUser(req);
    const input = parse(schemas.createTenant, req.body);
    res.status(201).json(await services.tenants.createTenant(user, input));
  });

  router.get(
    '/current',
    withTenant(async (ctx, _req, res) => res.json(services.tenants.describe(ctx))),
  );

  router.patch(
    '/current',
    withTenant(async (ctx, req, res) =>
      res.json(await services.tenants.updateTenant(ctx, parse(schemas.updateTenant, req.body))),
    ),
  );

  router.get(
    '/audit',
    withTenant(async (ctx, req, res) => {
      const { limit } = parse(schemas.auditQuery, req.query);
      res.json({ items: await services.tenants.listAuditLogs(ctx, limit) });
    }),
  );

  // --- Platform admin: all tenants, users and projects -----------------------

  router.get('/admin/overview', async (req, res) => {
    const user = await identity.resolveUser(req);
    res.json(await services.platform.overview(user));
  });

  router.get('/admin/tenants', async (req, res) => {
    const user = await identity.resolveUser(req);
    res.json({ items: await services.platform.listTenants(user) });
  });

  router.get('/admin/users', async (req, res) => {
    const user = await identity.resolveUser(req);
    res.json({ items: await services.platform.listUsers(user) });
  });

  router.get('/admin/projects', async (req, res) => {
    const user = await identity.resolveUser(req);
    const { tenantId } = parse(schemas.adminProjectsQuery, req.query);
    res.json({ items: await services.platform.listProjects(user, { tenantId }) });
  });

  router.get('/admin/tenants/:tenantId', async (req, res) => {
    const user = await identity.resolveUser(req);
    res.json(await services.platform.getTenant(user, parseId(req.params.tenantId, 'tenant id')));
  });

  router.patch('/admin/tenants/:tenantId', async (req, res) => {
    const user = await identity.resolveUser(req);
    const tenantId = parseId(req.params.tenantId, 'tenant id');
    const changes = parse(schemas.adminUpdateTenant, req.body);
    res.json(await services.platform.updateTenant(user, tenantId, changes));
  });

  router.delete('/admin/tenants/:tenantId', async (req, res) => {
    const user = await identity.resolveUser(req);
    await services.platform.deleteTenant(user, parseId(req.params.tenantId, 'tenant id'));
    res.status(204).end();
  });

  router.post('/admin/users/:userId/invite', async (req, res) => {
    const user = await identity.resolveUser(req);
    const invite = await services.invites.regenerate(user, parseId(req.params.userId, 'user id'));
    res.setHeader('Cache-Control', 'no-store');
    res.status(201).json(invite);
  });

  router.get('/admin/tenants/:tenantId/members', async (req, res) => {
    const user = await identity.resolveUser(req);
    const tenantId = parseId(req.params.tenantId, 'tenant id');
    res.json({ items: await services.platform.listTenantMembers(user, tenantId) });
  });

  router.post('/admin/tenants/:tenantId/members', async (req, res) => {
    const user = await identity.resolveUser(req);
    const tenantId = parseId(req.params.tenantId, 'tenant id');
    const input = parse(schemas.addMember, req.body);
    res.status(201).json(await services.platform.addTenantMember(user, tenantId, input));
  });

  router.patch('/admin/tenants/:tenantId/members/:userId', async (req, res) => {
    const user = await identity.resolveUser(req);
    const { role } = parse(schemas.updateMember, req.body);
    res.json(
      await services.platform.updateTenantMemberRole(
        user,
        parseId(req.params.tenantId, 'tenant id'),
        parseId(req.params.userId, 'user id'),
        role,
      ),
    );
  });

  router.delete('/admin/tenants/:tenantId/members/:userId', async (req, res) => {
    const user = await identity.resolveUser(req);
    await services.platform.removeTenantMember(
      user,
      parseId(req.params.tenantId, 'tenant id'),
      parseId(req.params.userId, 'user id'),
    );
    res.status(204).end();
  });

  // --- Plugins ----------------------------------------------------------------

  router.get(
    '/plugins',
    withTenant(async (ctx, _req, res) =>
      res.json({ items: await services.plugins.list(ctx) }),
    ),
  );

  router.put(
    '/plugins/:pluginId',
    withTenant(async (ctx, req, res) => {
      const pluginId = parse(schemas.pluginId, req.params.pluginId);
      const { enabled } = parse(schemas.setPlugin, req.body);
      res.json(await services.plugins.setEnabled(ctx, pluginId, enabled));
    }),
  );

  // --- Members ----------------------------------------------------------------

  router.get(
    '/members',
    withTenant(async (ctx, _req, res) =>
      res.json({ items: await services.users.listMembers(ctx) }),
    ),
  );

  router.post(
    '/members',
    withTenant(async (ctx, req, res) =>
      res.status(201).json(await services.users.addMember(ctx, parse(schemas.addMember, req.body))),
    ),
  );

  router.patch(
    '/members/:userId',
    withTenant(async (ctx, req, res) => {
      const userId = parseId(req.params.userId, 'user id');
      const { role } = parse(schemas.updateMember, req.body);
      res.json(await services.users.updateMemberRole(ctx, userId, role));
    }),
  );

  router.delete(
    '/members/:userId',
    withTenant(async (ctx, req, res) => {
      await services.users.removeMember(ctx, parseId(req.params.userId, 'user id'));
      res.status(204).end();
    }),
  );

  // --- Projects ---------------------------------------------------------------

  router.get(
    '/projects',
    withTenant(async (ctx, _req, res) =>
      res.json({ items: await services.projects.list(ctx) }),
    ),
  );

  router.post(
    '/projects',
    withTenant(async (ctx, req, res) =>
      res.status(201).json(await services.projects.create(ctx, parse(schemas.createProject, req.body))),
    ),
  );

  router.get(
    '/projects/:projectId',
    withTenant(async (ctx, req, res) =>
      res.json(await services.projects.get(ctx, parseId(req.params.projectId, 'project id'))),
    ),
  );

  router.patch(
    '/projects/:projectId',
    withTenant(async (ctx, req, res) => {
      const projectId = parseId(req.params.projectId, 'project id');
      res.json(await services.projects.update(ctx, projectId, parse(schemas.updateProject, req.body)));
    }),
  );

  router.delete(
    '/projects/:projectId',
    withTenant(async (ctx, req, res) => {
      await services.projects.delete(ctx, parseId(req.params.projectId, 'project id'));
      res.status(204).end();
    }),
  );

  // --- Project assignments ----------------------------------------------------

  router.get(
    '/projects/:projectId/members',
    withTenant(async (ctx, req, res) => {
      const projectId = parseId(req.params.projectId, 'project id');
      res.json({ items: await services.projects.listMembers(ctx, projectId) });
    }),
  );

  router.put(
    '/projects/:projectId/members/:userId',
    withTenant(async (ctx, req, res) => {
      const items = await services.projects.assignMember(
        ctx,
        parseId(req.params.projectId, 'project id'),
        parseId(req.params.userId, 'user id'),
      );
      res.json({ items });
    }),
  );

  router.delete(
    '/projects/:projectId/members/:userId',
    withTenant(async (ctx, req, res) => {
      await services.projects.unassignMember(
        ctx,
        parseId(req.params.projectId, 'project id'),
        parseId(req.params.userId, 'user id'),
      );
      res.status(204).end();
    }),
  );

  // --- Environments -----------------------------------------------------------

  router.get(
    '/projects/:projectId/environments',
    withTenant(async (ctx, req, res) => {
      const projectId = parseId(req.params.projectId, 'project id');
      res.json({ items: await services.environments.list(ctx, projectId) });
    }),
  );

  router.post(
    '/projects/:projectId/environments',
    withTenant(async (ctx, req, res) => {
      const projectId = parseId(req.params.projectId, 'project id');
      const { name } = parse(schemas.createEnvironment, req.body);
      res.status(201).json(await services.environments.create(ctx, projectId, name));
    }),
  );

  router.delete(
    '/projects/:projectId/environments/:environmentId',
    withTenant(async (ctx, req, res) => {
      await services.environments.delete(
        ctx,
        parseId(req.params.projectId, 'project id'),
        parseId(req.params.environmentId, 'environment id'),
      );
      res.status(204).end();
    }),
  );

  // --- Configuration and secrets ----------------------------------------------

  router.get(
    '/projects/:projectId/config',
    withTenant(async (ctx, req, res) => {
      const projectId = parseId(req.params.projectId, 'project id');
      const { environmentId } = parse(schemas.listConfig, req.query);
      res.json({ items: await services.configurations.list(ctx, projectId, environmentId) });
    }),
  );

  router.post(
    '/projects/:projectId/config',
    withTenant(async (ctx, req, res) => {
      const projectId = parseId(req.params.projectId, 'project id');
      const input = parse(schemas.createConfig, req.body);
      res.status(201).json(await services.configurations.create(ctx, projectId, input));
    }),
  );

  router.patch(
    '/projects/:projectId/config/:configId',
    withTenant(async (ctx, req, res) => {
      res.json(
        await services.configurations.update(
          ctx,
          parseId(req.params.projectId, 'project id'),
          parseId(req.params.configId, 'configuration id'),
          parse(schemas.updateConfig, req.body),
        ),
      );
    }),
  );

  router.delete(
    '/projects/:projectId/config/:configId',
    withTenant(async (ctx, req, res) => {
      await services.configurations.delete(
        ctx,
        parseId(req.params.projectId, 'project id'),
        parseId(req.params.configId, 'configuration id'),
      );
      res.status(204).end();
    }),
  );

  router.get(
    '/projects/:projectId/config/:configId/secret',
    withTenant(async (ctx, req, res) => {
      const secret = await services.configurations.revealSecret(
        ctx,
        parseId(req.params.projectId, 'project id'),
        parseId(req.params.configId, 'configuration id'),
      );
      res.setHeader('Cache-Control', 'no-store');
      res.json(secret);
    }),
  );

  return router;
}
