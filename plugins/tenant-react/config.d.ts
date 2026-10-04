export interface Config {
  auth?: {
    /**
     * Auth environment, selects auth.providers.<provider>.<environment>.
     * @visibility frontend
     */
    environment?: string;
  };
}
