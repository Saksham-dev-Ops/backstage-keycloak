import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import { tokens } from '../../utils/tokens';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
  },
  base: {
    height: 36,
    padding: '0 18px',
    fontSize: 14,
    fontWeight: 500,
    textTransform: 'none',
    borderRadius: 6,
  },
  cancel: { color: tokens.text },
  back: {
    border: `1px solid ${tokens.primary}`,
    color: tokens.primary,
    '&.Mui-disabled': { borderColor: tokens.border, color: tokens.inputBorder },
  },
  primary: {
    background: tokens.primary,
    color: '#fff',
    boxShadow: 'none',
    '&:hover': { background: tokens.primaryHover, boxShadow: 'none' },
    '&.Mui-disabled': { background: '#E3E5E8', color: tokens.textMuted },
  },
});

/** Cancel · Back · primary action, right-aligned under every step. */
export function WizardFooter(props: {
  primaryLabel: string;
  primaryDisabled?: boolean;
  busy?: boolean;
  backDisabled?: boolean;
  onCancel: () => void;
  onBack: () => void;
  onPrimary: () => void;
}) {
  const classes = useStyles();
  return (
    <div className={classes.root}>
      <Button
        className={`${classes.base} ${classes.cancel}`}
        onClick={props.onCancel}
        disabled={props.busy}
      >
        Cancel
      </Button>
      <Button
        variant="outlined"
        className={`${classes.base} ${classes.back}`}
        onClick={props.onBack}
        disabled={props.backDisabled || props.busy}
      >
        Back
      </Button>
      <Button
        variant="contained"
        className={`${classes.base} ${classes.primary}`}
        onClick={props.onPrimary}
        disabled={props.primaryDisabled || props.busy}
      >
        {props.busy ? 'Please wait…' : props.primaryLabel}
      </Button>
    </div>
  );
}
