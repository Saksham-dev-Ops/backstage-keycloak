import { SidebarItem } from '@backstage/core-components';
import { NavContentBlueprint } from '@backstage/plugin-app-react';
import { TENANT_PLUGIN_UI, useTenant } from '../tenant';
import { RoleNav, useRoleUi } from '../roles';

/** Renders the sidebar of the signed-in user's role, see `modules/roles`. */
function RoleSidebar(props: { nav: RoleNav }) {
  const { isPluginEnabled } = useTenant();
  const ui = useRoleUi();

  // Plugins the current organization turned off
  for (const [pluginId, { navItems: ids }] of Object.entries(TENANT_PLUGIN_UI)) {
    if (!isPluginEnabled(pluginId)) {
      ids.forEach(id => props.nav.take(id));
    }
  }

  return ui ? <ui.Sidebar nav={props.nav} /> : null;
}

export const SidebarContent = NavContentBlueprint.make({
  params: {
    component: ({ navItems }) => (
      <RoleSidebar
        nav={navItems.withComponent(item => (
          <SidebarItem icon={() => item.icon} to={item.href} text={item.title} />
        ))}
      />
    ),
  },
});
