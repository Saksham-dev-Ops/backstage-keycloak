import { useState } from 'react';
import { InfoCard, Progress, ResponseErrorPanel } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import MenuItem from '@material-ui/core/MenuItem';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import { ProjectDetails, tenantApiRef } from '../api';
import { useTenant } from '../useTenant';
import { confirmAction, useAction, useLoader } from './shared';

/**
 * People assigned to a project. Developers and viewers only see the projects
 * they are assigned to; owners and admins see every project and manage this.
 */
export function ProjectTeamTab(props: { project: ProjectDetails }) {
  const { project } = props;
  const tenantApi = useApi(tenantApiRef);
  const { can } = useTenant();
  const run = useAction();
  const canManage = can('member.manage');
  const team = useLoader(() => tenantApi.listProjectMembers(project.id), [tenantApi, project.id]);
  const members = useLoader(
    () => (canManage ? tenantApi.listMembers() : Promise.resolve([])),
    [tenantApi, canManage],
  );
  const [userId, setUserId] = useState('');

  const assigned = new Set(team.value?.map(m => m.userId));
  // Owners and admins see every project anyway, so only others are offered
  const candidates = (members.value ?? []).filter(
    m => !assigned.has(m.userId) && (m.role === 'DEVELOPER' || m.role === 'VIEWER'),
  );

  const assign = async () => {
    if (await run(() => tenantApi.assignProjectMember(project.id, userId), 'Member assigned')) {
      setUserId('');
      team.reload();
    }
  };

  const unassign = async (memberId: string, email: string) => {
    if (!confirmAction(`Remove ${email} from ${project.name}?`)) {
      return;
    }
    if (await run(() => tenantApi.unassignProjectMember(project.id, memberId), 'Member removed')) {
      team.reload();
    }
  };

  return (
    <InfoCard title="Project team">
      <Typography variant="body2" color="textSecondary" paragraph>
        Organization owners and admins see every project. Developers and viewers only see the
        projects they are assigned to here.
      </Typography>
      {team.loading && !team.value && <Progress />}
      {team.error && <ResponseErrorPanel error={team.error} />}
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Email</TableCell>
            <TableCell>Name</TableCell>
            <TableCell>Role</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {team.value?.length === 0 && (
            <TableRow>
              <TableCell colSpan={4}>Nobody is assigned yet.</TableCell>
            </TableRow>
          )}
          {team.value?.map(member => (
            <TableRow key={member.userId}>
              <TableCell>{member.email}</TableCell>
              <TableCell>{member.name}</TableCell>
              <TableCell>{member.role}</TableCell>
              <TableCell align="right">
                {canManage && (
                  <Button size="small" onClick={() => unassign(member.userId, member.email)}>
                    Remove
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {canManage && (
        <Grid container spacing={2} alignItems="center" style={{ marginTop: 16 }}>
          <Grid item xs={12} sm={8}>
            <TextField
              select
              label="Assign a developer or viewer"
              value={userId}
              onChange={e => setUserId(e.target.value)}
              size="small"
              variant="outlined"
              fullWidth
              helperText={
                members.value && !candidates.length
                  ? 'Every developer and viewer of this organization is assigned'
                  : undefined
              }
            >
              {candidates.map(m => (
                <MenuItem key={m.userId} value={m.userId}>
                  {m.name} ({m.email}) · {m.role}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Button color="primary" variant="contained" onClick={assign} disabled={!userId}>
              Assign
            </Button>
          </Grid>
        </Grid>
      )}
    </InfoCard>
  );
}
