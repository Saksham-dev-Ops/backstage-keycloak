import { useState } from 'react';
import { InfoCard, Progress, ResponseErrorPanel } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import Button from '@material-ui/core/Button';
import Checkbox from '@material-ui/core/Checkbox';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Grid from '@material-ui/core/Grid';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import { ConfigEntry, ProjectDetails, tenantApiRef } from '../api';
import { useTenant } from '../useTenant';
import { confirmAction, EnvironmentSelect, useAction, useLoader } from './shared';

type Editing = { entry?: ConfigEntry; isSecret: boolean };

function ConfigDialog(props: {
  editing?: Editing;
  canCreateSecret: boolean;
  onClose: () => void;
  onSave: (values: { key: string; value?: string; isSecret: boolean }) => Promise<boolean>;
}) {
  const { editing } = props;
  const [key, setKey] = useState(editing?.entry?.key ?? '');
  const [value, setValue] = useState(editing?.entry?.value ?? '');
  const [isSecret, setIsSecret] = useState(editing?.isSecret ?? false);
  const isNew = !editing?.entry;

  return (
    <Dialog open onClose={props.onClose} fullWidth maxWidth="sm">
      <DialogTitle>{isNew ? 'Add' : 'Edit'} {isSecret ? 'secret' : 'configuration'}</DialogTitle>
      <DialogContent>
        <TextField label="Key" value={key} onChange={e => setKey(e.target.value)} fullWidth margin="dense" required />
        <TextField
          label={isSecret && !isNew ? 'New value (leave empty to keep)' : 'Value'}
          value={value}
          type={isSecret ? 'password' : 'text'}
          autoComplete="off"
          onChange={e => setValue(e.target.value)}
          fullWidth
          margin="dense"
          multiline={!isSecret}
        />
        {isNew && props.canCreateSecret && (
          <FormControlLabel
            control={<Checkbox checked={isSecret} onChange={e => setIsSecret(e.target.checked)} />}
            label="Secret (stored in the secret provider, never shown in listings)"
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancel</Button>
        <Button
          color="primary"
          variant="contained"
          disabled={!key.trim()}
          onClick={async () => {
            const changedValue = isSecret && !isNew && value === '' ? undefined : value;
            if (await props.onSave({ key: key.trim(), value: changedValue, isSecret })) {
              props.onClose();
            }
          }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Configuration of one environment. With `secretsOnly`, lists secrets with
 * reveal support; otherwise all entries, with secret values masked.
 */
export function ConfigTab(props: { project: ProjectDetails; secretsOnly?: boolean }) {
  const { project, secretsOnly } = props;
  const tenantApi = useApi(tenantApiRef);
  const { can } = useTenant();
  const run = useAction();
  const [environmentId, setEnvironmentId] = useState(project.environments[0]?.id);
  const [editing, setEditing] = useState<Editing>();
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  const config = useLoader(
    () => (environmentId ? tenantApi.listConfig(project.id, environmentId) : Promise.resolve([])),
    [tenantApi, project.id, environmentId],
  );

  const canWrite = (isSecret: boolean) => can(isSecret ? 'secret.write' : 'config.write');
  const entries = (config.value ?? []).filter(entry => !secretsOnly || entry.isSecret);

  const reveal = async (entry: ConfigEntry) => {
    if (revealed[entry.id] !== undefined) {
      setRevealed(({ [entry.id]: _, ...rest }) => rest);
      return;
    }
    await run(async () => {
      const value = await tenantApi.revealSecret(project.id, entry.id);
      setRevealed(r => ({ ...r, [entry.id]: value }));
    }, `Secret ${entry.key} revealed (this access is audited)`);
  };

  const save = async (values: { key: string; value?: string; isSecret: boolean }) => {
    if (!environmentId) {
      return false;
    }
    const ok = await run(
      () =>
        editing?.entry
          ? tenantApi.updateConfig(project.id, editing.entry.id, {
              key: values.key !== editing.entry.key ? values.key : undefined,
              value: values.value,
            })
          : tenantApi.createConfig(project.id, {
              environmentId,
              key: values.key,
              value: values.value ?? '',
              isSecret: values.isSecret,
            }),
      `${values.key} saved`,
    );
    if (ok) {
      setRevealed({});
      config.reload();
    }
    return ok;
  };

  if (!project.environments.length) {
    return <Typography>This project has no environments yet.</Typography>;
  }

  return (
    <InfoCard title={secretsOnly ? 'Secrets' : 'Configuration'}>
      <Grid container spacing={2} alignItems="center" justifyContent="space-between">
        <Grid item>
          <EnvironmentSelect
            environments={project.environments}
            value={environmentId}
            onChange={id => {
              setRevealed({});
              setEnvironmentId(id);
            }}
          />
        </Grid>
        <Grid item>
          {canWrite(!!secretsOnly) && (
            <Button color="primary" variant="contained" onClick={() => setEditing({ isSecret: !!secretsOnly })}>
              Add {secretsOnly ? 'secret' : 'value'}
            </Button>
          )}
        </Grid>
      </Grid>

      {config.loading && !config.value && <Progress />}
      {config.error && <ResponseErrorPanel error={config.error} />}
      <Table size="small" style={{ marginTop: 16 }}>
        <TableHead>
          <TableRow>
            <TableCell>Key</TableCell>
            <TableCell>Value</TableCell>
            <TableCell>Secret</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {entries.map(entry => (
            <TableRow key={entry.id}>
              <TableCell style={{ fontFamily: 'monospace' }}>{entry.key}</TableCell>
              <TableCell style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {entry.isSecret ? revealed[entry.id] ?? '********' : entry.value}
              </TableCell>
              <TableCell>{entry.isSecret ? 'Yes' : 'No'}</TableCell>
              <TableCell align="right" style={{ whiteSpace: 'nowrap' }}>
                {entry.isSecret && can('secret.read') && (
                  <Button size="small" onClick={() => reveal(entry)}>
                    {revealed[entry.id] !== undefined ? 'Hide' : 'Reveal'}
                  </Button>
                )}
                {canWrite(entry.isSecret) && (
                  <>
                    <Button size="small" onClick={() => setEditing({ entry, isSecret: entry.isSecret })}>
                      Edit
                    </Button>
                    <Button
                      size="small"
                      color="secondary"
                      onClick={async () => {
                        if (
                          confirmAction(`Delete ${entry.key}?`) &&
                          (await run(() => tenantApi.deleteConfig(project.id, entry.id), `${entry.key} deleted`))
                        ) {
                          config.reload();
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
          {config.value && !entries.length && (
            <TableRow>
              <TableCell colSpan={4}>
                <Typography variant="body2" color="textSecondary">
                  Nothing configured for this environment yet.
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {editing && (
        <ConfigDialog
          editing={editing}
          canCreateSecret={can('secret.write')}
          onClose={() => setEditing(undefined)}
          onSave={save}
        />
      )}
    </InfoCard>
  );
}
