export interface Config {
  tenant?: {
    /**
     * Users (by email) allowed to create new tenants.
     */
    platformAdmins?: string[];
    /**
     * Local email/password sign-in (the `local` auth provider). Intended for
     * development or when no identity provider is available.
     */
    localAuth?: {
      enabled?: boolean;
      /**
       * Secret used to sign the session cookie.
       * @visibility secret
       */
      sessionSecret?: string;
      /** Session lifetime in minutes, defaults to 480 */
      sessionDurationMinutes?: number;
    };
    secrets?: {
      /**
       * Key for the built-in encrypted database secret provider. Any string
       * works; it is hashed into a 256-bit AES key. Required unless another
       * secret provider is installed.
       * @visibility secret
       */
      encryptionKey?: string;
    };
    /**
     * Data created on startup if missing. Intended for local development.
     */
    seed?: {
      users?: Array<{
        email: string;
        name?: string;
        /** @visibility secret */
        password?: string;
      }>;
      tenants?: Array<{
        slug: string;
        name: string;
        members?: Array<{ email: string; role: string }>;
        projects?: Array<{
          slug: string;
          name: string;
          description?: string;
          environments?: string[];
          /**
           * Emails of tenant members assigned to the project. Developers and
           * viewers only see the projects they are assigned to.
           */
          members?: string[];
        }>;
      }>;
    };
  };
}
