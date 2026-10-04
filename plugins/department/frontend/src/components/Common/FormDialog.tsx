import { FormEvent, ReactNode } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import IconButton from '@material-ui/core/IconButton';
import Typography from '@material-ui/core/Typography';
import CloseIcon from '@material-ui/icons/Close';
import { tokens } from '../../utils/tokens';

const useStyles = makeStyles({
  paper: { borderRadius: 10, width: 560, maxWidth: 'calc(100% - 32px)', margin: 16 },
  title: { padding: '20px 24px 4px', '& h2': { fontSize: 20, fontWeight: 600, color: tokens.text } },
  close: { position: 'absolute', right: 12, top: 12 },
  description: { fontSize: 13, color: tokens.textBody, padding: '0 24px 8px' },
  content: { padding: '12px 24px', display: 'flex', flexDirection: 'column', gap: 16 },
  error: {
    background: tokens.dangerSoft,
    color: tokens.danger,
    borderRadius: tokens.radiusSm,
    padding: '10px 12px',
    fontSize: 13,
  },
  actions: { padding: '12px 24px 20px', gap: 8 },
});

/** The modal used by every form: title, description, fields, error, actions. */
export function FormDialog(props: {
  open: boolean;
  title: string;
  description?: string;
  submitLabel: string;
  submitting: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: () => void;
  children: ReactNode;
}) {
  const classes = useStyles();
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    props.onSubmit();
  };
  return (
    <Dialog
      open={props.open}
      onClose={props.submitting ? undefined : props.onClose}
      classes={{ paper: classes.paper }}
      aria-labelledby="form-dialog-title"
    >
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle id="form-dialog-title" className={classes.title}>
          {props.title}
        </DialogTitle>
        <IconButton
          className={classes.close}
          onClick={props.onClose}
          disabled={props.submitting}
          aria-label="Close"
          size="small"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
        {props.description && (
          <Typography className={classes.description}>{props.description}</Typography>
        )}
        <DialogContent className={classes.content}>
          {props.error && (
            <div className={classes.error} role="alert">
              {props.error}
            </div>
          )}
          {props.children}
        </DialogContent>
        <DialogActions className={classes.actions}>
          <Button onClick={props.onClose} disabled={props.submitting}>
            Cancel
          </Button>
          <Button type="submit" color="primary" variant="contained" disabled={props.submitting}>
            {props.submitting ? 'Saving...' : props.submitLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
