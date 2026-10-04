import { HttpAuthService, LoggerService } from '@backstage/backend-plugin-api';
import express, { Request, Response } from 'express';
import Router from 'express-promise-router';
import { RequestContext, TenantContextResolver } from '../auth/tenantContext';
import { CallerContext, DepartmentRole } from '../types';
import { departmentRoleFor } from '../auth/authorization';
import { TenantDirectory } from '../clients/TenantClient';
import { errorHandler } from './errors';
import { Services } from '.';
import { parse, parseId, schemas, shortCodeSchema } from './validation';

/** The caller's highest role in any department, for the UI. */
function highestRole(caller: CallerContext): DepartmentRole {
  if (caller.isPlatformAdmin) {
    return 'PLATFORM_ADMIN';
  }
  return caller.memberships.some(
    m => departmentRoleFor(m.role) === 'ORGANIZATION_ADMIN',
  )
    ? 'ORGANIZATION_ADMIN'
    : 'USER';
}

/**
 * HTTP layer only: authenticate, parse input, call a service. Authorization
 * and tenant isolation live in the services and `auth/authorization.ts`.
 */
export async function createRouter(options: {
  services: Services;
  tenants: TenantDirectory;
  httpAuth: HttpAuthService;
  logger: LoggerService;
}): Promise<express.Router> {
  const { services, tenants, httpAuth, logger } = options;
  const contexts = new TenantContextResolver(httpAuth, tenants);

  const router = Router();
  router.use(express.json({ limit: '64kb' }));

  /** Every user-facing route resolves the caller from the Backstage token first. */
  const withContext =
    (
      handler: (
        ctx: RequestContext,
        req: Request,
        res: Response,
      ) => Promise<unknown>,
    ) =>
    async (req: Request, res: Response) => {
      await handler(await contexts.resolve(req), req, res);
    };

  const departmentId = (req: Request) =>
    parseId(req.params.departmentId, 'department id');

  // --- Caller -----------------------------------------------------------------

  router.get(
    '/me',
    withContext(async ({ caller }, _req, res) => {
      res.json({
        user: caller.user,
        role: highestRole(caller),
        departments: caller.memberships.map(m => ({
          id: m.id,
          name: m.name,
          role: departmentRoleFor(m.role),
        })),
      });
    }),
  );

  // --- Departments --------------------------------------------------------------

  router.get(
    '/stats',
    withContext(async (ctx, _req, res) =>
      res.json(await services.departments.stats(ctx)),
    ),
  );

  router.get(
    '/departments',
    withContext(async (ctx, req, res) =>
      res.json(
        await services.departments.list(
          ctx,
          parse(schemas.listDepartments, req.query),
        ),
      ),
    ),
  );

  router.get(
    '/capabilities',
    withContext(async (ctx, _req, res) => {
      services.authz.requirePlatformAdmin(ctx.caller);
      res.json({ items: services.capabilities });
    }),
  );

  router.get(
    '/short-codes/:shortCode',
    withContext(async (ctx, req, res) => {
      const shortCode = parse(shortCodeSchema, req.params.shortCode);
      res.json({
        shortCode: shortCode.toUpperCase(),
        available: await services.departments.isShortCodeAvailable(
          ctx,
          shortCode,
        ),
      });
    }),
  );

  router.post(
    '/departments',
    withContext(async (ctx, req, res) => {
      const created = await services.departments.create(
        ctx,
        parse(schemas.createDepartment, req.body),
      );
      // Contains one-time invite tokens
      res.setHeader('Cache-Control', 'no-store');
      res.status(201).json(created);
    }),
  );

  router.get(
    '/departments/:departmentId',
    withContext(async (ctx, req, res) =>
      res.json(await services.departments.get(ctx, departmentId(req))),
    ),
  );

  router.put(
    '/departments/:departmentId',
    withContext(async (ctx, req, res) => {
      const id = departmentId(req);
      res.json(
        await services.departments.update(
          ctx,
          id,
          parse(schemas.updateDepartment, req.body),
        ),
      );
    }),
  );

  router.delete(
    '/departments/:departmentId',
    withContext(async (ctx, req, res) => {
      await services.departments.delete(ctx, departmentId(req));
      res.status(204).end();
    }),
  );

  // --- Users of a department ------------------------------------------------------

  router.get(
    '/departments/:departmentId/users',
    withContext(async (ctx, req, res) =>
      res.json({ items: await services.users.list(ctx, departmentId(req)) }),
    ),
  );

  router.post(
    '/departments/:departmentId/users',
    withContext(async (ctx, req, res) => {
      const id = departmentId(req);
      res
        .status(201)
        .json(
          await services.users.add(ctx, id, parse(schemas.addUser, req.body)),
        );
    }),
  );

  router.post(
    '/departments/:departmentId/users/:userId/invite',
    withContext(async (ctx, req, res) => {
      const invite = await services.users.createInvite(
        ctx,
        departmentId(req),
        parseId(req.params.userId, 'user id'),
      );
      res.setHeader('Cache-Control', 'no-store');
      res.status(201).json(invite);
    }),
  );

  router.put(
    '/departments/:departmentId/users/:userId',
    withContext(async (ctx, req, res) => {
      const id = departmentId(req);
      const userId = parseId(req.params.userId, 'user id');
      const { role } = parse(schemas.updateUser, req.body);
      res.json(await services.users.updateRole(ctx, id, userId, role));
    }),
  );

  router.delete(
    '/departments/:departmentId/users/:userId',
    withContext(async (ctx, req, res) => {
      await services.users.remove(
        ctx,
        departmentId(req),
        parseId(req.params.userId, 'user id'),
      );
      res.status(204).end();
    }),
  );

  // --- Projects of a department -----------------------------------------------------

  router.get(
    '/departments/:departmentId/projects',
    withContext(async (ctx, req, res) =>
      res.json({ items: await services.projects.list(ctx, departmentId(req)) }),
    ),
  );

  // --- Ministries -----------------------------------------------------------------

  router.get(
    '/ministries',
    withContext(async (ctx, _req, res) =>
      res.json({ items: await services.ministries.list(ctx) }),
    ),
  );

  router.post(
    '/ministries',
    withContext(async (ctx, req, res) =>
      res
        .status(201)
        .json(
          await services.ministries.create(
            ctx,
            parse(schemas.createMinistry, req.body),
          ),
        ),
    ),
  );

  router.get(
    '/ministries/:ministryId',
    withContext(async (ctx, req, res) =>
      res.json(
        await services.ministries.get(
          ctx,
          parseId(req.params.ministryId, 'ministry id'),
        ),
      ),
    ),
  );

  router.put(
    '/ministries/:ministryId',
    withContext(async (ctx, req, res) => {
      const id = parseId(req.params.ministryId, 'ministry id');
      res.json(
        await services.ministries.update(
          ctx,
          id,
          parse(schemas.updateMinistry, req.body),
        ),
      );
    }),
  );

  router.delete(
    '/ministries/:ministryId',
    withContext(async (ctx, req, res) => {
      await services.ministries.delete(
        ctx,
        parseId(req.params.ministryId, 'ministry id'),
      );
      res.status(204).end();
    }),
  );

  // --- Audit log -------------------------------------------------------------------

  router.get(
    '/audit',
    withContext(async (ctx, req, res) =>
      res.json({
        items: await services.audit.list(
          ctx,
          parse(schemas.auditQuery, req.query),
        ),
      }),
    ),
  );

  // --- Internal: limits for the tenant plugin's quota checks ----------------------------

  router.get('/internal/departments/:departmentId/limits', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['service'] });
    res.json(await services.departments.limitsFor(departmentId(req)));
  });

  router.use(errorHandler(logger));
  return router;
}
