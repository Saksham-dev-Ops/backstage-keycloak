export interface Config {
  department?: {
    /**
     * Data created on startup if missing. Intended for local development.
     */
    seed?: {
      ministries?: Array<{
        name: string;
        /**
         * Existing organizations (tenants, by slug) to place under this
         * ministry, with their limits. Applied once, when the organization
         * does not have a department profile yet.
         */
        departments?: Array<{
          tenantSlug: string;
          userLimit?: number;
          projectLimit?: number;
        }>;
      }>;
    };
  };
}
