import { LoggerService } from '@backstage/backend-plugin-api';
import { createHash } from 'node:crypto';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import { TENANT_HEADER } from './auth/tenantResolver';
import { findTenantPluginForPath } from './tenantPlugins';

const CACHE_TTL_MS = 10_000;
const CACHE_MAX_ENTRIES = 5_000;

type Decision = { allowed: boolean; pluginTitle?: string };

/**
 * Root HTTP middleware that blocks the backends of plugins a tenant has turned
 * off (see `TENANT_PLUGINS`). The decision is made by the tenant plugin, which
 * verifies the caller's token and tenant membership; this middleware only
 * forwards the request's Authorization and `x-tenant-id` headers to it.
 *
 * Requests without an Authorization header (for example TechDocs static
 * assets, which use a cookie) are passed on unchanged; the plugins still
 * authenticate them. Service-to-service calls are always allowed.
 */
export function createTenantPluginGate(options: {
  /** Base URL of this backend, e.g. `http://localhost:7007` */
  baseUrl: string;
  logger: LoggerService;
}): RequestHandler {
  const accessUrl = `${options.baseUrl.replace(/\/$/, '')}/api/tenant/internal/plugin-access`;
  const cache = new Map<string, { decision: Decision; expires: number }>();

  const decide = async (path: string, authorization: string, tenantId?: string) => {
    const plugin = findTenantPluginForPath(path);
    const key = createHash('sha256')
      .update(`${plugin?.id}\n${tenantId ?? ''}\n${authorization}`)
      .digest('hex');
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.decision;
    }
    const response = await fetch(accessUrl, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
        ...(tenantId && { [TENANT_HEADER]: tenantId }),
      },
      body: JSON.stringify({ path }),
    });
    if (response.status === 401) {
      // Not a valid tenant user or service token: the plugin itself rejects it
      return { allowed: true };
    }
    if (!response.ok) {
      throw new Error(`Plugin access check failed with status ${response.status}`);
    }
    const decision: Decision = await response.json();
    if (cache.size >= CACHE_MAX_ENTRIES) {
      cache.clear();
    }
    cache.set(key, { decision, expires: Date.now() + CACHE_TTL_MS });
    return decision;
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    const authorization = req.header('authorization');
    if (!authorization || req.method === 'OPTIONS' || !findTenantPluginForPath(req.path)) {
      next();
      return;
    }
    try {
      const decision = await decide(req.path, authorization, req.header(TENANT_HEADER));
      if (decision.allowed) {
        next();
        return;
      }
      res.status(403).json({
        error: {
          name: 'NotAllowedError',
          message: `${decision.pluginTitle ?? 'This plugin'} is not enabled for your organization`,
        },
        request: { method: req.method, url: req.originalUrl },
        response: { statusCode: 403 },
      });
    } catch (error) {
      options.logger.error('Tenant plugin access check failed', error as Error);
      res.status(503).json({
        error: { name: 'ServiceUnavailableError', message: 'Plugin access check failed' },
        request: { method: req.method, url: req.originalUrl },
        response: { statusCode: 503 },
      });
    }
  };
}
