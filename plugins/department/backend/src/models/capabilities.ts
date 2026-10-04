/**
 * What a department can use. Each area includes its tools when enabled;
 * "coming soon" tools are shown but not yet available.
 */
export type Capability = {
  id: string;
  title: string;
  description: string;
  included: string[];
  comingSoon: string[];
};

export const CAPABILITIES: Capability[] = [
  {
    id: 'project-management',
    title: 'Project management',
    description: 'Plan and track work',
    included: ['OpenProject'],
    comingSoon: ['Jira'],
  },
  {
    id: 'code-and-pipelines',
    title: 'Code and pipelines',
    description: 'Write, review, build and release',
    included: [
      'GitLab',
      'SonarQube',
      'OWASP',
      'Trivy',
      'Unit Testing',
      'Argo CD',
    ],
    comingSoon: ['API security testing'],
  },
  {
    id: 'monitoring-and-security',
    title: 'Monitoring and security',
    description: 'Watch services in production',
    included: ['VictoriaMetrics', 'Loki', 'Tempo', 'Grafana', 'Alertmanager'],
    comingSoon: ['Wazuh'],
  },
  {
    id: 'documentation',
    title: 'Documentation',
    description: 'Guides and shared documents',
    included: ['TechDocs'],
    comingSoon: ['SharePoint links'],
  },
  {
    id: 'ai-assistant',
    title: 'AI help assistant',
    description: 'Answers questions about the platform',
    included: ['Code Reviewer'],
    comingSoon: ['Chatbot'],
  },
];

export const CAPABILITY_IDS = CAPABILITIES.map(c => c.id) as [
  string,
  ...string[],
];
