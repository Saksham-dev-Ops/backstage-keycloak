import { randomUUID } from 'node:crypto';
import { User } from '../../types';
import { Knex, toIso } from '../knex';

type UserRow = {
  id: string;
  email: string;
  name: string;
  created_at: string | Date;
  updated_at: string | Date;
};

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export class UserRepository {
  constructor(private readonly db: Knex) {}

  async getById(id: string): Promise<User | undefined> {
    const row = await this.db<UserRow>('users').where({ id }).first();
    return row ? toUser(row) : undefined;
  }

  async getByEmail(email: string): Promise<User | undefined> {
    const row = await this.db<UserRow>('users')
      .where({ email: email.toLowerCase() })
      .first();
    return row ? toUser(row) : undefined;
  }

  async create(input: { email: string; name: string }, tx: Knex = this.db) {
    const id = randomUUID();
    await tx('users').insert({
      id,
      email: input.email.toLowerCase(),
      name: input.name,
    });
    return id;
  }

  async recordSignIn(userId: string) {
    await this.db('users')
      .where({ id: userId })
      .update({ last_sign_in_at: this.db.fn.now() });
  }

  async hasPassword(userId: string): Promise<boolean> {
    return !!(await this.getPasswordHash(userId));
  }

  async getPasswordHash(userId: string): Promise<string | undefined> {
    const row = await this.db('user_credentials')
      .where({ user_id: userId })
      .first('password_hash');
    return row?.password_hash;
  }

  async setPasswordHash(userId: string, hash: string, tx: Knex = this.db) {
    await tx('user_credentials')
      .insert({ user_id: userId, password_hash: hash })
      .onConflict('user_id')
      .merge({ password_hash: hash, updated_at: tx.fn.now() });
  }
}
