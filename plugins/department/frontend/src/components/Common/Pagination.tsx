import { makeStyles } from '@material-ui/core/styles';
import ButtonBase from '@material-ui/core/ButtonBase';
import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import KeyboardArrowDownIcon from '@material-ui/icons/KeyboardArrowDown';
import { tokens } from '../../utils/tokens';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    padding: '20px 4px 8px',
    fontSize: 13,
    color: tokens.textMuted,
  },
  pages: { display: 'flex', alignItems: 'center', gap: 4 },
  arrow: {
    width: 28,
    height: 28,
    borderRadius: tokens.radiusSm,
    color: tokens.primary,
    '&.Mui-disabled': { color: tokens.inputBorder },
  },
  page: {
    minWidth: 24,
    height: 28,
    padding: '0 6px',
    borderRadius: tokens.radiusSm,
    fontSize: 13,
    color: tokens.textMuted,
    border: '1px solid transparent',
    '&:hover': { background: tokens.surfaceMuted },
  },
  current: { border: `1px solid ${tokens.text}`, color: tokens.text, fontWeight: 600 },
  ellipsis: { padding: '0 4px' },
  showing: { display: 'flex', alignItems: 'center', gap: 10, marginLeft: 24 },
  size: {
    height: 32,
    fontSize: 13,
    '& .MuiOutlinedInput-notchedOutline': { borderColor: tokens.inputBorder },
    '& .MuiSelect-select': { paddingLeft: 12, paddingRight: 30 },
    '& .MuiSelect-icon': { fontSize: 16, top: 'calc(50% - 8px)', right: 8 },
  },
  total: {
    marginLeft: 'auto',
    marginRight: '30%',
    [theme.breakpoints.down('sm')]: { marginRight: 0 },
  },
}));

export const PAGE_SIZES = [10, 20, 50, 100];

/** Page numbers to show around the current page, with gaps as `null`. */
export function pageWindow(page: number, pageCount: number): Array<number | null> {
  if (pageCount <= 5) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  if (page <= 3) [2, 3].forEach(p => pages.add(p));
  if (page >= pageCount - 2) [pageCount - 1, pageCount - 2].forEach(p => pages.add(p));
  const sorted = [...pages].filter(p => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const result: Array<number | null> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push(null);
    result.push(p);
  });
  return result;
}

export function Pagination(props: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const classes = useStyles();
  const pageCount = Math.max(1, Math.ceil(props.total / props.pageSize));
  return (
    <nav className={classes.root} aria-label="Pagination">
      <div className={classes.pages}>
        <ButtonBase
          className={classes.arrow}
          disabled={props.page <= 1}
          onClick={() => props.onPageChange(props.page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeftIcon fontSize="small" />
        </ButtonBase>
        {pageWindow(props.page, pageCount).map((p, i) =>
          p === null ? (
            <span key={`gap-${i}`} className={classes.ellipsis}>
              …
            </span>
          ) : (
            <ButtonBase
              key={p}
              className={`${classes.page} ${p === props.page ? classes.current : ''}`}
              onClick={() => props.onPageChange(p)}
              aria-label={`Page ${p}`}
              aria-current={p === props.page ? 'page' : undefined}
            >
              {p}
            </ButtonBase>
          ),
        )}
        <ButtonBase
          className={classes.arrow}
          disabled={props.page >= pageCount}
          onClick={() => props.onPageChange(props.page + 1)}
          aria-label="Next page"
        >
          <ChevronRightIcon fontSize="small" />
        </ButtonBase>
      </div>
      <div className={classes.showing}>
        <span>Showing</span>
        <Select
          variant="outlined"
          value={props.pageSize}
          onChange={e => props.onPageSizeChange(Number(e.target.value))}
          IconComponent={KeyboardArrowDownIcon}
          className={classes.size}
          inputProps={{ 'aria-label': 'Rows per page' }}
        >
          {PAGE_SIZES.map(size => (
            <MenuItem key={size} value={size}>
              {size}
            </MenuItem>
          ))}
        </Select>
      </div>
      <span className={classes.total}>of {props.total.toLocaleString()} items</span>
    </nav>
  );
}
