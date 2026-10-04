import { InputError, NotAllowedError, NotFoundError } from '@backstage/errors';
import { createHash, randomBytes } from 'node:crypto';
import { hashPassword } from '../auth/password';
import { Knex } from '../database/knex';
import { Repositories } from '../database/repository';
import { User } from '../types';
import { AuditService } from './auditService';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type CreatedInvite = { token: string; expiresAt: string };

export function hashInviteToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * One-time links that let users without a password set one. Tokens are 256
 * random bits; only their SHA-256 hash is stored. Invites only exist when
 * local email/password sign-in is enabled.
 */
export class InviteService {
  constructor(
    private readonly repos: Repositories,
    private readonly audit: AuditService,
    private readonly options: {
      localAuthEnabled: boolean;
      isPlatformAdmin: (user: Pick<User, 'email'>) => boolean;
    },
  ) {}

  get enabled() {
    return this.options.localAuthEnabled;
  }

  /**
   * Creates an invite for a user without a password, replacing older ones.
   * Callers must have authorized creating it.
   */
  async createFor(
    userId: string,
    createdBy: string | undefined,
    tx: Knex = this.repos.db,
  ): Promise<CreatedInvite | undefined> {
    if (!this.enabled) {
      return undefined;
    }
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    await this.repos.invites.create(
      { userId, tokenHash: hashInviteToken(token), expiresAt, createdBy },
      tx,
    );
    return { token, expiresAt: expiresAt.toISOString() };
  }

  /**
   * Platform admins can issue a new link for a user who has never set a
   * password. Users with a password are refused, so this can never be used
   * to take over an account.
   */
  async regenerate(actor: User, userId: string): Promise<CreatedInvite> {
    if (!this.options.isPlatformAdmin(actor)) {
      throw new NotAllowedError('Only platform admins can create invite links');
    }
    if (!this.enabled) {
      throw new InputError(
        'Invite links need local email/password sign-in to be enabled',
      );
    }
    const user = await this.repos.users.getById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    if (await this.repos.users.hasPassword(userId)) {
      throw new InputError('This user has already set a password');
    }
    const invite = (await this.createFor(userId, actor.id))!;
    await this.audit.record({
      userId: actor.id,
      action: 'INVITE_CREATED',
      resourceType: 'user',
      resourceId: userId,
    });
    return invite;
  }

  /** Who the invite is for; the same 404 for unknown, used and expired tokens. */
  async lookup(token: string) {
    const invite = this.enabled
      ? await this.repos.invites.findOpen(hashInviteToken(token))
      : undefined;
    const user = invite
      ? await this.repos.users.getById(invite.userId)
      : undefined;
    if (!invite || !user) {
      throw new NotFoundError('This invite link is invalid or has expired');
    }
    return { email: user.email, name: user.name, expiresAt: invite.expiresAt };
  }

  /** Sets the user's password and uses up the invite. */
  async accept(token: string, password: string) {
    const invite = this.enabled
      ? await this.repos.invites.findOpen(hashInviteToken(token))
      : undefined;
    if (!invite) {
      throw new NotFoundError('This invite link is invalid or has expired');
    }
    const passwordHash = await hashPassword(password);
    await this.repos.db.transaction(async tx => {
      // Single use, even with concurrent requests
      if (!(await this.repos.invites.accept(invite.id, tx))) {
        throw new NotFoundError('This invite link is invalid or has expired');
      }
      await this.repos.users.setPasswordHash(invite.userId, passwordHash, tx);
    });
    await this.audit.record({
      userId: invite.userId,
      action: 'INVITE_ACCEPTED',
      resourceType: 'user',
      resourceId: invite.userId,
    });
    const user = await this.repos.users.getById(invite.userId);
    return { email: user!.email };
  }
}
