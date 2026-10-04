import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Content,
  ContentHeader,
  EmptyState,
  InfoCard,
  Progress,
  ResponseErrorPanel,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import Button from '@material-ui/core/Button';
import Chip from '@material-ui/core/Chip';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import Grid from '@material-ui/core/Grid';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import { tenantApiRef } from '../api';
import { useTenant } from '../useTenant';
import { slugify, useAction, useLoader } from './shared';

function CreateProjectDialog(props: {
  open: boolean;
  onClose: () => void;
  onCreated: (projectId: string) => void;
}) {
  const tenantApi = useApi(tenantApiRef);
  const run = useAction();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [environments, setEnvironments] = useState('');

  const submit = async () => {
    let createdId: string | undefined;
    const ok = await run(async () => {
      const project = await tenantApi.createProject({
        name: name.trim(),
        slug: slug || slugify(name),
        description: description.trim() || undefined,
        // Empty means no environments yet; they can be added on the project page
        environments: environments
          .split(',')
          .map(e => e.trim().toLowerCase())
          .filter(Boolean),
      });
      createdId = project.id;
    }, `Project '${name}' created`);
    if (ok && createdId) {
      setName('');
      setSlug('');
      setDescription('');
      setEnvironments('');
      props.onCreated(createdId);
    }
  };

  return (
    <Dialog open={props.open} onClose={props.onClose} fullWidth maxWidth="sm">
      <DialogTitle>New project</DialogTitle>
      <DialogContent>
        <TextField label="Name" value={name} onChange={e => setName(e.target.value)} fullWidth margin="dense" required />
        <TextField
          label="Slug"
          value={slug}
          placeholder={slugify(name)}
          onChange={e => setSlug(e.target.value)}
          helperText="Unique within this organization"
          fullWidth
          margin="dense"
        />
        <TextField label="Description" value={description} onChange={e => setDescription(e.target.value)} fullWidth margin="dense" multiline />
        <TextField
          label="Environments"
          value={environments}
          onChange={e => setEnvironments(e.target.value)}
          placeholder="development, staging, production"
          helperText="Optional, comma separated. You can also add environments after creating the project."
          fullWidth
          margin="dense"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancel</Button>
        <Button color="primary" variant="contained" onClick={submit} disabled={!name.trim()}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function ProjectListPage() {
  const tenantApi = useApi(tenantApiRef);
  const { currentTenant, role, can } = useTenant();
  const projects = useLoader(() => tenantApi.listProjects(), [tenantApi]);
  const navigate = useNavigate();
  const [creatingProject, setCreatingProject] = useState(false);

  return (
    <Content>
      <ContentHeader title={currentTenant?.name ?? ''} description={`Projects · your role: ${role}`}>
        {can('project.create') && (
          <Button color="primary" variant="contained" onClick={() => setCreatingProject(true)}>
            New project
          </Button>
        )}
      </ContentHeader>

      {!can('project.create') && (
        <Typography variant="body2" color="textSecondary" paragraph>
          Only organization owners and admins can create projects. Your role is {role}.
        </Typography>
      )}
      {projects.loading && !projects.value && <Progress />}
      {projects.error && <ResponseErrorPanel error={projects.error} />}
      {projects.value?.length === 0 && (
        <EmptyState
          missing="content"
          title="No projects yet"
          description="Projects of this organization will show up here."
          action={
            can('project.create') ? (
              <Button color="primary" variant="contained" onClick={() => setCreatingProject(true)}>
                Create your first project
              </Button>
            ) : undefined
          }
        />
      )}
      <Grid container spacing={3}>
        {projects.value?.map(project => (
          <Grid item xs={12} sm={6} lg={4} key={project.id}>
            <InfoCard title={project.name} subheader={project.slug}>
              <Typography variant="body2" paragraph>
                {project.description || 'No description'}
              </Typography>
              <Chip size="small" label={`${project.environmentCount} environments`} />
              <div style={{ marginTop: 16 }}>
                <Button color="primary" variant="outlined" component={RouterLink} to={project.id}>
                  Open Project
                </Button>
              </div>
            </InfoCard>
          </Grid>
        ))}
      </Grid>

      <CreateProjectDialog
        open={creatingProject}
        onClose={() => setCreatingProject(false)}
        onCreated={projectId => {
          setCreatingProject(false);
          // Continue with setting up the new project's environments
          navigate(`${projectId}?tab=environments`);
        }}
      />
    </Content>
  );
}
