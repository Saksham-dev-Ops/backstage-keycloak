import { Link as RouterLink } from 'react-router-dom';
import { Content, EmptyState, Progress, ResponseErrorPanel } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { makeStyles } from '@material-ui/core';
import Card from '@material-ui/core/Card';
import CardActionArea from '@material-ui/core/CardActionArea';
import Chip from '@material-ui/core/Chip';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import { tenantApiRef, useLoader, useTenant } from '@internal/backstage-plugin-tenant-react';

const useStyles = makeStyles(theme => ({
  greeting: { fontSize: 32, fontWeight: 700, marginBottom: theme.spacing(0.5) },
  card: { height: '100%' },
  cardBody: { padding: theme.spacing(3) },
  initial: {
    width: 48,
    height: 48,
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
    fontWeight: 700,
    color: '#fff',
    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
    marginBottom: theme.spacing(2),
  },
}));

export function MyProjectsPage() {
  const classes = useStyles();
  const tenantApi = useApi(tenantApiRef);
  const { user, currentTenant, role } = useTenant();
  // The backend only returns the projects this user is assigned to
  const projects = useLoader(() => tenantApi.listProjects(), [tenantApi]);

  return (
    <Content>
      <Typography className={classes.greeting}>Hi {user?.name?.split(' ')[0] ?? 'there'} 👋</Typography>
      <Typography color="textSecondary" paragraph>
        Your projects in {currentTenant?.name}. You are a {role?.toLowerCase()}.
      </Typography>

      {projects.loading && !projects.value && <Progress />}
      {projects.error && <ResponseErrorPanel error={projects.error} />}
      {projects.value?.length === 0 && (
        <EmptyState
          missing="content"
          title="No projects yet"
          description="You are not assigned to any project. Ask an owner or admin of your organization to add you to one."
        />
      )}
      <Grid container spacing={3}>
        {projects.value?.map(project => (
          <Grid item xs={12} sm={6} md={4} key={project.id}>
            <Card className={classes.card}>
              <CardActionArea component={RouterLink} to={`/me/projects/${project.id}`}>
                <div className={classes.cardBody}>
                  <div className={classes.initial}>{project.name.charAt(0).toUpperCase()}</div>
                  <Typography variant="h6">{project.name}</Typography>
                  <Typography color="textSecondary" paragraph>
                    {project.description || 'No description'}
                  </Typography>
                  <Chip size="small" color="primary" label={`${project.environmentCount} environments`} />
                </div>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Content>
  );
}
