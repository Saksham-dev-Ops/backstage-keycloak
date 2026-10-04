import { Fragment } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import ButtonBase from '@material-ui/core/ButtonBase';
import CheckIcon from '@material-ui/icons/Check';
import { tokens } from '../../utils/tokens';

const DONE = '#1E8E3E';
const TODO = '#C9CDD4';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    margin: '4px 0 28px',
    listStyle: 'none',
    padding: 0,
  },
  step: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    width: 110,
    textAlign: 'center',
    [theme.breakpoints.down('xs')]: { width: 80 },
  },
  button: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    borderRadius: 4,
  },
  circle: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    boxSizing: 'border-box',
  },
  done: { background: DONE, color: '#fff', '& svg': { fontSize: 13 } },
  current: { border: `5px solid ${tokens.primary}`, background: '#fff' },
  upcoming: {
    border: `1px solid ${TODO}`,
    color: tokens.textMuted,
    background: '#fff',
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: tokens.textBody,
    lineHeight: 1.3,
  },
  labelUpcoming: { color: tokens.textMuted, fontWeight: 500 },
  line: {
    flex: '0 1 130px',
    height: 2,
    marginTop: 8,
    background: TODO,
    [theme.breakpoints.down('xs')]: { flexBasis: 30 },
  },
  lineDone: { background: DONE },
}));

function stepState(
  index: number,
  active: number,
): 'done' | 'current' | 'upcoming' {
  if (index < active) return 'done';
  return index === active ? 'current' : 'upcoming';
}

/**
 * "Department Details — Department Admin — Review". Completed steps are
 * green and can be revisited; the current step is a blue ring.
 */
export function Stepper(props: {
  steps: readonly string[];
  active: number;
  onSelect: (index: number) => void;
}) {
  const classes = useStyles();
  return (
    <ol className={classes.root} aria-label="Progress">
      {props.steps.map((label, i) => {
        const state = stepState(i, props.active);
        const circle = (
          <span
            className={`${classes.circle} ${classes[state]}`}
            aria-hidden="true"
          >
            {state === 'done' && <CheckIcon />}
            {state === 'upcoming' && i + 1}
          </span>
        );
        const text = (
          <span
            className={`${classes.label} ${
              state === 'upcoming' ? classes.labelUpcoming : ''
            }`}
          >
            {label}
          </span>
        );
        return (
          <Fragment key={label}>
            {i > 0 && (
              <li
                aria-hidden="true"
                className={`${classes.line} ${
                  i <= props.active ? classes.lineDone : ''
                }`}
              />
            )}
            <li
              className={classes.step}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              {state === 'done' ? (
                <ButtonBase
                  className={classes.button}
                  onClick={() => props.onSelect(i)}
                  aria-label={`${label} (completed), go back to this step`}
                >
                  {circle}
                  {text}
                </ButtonBase>
              ) : (
                <>
                  {circle}
                  {text}
                </>
              )}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
