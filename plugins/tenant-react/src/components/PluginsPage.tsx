import { Content, ContentHeader, InfoCard, Progress } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
import ListItemText from '@material-ui/core/ListItemText';
import Switch from '@material-ui/core/Switch';
import Typography from '@material-ui/core/Typography';
import { tenantApiRef } from '../api';
import { useTenant } from '../useTenant';
import { useAction } from './shared';

/** Turns plugins on or off for the current organization. */
export function PluginsPage() {
  const tenantApi = useApi(tenantApiRef);
  const { currentTenant, plugins, can, role, loading } = useTenant();
  const run = useAction();
  const canManage = can('plugin.manage');

  return (
    <Content>
      <ContentHeader title="Plugins" description={`Plugins available to ${currentTenant?.name}`} />
      {!canManage && (
        <Typography variant="body2" color="textSecondary" paragraph>
          Only organization owners and admins can change plugins. Your role is {role}.
        </Typography>
      )}
      {loading && !plugins.length && <Progress />}
      <InfoCard title={`Plugins of ${currentTenant?.name}`}>
        <Typography variant="body2" color="textSecondary">
          Turned-off plugins disappear from the sidebar, their pages are blocked and their
          backend APIs reject requests for this organization.
        </Typography>
        <List>
          {plugins.map(plugin => (
            <ListItem key={plugin.id} divider>
              <ListItemText primary={plugin.title} secondary={plugin.description} />
              <ListItemSecondaryAction>
                <Switch
                  color="primary"
                  edge="end"
                  checked={plugin.enabled}
                  disabled={!canManage}
                  inputProps={{ 'aria-label': `Enable ${plugin.title}` }}
                  onChange={(_e, enabled) =>
                    run(
                      () => tenantApi.setPluginEnabled(plugin.id, enabled),
                      `${plugin.title} ${enabled ? 'enabled' : 'disabled'} for ${currentTenant?.name}`,
                    )
                  }
                />
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </InfoCard>
    </Content>
  );
}
