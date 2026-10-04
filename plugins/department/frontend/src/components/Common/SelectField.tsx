import { makeStyles } from '@material-ui/core/styles';
import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';
import KeyboardArrowDownIcon from '@material-ui/icons/KeyboardArrowDown';
import { tokens } from '../../utils/tokens';

const useStyles = makeStyles({
  root: {
    minWidth: 176,
    height: 40,
    fontSize: 14,
    color: tokens.textBody,
    background: tokens.surface,
    borderRadius: tokens.radiusSm,
    '& .MuiOutlinedInput-notchedOutline': { borderColor: tokens.inputBorder },
    '& .MuiSelect-select': { paddingLeft: 12, paddingRight: 36 },
    '& .MuiSelect-icon': { right: 10, color: tokens.textBody, fontSize: 18, top: 'calc(50% - 9px)' },
  },
  placeholder: { color: tokens.textBody },
  menuItem: { fontSize: 14 },
});

export type SelectOption = { value: string; label: string };

/** The filter dropdown of the design: placeholder label, chevron, no floating label. */
export function SelectField(props: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** Label of the "any" option */
  allLabel?: string;
  className?: string;
}) {
  const classes = useStyles();
  return (
    <Select
      variant="outlined"
      displayEmpty
      value={props.value}
      onChange={e => props.onChange(e.target.value as string)}
      IconComponent={KeyboardArrowDownIcon}
      className={`${classes.root} ${props.className ?? ''}`}
      inputProps={{ 'aria-label': props.label }}
      renderValue={value =>
        value ? (
          props.options.find(o => o.value === value)?.label ?? props.label
        ) : (
          <span className={classes.placeholder}>{props.label}</span>
        )
      }
      MenuProps={{ getContentAnchorEl: null, anchorOrigin: { vertical: 'bottom', horizontal: 'left' } }}
    >
      <MenuItem value="" className={classes.menuItem}>
        {props.allLabel ?? `All`}
      </MenuItem>
      {props.options.map(option => (
        <MenuItem key={option.value} value={option.value} className={classes.menuItem}>
          {option.label}
        </MenuItem>
      ))}
    </Select>
  );
}
