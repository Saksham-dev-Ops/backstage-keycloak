import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { NotFoundError } from '@backstage/errors';
import { Knex } from '../database/knex';
import { SecretProvider } from './SecretProvider';

const ALGORITHM = 'aes-256-gcm';

/**
 * Default provider: stores secrets AES-256-GCM encrypted in the plugin's own
 * database, so plaintext never reaches the configurations table or backups.
 * Prefer a dedicated secret manager in production.
 */
export class EncryptedDatabaseSecretProvider implements SecretProvider {
  private readonly key: Buffer;

  constructor(
    private readonly db: Knex,
    encryptionKey: string,
  ) {
    this.key = createHash('sha256').update(encryptionKey).digest();
  }

  async getSecret(reference: string): Promise<string> {
    const row = await this.db('secrets').where({ reference }).first('ciphertext');
    if (!row) {
      throw new NotFoundError('Secret not found');
    }
    const [version, iv, tag, data] = String(row.ciphertext).split(':');
    if (version !== 'v1' || !iv || !tag || !data) {
      throw new Error('Unsupported secret format');
    }
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(iv, 'base64'));
    // Binds the ciphertext to its reference so rows cannot be swapped
    decipher.setAAD(Buffer.from(reference));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(data, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  async setSecret(reference: string, value: string): Promise<void> {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    cipher.setAAD(Buffer.from(reference));
    const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const ciphertext = [
      'v1',
      iv.toString('base64'),
      cipher.getAuthTag().toString('base64'),
      data.toString('base64'),
    ].join(':');
    await this.db('secrets')
      .insert({ reference, ciphertext })
      .onConflict('reference')
      .merge({ ciphertext, updated_at: this.db.fn.now() });
  }

  async deleteSecret(reference: string): Promise<void> {
    await this.db('secrets').where({ reference }).delete();
  }
}
