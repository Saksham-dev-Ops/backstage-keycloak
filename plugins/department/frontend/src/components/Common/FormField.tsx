import { ReactNode } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import InputBase, { InputBaseProps } from '@material-ui/core/InputBase';
import Tooltip from '@material-ui/core/Tooltip';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import { tokens } from '../../utils/tokens';

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 13,
    fontWeight: 500,
    color: tokens.text,
  },
  required: { color: tokens.danger },
  info: { fontSize: 14, color: tokens.textMuted, cursor: 'help' },
  helper: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 12,
    color: tokens.textMuted,
  },
  helperIcon: { fontSize: 13 },
  error: { fontSize: 12, color: tokens.danger },
  input: {
    height: 40,
    fontSize: 14,
    color: tokens.text,
    border: `1px solid ${tokens.inputBorder}`,
    borderRadius: tokens.radiusSm,
    background: tokens.surface,
    padding: '0 12px',
    '&.Mui-focused': {
      borderColor: tokens.primary,
      boxShadow: `0 0 0 1px ${tokens.primary}`,
    },
    '&.Mui-error': { borderColor: tokens.danger },
    '&.Mui-disabled': {
      background: tokens.neutralSoft,
      color: tokens.textBody,
    },
    '& input::placeholder': { color: tokens.textMuted, opacity: 1 },
  },
});

/**
 * A form field of the onboarding designs: "Label * ⓘ" above the control,
 * then a helper line (with ⓘ) or the validation error below it.
 */
export function FormField(props: {
  id: string;
  label: string;
  required?: boolean;
  info?: string;
  helper?: string;
  error?: string;
  children: ReactNode;
}) {
  const classes = useStyles();
  return (
    <div className={classes.root}>
      <label htmlFor={props.id} className={classes.label}>
        {props.label}
        {props.required && (
          <span className={classes.required} aria-hidden="true">
            *
          </span>
        )}
        {props.info && (
          <Tooltip title={props.info}>
            <InfoOutlinedIcon
              className={classes.info}
              aria-label={props.info}
            />
          </Tooltip>
        )}
      </label>
      {props.children}
      {props.error ? (
        <span className={classes.error} id={`${props.id}-error`} role="alert">
          {props.error}
        </span>
      ) : (
        props.helper && (
          <span className={classes.helper} id={`${props.id}-helper`}>
            <InfoOutlinedIcon
              className={classes.helperIcon}
              aria-hidden="true"
            />
            {props.helper}
          </span>
        )
      )}
    </div>
  );
}

/** The 40px bordered input used inside FormField. */
export function FieldInput(
  props: InputBaseProps & { id: string; invalid?: boolean },
) {
  const classes = useStyles();
  const { invalid, id, ...rest } = props;
  return (
    <InputBase
      fullWidth
      {...rest}
      id={id}
      error={invalid}
      className={`${classes.input} ${props.className ?? ''}`}
      inputProps={{
        'aria-invalid': invalid || undefined,
        'aria-describedby': invalid ? `${id}-error` : `${id}-helper`,
        ...rest.inputProps,
      }}
    />
  );
}
