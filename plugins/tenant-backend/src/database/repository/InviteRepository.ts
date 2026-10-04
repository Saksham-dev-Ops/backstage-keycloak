import { randomUUID } from 'node:crypto';
import { Knex, toIso } from '../knex';

export type Invite = {
  id: string;
  userId: string;
  expiresAt: string;
  acceptedAt?: string;
};

export class InviteRepository {
  constructor(private readonly db: Knex) {}

  /** Replaces any open invite of the user with a new one. */
  async create(
    input: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
      createdBy?: string;
    },
    tx: Knex = this.db,
  ) {
    await tx('user_invites')
      .where({ user_id: input.userId })
      .whereNull('accepted_at')
      .delete();
    await tx('user_invites').insert({
      id: randomUUID(),
      user_id: input.userId,
      token_hash: input.tokenHash,
      expires_at: input.expiresAt,
      created_by: input.createdBy ?? null,
    });
  }

  /** An unused, unexpired invite with this token hash. */
  async findOpen(tokenHash: string): Promise<Invite | undefined> {
    const row = await this.db('user_invites')
      .where({ token_hash: tokenHash })
      .whereNull('accepted_at')
      .first();
    if (!row || new Date(row.expires_at).getTime() <= Date.now()) {
      return undefined;
    }
    return {
      id: row.id,
      userId: row.user_id,
      expiresAt: toIso(row.expires_at),
    };
  }

  /** Marks the invite used; false if another request used it first. */
  async accept(id: string, tx: Knex = this.db): Promise<boolean> {
    const updated = await tx('user_invites')
      .where({ id })
      .whereNull('accepted_at')
      .update({ accepted_at: tx.fn.now() });
    return Number(updated) === 1;
  }
}
