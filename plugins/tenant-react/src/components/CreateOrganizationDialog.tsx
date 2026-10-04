import { useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import { CreateTenantResponse, tenantApiRef } from '../api';
import { useTenant } from '../useTenant';
import { slugify, useAction } from './shared';

/**
 * Platform admins create an organization together with its OWNER. The owner
 * signs in with Keycloak using the same email.
 */
export function CreateOrganizationDialog(props: { open: boolean; onClose: () => void }) {
  const tenantApi = useApi(tenantApiRef);
  const { reload, user } = useTenant();
  const run = useAction();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [created, setCreated] = useState<CreateTenantResponse>();

  const close = () => {
    setName('');
    setSlug('');
    setOwnerEmail('');
    setOwnerName('');
    setCreated(undefined);
    props.onClose();
  };

  const submit = async () => {
    let result: CreateTenantResponse | undefined;
    const ok = await run(async () => {
      result = await tenantApi.createTenant({
        name: name.trim(),
        slug: slug || slugify(name),
        ownerEmail: ownerEmail.trim() || undefined,
        ownerName: ownerName.trim() || undefined,
      });
    }, `Organization '${name}' created`);
    if (ok && result) {
      setCreated(result);
      // The creator appears in the switcher if they are the owner
      reload();
    }
  };

  if (created) {
    const signInUrl = window.location.origin;
    return (
      <Dialog open={props.open} onClose={close} fullWidth maxWidth="sm">
        <DialogTitle>Organization created</DialogTitle>
        <DialogContent>
          <Typography paragraph>
            <strong>{created.tenant.name}</strong> ({created.tenant.slug}) is ready.
            Its owner is <strong>{created.owner.email}</strong>.
          </Typography>
          {created.owner.accountCreated ? (
            <Typography paragraph>
              A new account was created. The owner signs in at {signInUrl} with
              Keycloak, using a Keycloak account with the email {created.owner.email}.
            </Typography>
          ) : (
            <Typography paragraph>
              The owner already had an account. The organization now appears in
              their organization switcher.
            </Typography>
          )}
          <Typography variant="body2" color="textSecondary">
            The owner can add members and projects from the Projects page.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button color="primary" variant="contained" onClick={close}>
            Done
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  const ownerIsSomeoneElse = !!ownerEmail.trim() && ownerEmail.trim().toLowerCase() !== user?.email;

  return (
    <Dialog open={props.open} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>New organization</DialogTitle>
      <DialogContent>
        <TextField label="Organization name" value={name} onChange={e => setName(e.target.value)} fullWidth margin="dense" required />
        <TextField
          label="Slug"
          value={slug}
          placeholder={slugify(name)}
          onChange={e => setSlug(e.target.value)}
          helperText="Unique ID, lowercase letters, digits and dashes"
          fullWidth
          margin="dense"
        />
        <Typography variant="subtitle2" style={{ marginTop: 16 }}>
          Owner
        </Typography>
        <TextField
          label="Owner email"
          type="email"
          value={ownerEmail}
          onChange={e => setOwnerEmail(e.target.value)}
          helperText="Leave empty to be the owner yourself"
          fullWidth
          margin="dense"
        />
        {ownerIsSomeoneElse && (
          <TextField label="Owner name" value={ownerName} onChange={e => setOwnerName(e.target.value)} fullWidth margin="dense" />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Cancel</Button>
        <Button color="primary" variant="contained" onClick={submit} disabled={!name.trim()}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
