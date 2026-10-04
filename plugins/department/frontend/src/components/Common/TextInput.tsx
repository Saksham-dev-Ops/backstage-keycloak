import { makeStyles } from '@material-ui/core/styles';
import TextField, { TextFieldProps } from '@material-ui/core/TextField';
import { tokens } from '../../utils/tokens';

const useStyles = makeStyles({
  root: {
    '& .MuiOutlinedInput-root': { borderRadius: tokens.radiusSm, fontSize: 14 },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: tokens.inputBorder },
    '& .MuiInputLabel-root': { fontSize: 14 },
  },
});

/** Outlined form field of the console. */
export function TextInput(props: TextFieldProps) {
  const classes = useStyles();
  return (
    <TextField
      variant="outlined"
      size="small"
      fullWidth
      InputLabelProps={{ shrink: true }}
      {...props}
      className={`${classes.root} ${props.className ?? ''}`}
    />
  );
}
