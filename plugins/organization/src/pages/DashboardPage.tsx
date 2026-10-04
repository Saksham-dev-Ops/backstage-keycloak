import { Link as RouterLink } from 'react-router-dom';
import { Content, ContentHeader, InfoCard, Progress } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import {
  StatTile,
  tenantApiRef,
  useLoader,
  useTenant,
} from '@internal/backstage-plugin-tenant-react';

export function DashboardPage() {
  const tenantApi = useApi(tenantApiRef);
  const { currentTenant, role, can } = useTenant();
  const projects = useLoader(() => tenantApi.listProjects(), [tenantApi]);
  const members = useLoader(() => tenantApi.listMembers(), [tenantApi]);
  const audit = useLoader(
    () => (can('audit.read') ? tenantApi.listAuditLogs() : Promise.resolve([])),
    [tenantApi],
  );

  const environments = projects.value?.reduce((sum, p) => sum + p.environmentCount, 0);
  const users = members.value?.filter(m => m.role === 'DEVELOPER' || m.role === 'VIEWER').length;

  return (
    <Content>
      <ContentHeader title={currentTenant?.name ?? ''} description={`Organization dashboard · you are ${role}`}>
        <Button component={RouterLink} to="/org/projects" color="primary" variant="contained">
          Projects
        </Button>
      </ContentHeader>
      <Grid container spacing={3}>
        <Grid item xs={6} md={3}>
          <StatTile label="Projects" value={projects.value?.length ?? '–'} />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatTile label="Environments" value={environments ?? '–'} />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatTile label="Members" value={members.value?.length ?? '–'} />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatTile label="Developers and viewers" value={users ?? '–'} />
        </Grid>

        <Grid item xs={12} md={6}>
          <InfoCard title="Projects" deepLink={{ link: '/org/projects', title: 'All projects' }}>
            {projects.loading && !projects.value && <Progress />}
            <List dense>
              {projects.value?.slice(0, 6).map(p => (
                <ListItem key={p.id} button component={RouterLink} to={`/org/projects/${p.id}`}>
                  <ListItemText primary={p.name} secondary={`${p.environmentCount} environments`} />
                </ListItem>
              ))}
            </List>
          </InfoCard>
        </Grid>
        {can('audit.read') && (
          <Grid item xs={12} md={6}>
            <InfoCard title="Recent activity" deepLink={{ link: '/org/audit', title: 'Audit log' }}>
              <List dense>
                {audit.value?.slice(0, 6).map(log => (
                  <ListItem key={log.id}>
                    <ListItemText
                      primary={log.action.replace(/_/g, ' ').toLowerCase()}
                      secondary={new Date(log.createdAt).toLocaleString()}
                    />
                  </ListItem>
                ))}
              </List>
            </InfoCard>
          </Grid>
        )}
      </Grid>
    </Content>
  );
}
