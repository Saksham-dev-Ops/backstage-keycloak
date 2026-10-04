export interface DatabaseEntity {
  apiVersion: 'mycompany.io/v1alpha1';
  kind: 'Database';

  metadata: {
    name: string;
    description?: string;
  };

  spec: {
    engine: string;
    version: string;
    owner: string;
    lifecycle: string;
  };
}