export interface CustomEntity {
  apiVersion: 'mycompany.io/v1alpha1';
  kind: 'Custom';

  metadata: {
    name: string;
    description?: string;
  };

  spec: {
    type: string;
    owner: string;
    lifecycle: string;
  };
}
