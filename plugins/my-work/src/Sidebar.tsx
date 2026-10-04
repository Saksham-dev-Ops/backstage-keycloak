import { Sidebar, SidebarDivider, SidebarGroup, SidebarItem, SidebarSpace } from '@backstage/core-components';
import { UserSettingsSignInAvatar } from '@backstage/plugin-user-settings';
import FolderIcon from '@material-ui/icons/FolderOpen';
import StarIcon from '@material-ui/icons/Star';
import { RoleNav, RoleSidebarLogo, TenantSwitcher } from '@internal/backstage-plugin-tenant-react';
import { userBrand } from './brand';

/** Users only get their projects and their settings. */
export function UserSidebar(props: { nav: RoleNav }) {
  return (
    <Sidebar>
      <RoleSidebarLogo brand={userBrand} />
      <TenantSwitcher />
      <SidebarDivider />
      <SidebarGroup label="My work" icon={<StarIcon />}>
        <SidebarItem icon={FolderIcon} to="/me" text="My projects" />
      </SidebarGroup>
      <SidebarSpace />
      <SidebarDivider />
      <SidebarGroup label="Settings" icon={<UserSettingsSignInAvatar />} to="/settings">
        {props.nav.take('page:user-settings')}
      </SidebarGroup>
    </Sidebar>
  );
}
