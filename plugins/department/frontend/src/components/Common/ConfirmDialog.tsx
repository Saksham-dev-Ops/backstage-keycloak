import { ReactNode, useState } from 'react';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import Typography from '@material-ui/core/Typography';
import { tokens } from '../../utils/tokens';

/** Confirms a destructive action; shows the API error if it fails. */
export function ConfirmDialog(props: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const confirm = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await props.onConfirm();
      props.onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={props.open} onClose={busy ? undefined : props.onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{props.title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" component="div">
          {props.body}
        </Typography>
        {error && (
          <Typography role="alert" variant="body2" style={{ color: tokens.danger, marginTop: 12 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          onClick={confirm}
          disabled={busy}
          variant="contained"
          style={{ background: tokens.danger, color: '#fff' }}
        >
          {busy ? 'Working...' : props.confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
