import { Fragment, ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import HomeOutlinedIcon from '@material-ui/icons/HomeOutlined';
import { tokens } from '../../utils/tokens';

export type Crumb = { label: string; to?: string; icon?: ReactNode };

const useStyles = makeStyles(theme => ({
  bar: {
    height: 50,
    display: 'flex',
    alignItems: 'center',
    padding: '0 40px',
    background: tokens.surfaceMuted,
    borderBottom: `1px solid ${tokens.border}`,
    [theme.breakpoints.down('sm')]: { padding: '0 16px 0 64px' },
  },
  list: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    margin: 0,
    padding: 0,
    listStyle: 'none',
    fontSize: 16,
    minWidth: 0,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
    whiteSpace: 'nowrap',
  },
  link: {
    color: tokens.textBody,
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    '&:hover': { color: tokens.primary },
  },
  current: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: tokens.primary,
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  home: { fontSize: 16 },
  icon: { display: 'flex', '& svg': { fontSize: 16 } },
  plain: { color: tokens.textBody, fontWeight: 400 },
  separator: { fontSize: 16, color: tokens.textBody },
}));

/**
 * "⌂ Admin console › Departments ›" on list pages; with `variant="section"`,
 * "⊞ Departments › Add Department" as on the onboarding screens.
 */
export function Breadcrumbs(props: {
  items: Crumb[];
  variant?: 'console' | 'section';
}) {
  const classes = useStyles();
  const section = props.variant === 'section';
  return (
    <nav className={classes.bar} aria-label="Breadcrumb">
      <ol className={classes.list}>
        {!section && (
          <li className={classes.item}>
            <RouterLink to="/admin/departments" className={classes.link}>
              <HomeOutlinedIcon className={classes.home} />
              Admin console
            </RouterLink>
          </li>
        )}
        {props.items.map((item, i) => {
          const label = (
            <>
              {item.icon && (
                <span className={classes.icon} aria-hidden="true">
                  {item.icon}
                </span>
              )}
              {item.label}
            </>
          );
          return (
            <Fragment key={item.label}>
              {(i > 0 || !section) && (
                <ChevronRightIcon
                  className={classes.separator}
                  aria-hidden="true"
                />
              )}
              <li className={classes.item}>
                {item.to && i < props.items.length - 1 ? (
                  <RouterLink to={item.to} className={classes.link}>
                    {label}
                  </RouterLink>
                ) : (
                  <span
                    className={`${classes.current} ${
                      section ? classes.plain : ''
                    }`}
                    aria-current="page"
                  >
                    {label}
                  </span>
                )}
              </li>
            </Fragment>
          );
        })}
        {!section && (
          <ChevronRightIcon className={classes.separator} aria-hidden="true" />
        )}
      </ol>
    </nav>
  );
}
