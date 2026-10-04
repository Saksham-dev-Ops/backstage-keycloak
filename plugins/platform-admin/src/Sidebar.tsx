import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { identityApiRef, useApi } from '@backstage/core-plugin-api';
import { makeStyles, Theme } from '@material-ui/core/styles';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import ButtonBase from '@material-ui/core/ButtonBase';
import Drawer from '@material-ui/core/Drawer';
import IconButton from '@material-ui/core/IconButton';
import AccountBalanceOutlinedIcon from '@material-ui/icons/AccountBalanceOutlined';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';
import HistoryIcon from '@material-ui/icons/History';
import MenuIcon from '@material-ui/icons/Menu';
import PeopleOutlineIcon from '@material-ui/icons/PeopleOutline';
import SettingsOutlinedIcon from '@material-ui/icons/SettingsOutlined';
import {
  BrandMark,
  consoleTokens as t,
  GridIcon,
  RoleNav,
  useTenant,
} from '@internal/backstage-plugin-tenant-react';

const useStyles = makeStyles({
  sidebar: {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    width: t.sidebarWidth,
    zIndex: 1200,
    background: '#FAFAFB',
    borderRight: `1px solid ${t.border}`,
    display: 'flex',
    flexDirection: 'column',
    padding: '12px 20px 20px',
    fontFamily: t.fontFamily,
    overflowY: 'auto',
  },
  drawerPaper: { width: t.sidebarWidth, position: 'relative', height: '100%' },
  badge: {
    alignSelf: 'flex-start',
    background: t.successSoft,
    color: t.success,
    fontSize: 12,
    lineHeight: '20px',
    padding: '0 8px',
    borderRadius: t.radiusSm,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    margin: '6px 0 26px',
    textDecoration: 'none',
  },
  wordmark: { display: 'flex', flexDirection: 'column', marginLeft: 2 },
  word: { fontSize: 30, letterSpacing: -1, lineHeight: 1, color: '#1A2B5F', fontWeight: 500 },
  wordAccent: { color: t.primary },
  tagline: { fontSize: 7.5, color: '#1A2B5F', marginTop: 3, whiteSpace: 'nowrap' },
  section: { fontSize: 13, fontWeight: 600, color: t.textMuted, margin: '0 0 14px' },
  list: { listStyle: 'none', margin: '0 0 28px', padding: 0, display: 'flex', flexDirection: 'column', gap: 4 },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    height: 38,
    padding: '0 12px',
    borderRadius: 6,
    border: '1px solid transparent',
    color: t.textBody,
    fontSize: 15,
    fontFamily: t.fontFamily,
    textDecoration: 'none',
    justifyContent: 'flex-start',
    '& svg': { fontSize: 16 },
    '&:hover': { background: t.primarySoft },
  },
  active: {
    border: `1px solid ${t.primary}`,
    background: t.primarySoft,
    color: t.primary,
  },
  spacer: { flex: 1 },
  user: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: t.surface,
    borderRadius: 8,
    padding: '14px 16px',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: '#EEF2FB',
    color: t.primary,
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 40px',
  },
  userName: { fontSize: 16, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  userRole: { fontSize: 14, color: t.textMuted },
  menuButton: {
    position: 'fixed',
    top: 5,
    left: 8,
    zIndex: 1100,
    color: t.text,
  },
});

const PLATFORM_ITEMS = [
  { to: '/admin/departments', label: 'Departments', icon: <GridIcon /> },
  { to: '/admin/ministries', label: 'Ministries', icon: <AccountBalanceOutlinedIcon /> },
  { to: '/admin/users', label: 'Platform Admins', icon: <PeopleOutlineIcon /> },
  { to: '/admin/audit', label: 'Audit log', icon: <HistoryIcon /> },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function SidebarContent(props: { onNavigate?: () => void }) {
  const classes = useStyles();
  const identityApi = useApi(identityApiRef);
  const { user } = useTenant();
  const link = ({ isActive }: { isActive: boolean }) =>
    `${classes.item} ${isActive ? classes.active : ''}`;

  return (
    <>
      <span className={classes.badge}>Platform Admin</span>
      <NavLink to="/admin/departments" className={classes.brand} aria-label="OpenForge home">
        <BrandMark size={54} />
        <span className={classes.wordmark}>
          <span className={classes.word}>
            Open<span className={classes.wordAccent}>Forge</span>
          </span>
          <span className={classes.tagline}>Your Gateway to Collaborative Governance</span>
        </span>
      </NavLink>

      <nav aria-label="Platform setup">
        <p className={classes.section}>Platform setup</p>
        <ul className={classes.list}>
          {PLATFORM_ITEMS.map(item => (
            <li key={item.to}>
              <NavLink to={item.to} className={link} onClick={props.onNavigate}>
                {item.icon}
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <nav aria-label="Account">
        <p className={classes.section}>Account</p>
        <ul className={classes.list}>
          <li>
            <NavLink to="/settings" className={link} onClick={props.onNavigate}>
              <SettingsOutlinedIcon />
              Settings
            </NavLink>
          </li>
          <li>
            <ButtonBase className={classes.item} onClick={() => identityApi.signOut()}>
              <ExitToAppIcon />
              Sign out
            </ButtonBase>
          </li>
        </ul>
      </nav>

      <div className={classes.spacer} />
      {user && (
        <div className={classes.user}>
          <span className={classes.avatar} aria-hidden="true">
            {initials(user.name)}
          </span>
          <span style={{ minWidth: 0 }}>
            <div className={classes.userName}>{user.name}</div>
            <div className={classes.userRole}>Platform Admin</div>
          </span>
        </div>
      )}
    </>
  );
}

/**
 * The admin console sidebar of the design. Replaces the Backstage sidebar for
 * platform admins; the page offset comes from the theme (`theme.ts`).
 */
// The portal's own nav items (`nav`) are not listed for platform admins
export function PlatformAdminSidebar(_props: { nav: RoleNav }) {
  const classes = useStyles();
  const [open, setOpen] = useState(false);

  const isDesktop = useMediaQuery((theme: Theme) => theme.breakpoints.up('md'), { noSsr: true });

  if (isDesktop) {
    return (
      <aside className={classes.sidebar}>
        <SidebarContent />
      </aside>
    );
  }
  return (
    <>
      <IconButton className={classes.menuButton} aria-label="Open navigation" onClick={() => setOpen(true)}>
        <MenuIcon />
      </IconButton>
      <Drawer open={open} onClose={() => setOpen(false)}>
        <aside className={`${classes.sidebar} ${classes.drawerPaper}`}>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </aside>
      </Drawer>
    </>
  );
}
