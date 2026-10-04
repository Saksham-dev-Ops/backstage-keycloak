import { useState } from 'react';
import { configApiRef, useApi } from '@backstage/core-plugin-api';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import Typography from '@material-ui/core/Typography';
import CheckIcon from '@material-ui/icons/Check';
import FileCopyOutlinedIcon from '@material-ui/icons/FileCopyOutlined';
import { AdminInvite } from '../../types';
import { formatDate } from '../../utils/format';
import { tokens } from '../../utils/tokens';
import { Avatar } from '../Common';

const useStyles = makeStyles({
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 0',
    borderBottom: `1px solid ${tokens.border}`,
    '&:last-child': { borderBottom: 'none' },
  },
  who: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, color: tokens.text, fontWeight: 500 },
  email: {
    fontSize: 12,
    color: tokens.textMuted,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  copy: { textTransform: 'none', flex: '0 0 auto' },
  note: { fontSize: 13, color: tokens.textBody, marginBottom: 8 },
});

/** The URL an invited user opens to set their password. */
export function useInviteUrl() {
  const configApi = useApi(configApiRef);
  const base = configApi.getString('app.baseUrl').replace(/\/$/, '');
  // The token is in the fragment, so it is never sent to any server
  return (invite: AdminInvite) => `${base}/invite#${invite.token}`;
}

async function copy(text: string) {
  await navigator.clipboard.writeText(text);
}

/**
 * Shown once after a department is added (and when a link is regenerated):
 * the one-time links for new admins to set their password.
 */
export function InviteLinksDialog(props: {
  open: boolean;
  title: string;
  invites: AdminInvite[];
  /** Admins who already had an account and can sign in right away */
  existingAccounts?: number;
  onClose: () => void;
}) {
  const classes = useStyles();
  const inviteUrl = useInviteUrl();
  const [copied, setCopied] = useState<string>();
  const expires = props.invites[0]?.expiresAt;

  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{props.title}</DialogTitle>
      <DialogContent>
        {props.invites.length > 0 ? (
          <>
            <Typography className={classes.note}>
              Send each admin their invite link so they can set a password and
              sign in. Links work once
              {expires ? ` and expire on ${formatDate(expires)}` : ''}. They are
              only shown now.
            </Typography>
            {props.invites.map(invite => (
              <div key={invite.userId} className={classes.row}>
                <Avatar name={invite.name} />
                <div className={classes.who}>
                  <div className={classes.name}>{invite.name}</div>
                  <div className={classes.email}>{invite.email}</div>
                </div>
                <Button
                  size="small"
                  variant="outlined"
                  color="primary"
                  className={classes.copy}
                  startIcon={
                    copied === invite.userId ? (
                      <CheckIcon />
                    ) : (
                      <FileCopyOutlinedIcon />
                    )
                  }
                  onClick={async () => {
                    await copy(inviteUrl(invite));
                    setCopied(invite.userId);
                  }}
                  aria-label={`Copy invite link for ${invite.name}`}
                >
                  {copied === invite.userId ? 'Copied' : 'Copy invite link'}
                </Button>
              </div>
            ))}
          </>
        ) : (
          <Typography className={classes.note}>
            All admins can sign in with Keycloak using their official email.
          </Typography>
        )}
        {!!props.existingAccounts && props.invites.length > 0 && (
          <Typography className={classes.note}>
            {props.existingAccounts} admin
            {props.existingAccounts > 1 ? 's' : ''} already had an account and
            can sign in right away.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button color="primary" variant="contained" onClick={props.onClose}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}
