import {
  Sidebar,
  SidebarDivider,
  SidebarGroup,
  SidebarItem,
  SidebarScrollWrapper,
  SidebarSpace,
} from '@backstage/core-components';
import { NotificationsSidebarItem } from '@backstage/plugin-notifications';
import { SidebarSearchModal } from '@backstage/plugin-search';
import { UserSettingsSignInAvatar } from '@backstage/plugin-user-settings';
import BusinessIcon from '@material-ui/icons/Business';
import DashboardIcon from '@material-ui/icons/Dashboard';
import ExtensionIcon from '@material-ui/icons/Extension';
import FolderIcon from '@material-ui/icons/FolderOpen';
import HistoryIcon from '@material-ui/icons/History';
import MenuIcon from '@material-ui/icons/Menu';
import PeopleIcon from '@material-ui/icons/People';
import SearchIcon from '@material-ui/icons/Search';
import {
  RoleNav,
  RoleSidebarLogo,
  TenantSwitcher,
  useTenant,
} from '@internal/backstage-plugin-tenant-react';
import { organizationBrand } from './brand';

export function OrganizationSidebar(props: { nav: RoleNav }) {
  const { nav } = props;
  const { can, isPluginEnabled } = useTenant();
  nav.take('page:organization');
  nav.take('page:platform-admin');
  nav.take('page:my-work');
  nav.take('page:search');
  nav.take('page:notifications');

  return (
    <Sidebar>
      <RoleSidebarLogo brand={organizationBrand} />
      <TenantSwitcher />
      <SidebarDivider />
      {isPluginEnabled('search') && (
        <>
          <SidebarGroup label="Search" icon={<SearchIcon />} to="/search">
            <SidebarSearchModal />
          </SidebarGroup>
          <SidebarDivider />
        </>
      )}
      <SidebarGroup label="Organization" icon={<BusinessIcon />}>
        <SidebarItem icon={DashboardIcon} to="/org" text="Dashboard" />
        <SidebarItem icon={FolderIcon} to="/org/projects" text="Projects" />
        <SidebarItem icon={PeopleIcon} to="/org/members" text="Members" />
        <SidebarItem icon={ExtensionIcon} to="/org/plugins" text="Plugins" />
        {can('audit.read') && <SidebarItem icon={HistoryIcon} to="/org/audit" text="Audit log" />}
      </SidebarGroup>
      <SidebarDivider />
      <SidebarGroup label="Tools" icon={<MenuIcon />}>
        {nav.take('page:catalog')}
        {nav.take('page:scaffolder')}
        <SidebarScrollWrapper>{nav.rest({ sortBy: 'title' })}</SidebarScrollWrapper>
      </SidebarGroup>
      <SidebarSpace />
      <SidebarDivider />
      {isPluginEnabled('notifications') && (
        <>
          <NotificationsSidebarItem />
          <SidebarDivider />
        </>
      )}
      <SidebarGroup label="Settings" icon={<UserSettingsSignInAvatar />} to="/settings">
        {nav.take('page:user-settings')}
      </SidebarGroup>
    </Sidebar>
  );
}
