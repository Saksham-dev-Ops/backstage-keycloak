import { MouseEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SidebarItem } from '@backstage/core-components';
import { alertApiRef, useApi } from '@backstage/core-plugin-api';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import BusinessIcon from '@material-ui/icons/Business';
import CheckIcon from '@material-ui/icons/Check';
import { useTenant } from '../useTenant';

/** Sidebar entry showing the current organization, with a menu to switch. */
export function TenantSwitcher() {
  const { tenants, currentTenant, switchTenant } = useTenant();
  const alertApi = useApi(alertApiRef);
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<{ top: number; left: number }>();

  if (!tenants.length) {
    return null;
  }

  const open = (event: MouseEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setAnchor({ top: rect.top, left: rect.right });
  };

  const choose = async (tenantId: string) => {
    setAnchor(undefined);
    if (tenantId === currentTenant?.id) {
      return;
    }
    try {
      await switchTenant(tenantId);
      // Leave any page of the previous tenant; the new role may have another UI
      navigate('/');
    } catch (e) {
      alertApi.post({ message: (e as Error).message, severity: 'error' });
    }
  };

  return (
    <>
      <SidebarItem
        icon={BusinessIcon}
        text={currentTenant?.name ?? 'Choose organization'}
        onClick={open}
      />
      <Menu
        open={!!anchor}
        onClose={() => setAnchor(undefined)}
        anchorReference="anchorPosition"
        anchorPosition={anchor}
      >
        {tenants.map(tenant => (
          <MenuItem key={tenant.id} onClick={() => choose(tenant.id)}>
            <ListItemIcon>
              {tenant.id === currentTenant?.id ? <CheckIcon fontSize="small" /> : <span />}
            </ListItemIcon>
            <ListItemText primary={tenant.name} secondary={tenant.role} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
