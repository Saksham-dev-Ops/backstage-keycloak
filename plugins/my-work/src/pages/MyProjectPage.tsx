import { useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { Content, ContentHeader, Progress, ResponseErrorPanel } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import Button from '@material-ui/core/Button';
import Chip from '@material-ui/core/Chip';
import Tab from '@material-ui/core/Tab';
import Tabs from '@material-ui/core/Tabs';
import {
  ConfigTab,
  ProjectTeamTab,
  tenantApiRef,
  useLoader,
} from '@internal/backstage-plugin-tenant-react';

/** One assigned project: its configuration, secrets and team. */
export function MyProjectPage() {
  const { projectId = '' } = useParams();
  const tenantApi = useApi(tenantApiRef);
  const project = useLoader(() => tenantApi.getProject(projectId), [tenantApi, projectId]);
  const [tab, setTab] = useState('config');

  if (project.error) {
    return (
      <Content>
        <ResponseErrorPanel error={project.error} />
        <Button component={RouterLink} to="/me" style={{ marginTop: 16 }}>
          Back to my projects
        </Button>
      </Content>
    );
  }
  if (!project.value) {
    return <Progress />;
  }

  const value = project.value;
  return (
    <Content>
      <ContentHeader title={value.name} description={value.description}>
        <Button component={RouterLink} to="/me">
          My projects
        </Button>
      </ContentHeader>
      <div style={{ marginBottom: 16 }}>
        {value.environments.map(env => (
          <Chip key={env.id} label={env.name} color="primary" variant="outlined" style={{ marginRight: 8 }} />
        ))}
      </div>
      <Tabs value={tab} onChange={(_e, next) => setTab(next)} indicatorColor="primary" style={{ marginBottom: 16 }}>
        <Tab value="config" label="Configuration" />
        <Tab value="secrets" label="Secrets" />
        <Tab value="team" label="Team" />
      </Tabs>
      {tab === 'config' && <ConfigTab project={value} />}
      {tab === 'secrets' && <ConfigTab project={value} secretsOnly />}
      {tab === 'team' && <ProjectTeamTab project={value} />}
    </Content>
  );
}
