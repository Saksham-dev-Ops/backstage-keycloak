import { useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Badge from '@material-ui/core/Badge';
import Button from '@material-ui/core/Button';
import InputAdornment from '@material-ui/core/InputAdornment';
import OutlinedInput from '@material-ui/core/OutlinedInput';
import Popover from '@material-ui/core/Popover';
import Typography from '@material-ui/core/Typography';
import AddIcon from '@material-ui/icons/Add';
import SearchIcon from '@material-ui/icons/Search';
import { DEPARTMENT_STATUSES, DepartmentStatus, Ministry } from '../../types';
import { STATUS_LABELS } from '../../utils/format';
import { tokens } from '../../utils/tokens';
import { SelectField } from '../Common';

export type DepartmentFilterValues = {
  ministryId: string;
  search: string;
  status: '' | DepartmentStatus;
  admin: string;
};

export const EMPTY_FILTERS: DepartmentFilterValues = {
  ministryId: '',
  search: '',
  status: '',
  admin: '',
};

const useStyles = makeStyles({
  root: { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  search: {
    width: 176,
    height: 40,
    fontSize: 14,
    background: tokens.surface,
    borderRadius: tokens.radiusSm,
    '& .MuiOutlinedInput-notchedOutline': { borderColor: tokens.inputBorder },
    '& input': { padding: '0 0 0 12px', height: 40 },
    '& input::placeholder': { color: tokens.textBody, opacity: 1 },
  },
  searchIcon: { fontSize: 18, color: tokens.textBody },
  more: {
    height: 40,
    padding: '0 18px',
    fontSize: 16,
    fontWeight: 500,
    borderRadius: tokens.radiusSm,
    color: tokens.primary,
    borderColor: tokens.primary,
    textTransform: 'none',
  },
  popover: { padding: 16, width: 280, display: 'flex', flexDirection: 'column', gap: 10 },
  popoverTitle: { fontSize: 13, fontWeight: 600, color: tokens.text },
  popoverInput: {
    height: 40,
    fontSize: 14,
    '& .MuiOutlinedInput-notchedOutline': { borderColor: tokens.inputBorder },
    '& input': { padding: '0 12px', height: 40 },
  },
  popoverActions: { display: 'flex', justifyContent: 'flex-end' },
});

/** Ministry, Department and Status filters, plus "More" for the admin filter. */
export function DepartmentFilters(props: {
  ministries: Ministry[];
  values: DepartmentFilterValues;
  onChange: (values: DepartmentFilterValues) => void;
}) {
  const classes = useStyles();
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);
  const { values, onChange } = props;
  const set = (changes: Partial<DepartmentFilterValues>) => onChange({ ...values, ...changes });

  return (
    <div className={classes.root} role="search" aria-label="Filter departments">
      <SelectField
        label="Ministry"
        allLabel="All ministries"
        value={values.ministryId}
        onChange={ministryId => set({ ministryId })}
        options={[
          ...props.ministries.map(m => ({ value: m.id, label: m.name })),
          { value: 'unassigned', label: 'No ministry' },
        ]}
      />
      <OutlinedInput
        className={classes.search}
        placeholder="Department"
        value={values.search}
        onChange={e => set({ search: e.target.value })}
        inputProps={{ 'aria-label': 'Search departments' }}
        endAdornment={
          <InputAdornment position="end">
            <SearchIcon className={classes.searchIcon} />
          </InputAdornment>
        }
      />
      <SelectField
        label="Status"
        allLabel="All statuses"
        value={values.status}
        onChange={status => set({ status: status as DepartmentFilterValues['status'] })}
        options={DEPARTMENT_STATUSES.map(s => ({ value: s, label: STATUS_LABELS[s] }))}
      />
      <Badge color="primary" variant="dot" invisible={!values.admin} overlap="rectangular">
        <Button
          variant="outlined"
          className={classes.more}
          startIcon={<AddIcon />}
          onClick={e => setMoreAnchor(e.currentTarget)}
          aria-haspopup="dialog"
        >
          More
        </Button>
      </Badge>
      <Popover
        open={!!moreAnchor}
        anchorEl={moreAnchor}
        onClose={() => setMoreAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: -8, horizontal: 'left' }}
      >
        <div className={classes.popover}>
          <Typography className={classes.popoverTitle}>Admin</Typography>
          <OutlinedInput
            className={classes.popoverInput}
            placeholder="Admin name or email"
            value={values.admin}
            onChange={e => set({ admin: e.target.value })}
            inputProps={{ 'aria-label': 'Filter by admin' }}
          />
          <div className={classes.popoverActions}>
            <Button size="small" onClick={() => onChange(EMPTY_FILTERS)}>
              Clear all filters
            </Button>
          </div>
        </div>
      </Popover>
    </div>
  );
}
