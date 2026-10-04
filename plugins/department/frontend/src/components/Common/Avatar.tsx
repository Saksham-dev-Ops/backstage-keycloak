import { makeStyles } from '@material-ui/core/styles';
import { initials } from '../../utils/format';
import { tokens } from '../../utils/tokens';

const useStyles = makeStyles({
  avatar: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    background: '#EEF2FB',
    color: tokens.primary,
    fontWeight: 500,
    flex: '0 0 auto',
  },
});

export function Avatar(props: { name: string; size?: number }) {
  const classes = useStyles();
  const size = props.size ?? 30;
  return (
    <span
      className={classes.avatar}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.37) }}
      aria-hidden="true"
    >
      {initials(props.name)}
    </span>
  );
}
