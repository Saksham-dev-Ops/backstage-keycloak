import { Link, sidebarConfig, useSidebarOpenState } from '@backstage/core-components';
import { makeStyles } from '@material-ui/core';
import { RoleBrand } from './types';

const useStyles = makeStyles({
  root: {
    width: sidebarConfig.drawerWidthClosed,
    height: 3 * sidebarConfig.logoHeight,
    display: 'flex',
    alignItems: 'center',
    marginBottom: -14,
  },
  link: { marginLeft: 20, display: 'flex', alignItems: 'center', gap: 12, whiteSpace: 'nowrap' },
  mark: {
    minWidth: 34,
    height: 34,
    padding: '0 6px',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 15,
  },
  wordmark: { fontSize: 20, fontWeight: 700, color: '#fff' },
});

export function RoleSidebarLogo(props: { brand: RoleBrand }) {
  const classes = useStyles();
  const { isOpen } = useSidebarOpenState();
  const { brand } = props;
  return (
    <div className={classes.root}>
      <Link to="/" underline="none" className={classes.link} aria-label="Home">
        <span className={classes.mark} style={{ background: brand.markColor, color: brand.markTextColor }}>
          {brand.mark}
        </span>
        {isOpen && <span className={classes.wordmark}>{brand.wordmark}</span>}
      </Link>
    </div>
  );
}
