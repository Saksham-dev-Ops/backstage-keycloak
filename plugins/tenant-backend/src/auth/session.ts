import { createHmac, timingSafeEqual } from 'node:crypto';
import { Request } from 'express';

export const SESSION_COOKIE = 'backstage-tenant-session';

type SessionPayload = { uid: string; exp: number };

/**
 * HMAC-signed, HttpOnly session cookie for the local sign-in provider. It only
 * identifies the user; tenant membership and roles are always read from the
 * database, never from the cookie or the Backstage token.
 */
export class SessionCodec {
  constructor(
    private readonly secret: string,
    readonly durationSeconds: number,
  ) {}

  encode(userId: string): string {
    const payload: SessionPayload = {
      uid: userId,
      exp: Math.floor(Date.now() / 1000) + this.durationSeconds,
    };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${body}.${this.sign(body)}`;
  }

  /** Returns the user id of a valid, unexpired session. */
  decode(value: string | undefined): string | undefined {
    const [body, signature] = value?.split('.') ?? [];
    if (!body || !signature) {
      return undefined;
    }
    const expected = Buffer.from(this.sign(body));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      return undefined;
    }
    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      if (typeof payload?.uid !== 'string' || !(payload.exp > Date.now() / 1000)) {
        return undefined;
      }
      return payload.uid;
    } catch {
      return undefined;
    }
  }

  private sign(body: string) {
    return createHmac('sha256', this.secret).update(body).digest('base64url');
  }
}

export function readSessionCookie(req: Request): string | undefined {
  for (const part of req.headers.cookie?.split(';') ?? []) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === SESSION_COOKIE) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }
  return undefined;
}

export function sessionCookieHeader(
  value: string,
  options: { maxAgeSeconds: number; secure: boolean },
) {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/api',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${options.maxAgeSeconds}`,
    ...(options.secure ? ['Secure'] : []),
  ].join('; ');
}

/** Limits failed password attempts per email, in memory per backend instance. */
export class LoginRateLimiter {
  private readonly failures = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly maxFailures = 10,
    private readonly windowMs = 15 * 60 * 1000,
  ) {}

  isBlocked(key: string) {
    const entry = this.failures.get(key);
    if (entry && entry.resetAt < Date.now()) {
      this.failures.delete(key);
      return false;
    }
    return (entry?.count ?? 0) >= this.maxFailures;
  }

  recordFailure(key: string) {
    const entry = this.failures.get(key);
    if (!entry || entry.resetAt < Date.now()) {
      this.failures.set(key, { count: 1, resetAt: Date.now() + this.windowMs });
    } else {
      entry.count += 1;
    }
  }

  reset(key: string) {
    this.failures.delete(key);
  }
}
