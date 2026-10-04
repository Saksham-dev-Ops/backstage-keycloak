import { ReactNode, useState } from 'react';
import {
  Content,
  EmptyState,
  InfoCard,
  Progress,
  ResponseErrorPanel,
} from '@backstage/core-components';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import { OrganizationChooser } from '../TenantSignInPage';
import { useTenant } from '../useTenant';
import { CreateOrganizationDialog } from './CreateOrganizationDialog';

/**
 * Renders its children only once a tenant is selected. Children are keyed by
 * tenant id, so switching tenants discards all tenant-specific state.
 */
export function TenantGate(props: { children: ReactNode }) {
  const { loading, error, tenants, current, switchTenant, isPlatformAdmin } = useTenant();
  const [creatingOrg, setCreatingOrg] = useState(false);

  if (loading && !current) {
    return <Progress />;
  }
  if (error) {
    return (
      <Content>
        <ResponseErrorPanel error={error} />
      </Content>
    );
  }
  if (!tenants.length) {
    return (
      <Content>
        <EmptyState
          missing="data"
          title="No organization"
          description={
            isPlatformAdmin
              ? 'You are not a member of any organization yet. As a platform admin you can create one.'
              : 'You are not a member of any organization yet. Ask an organization owner or admin to add you.'
          }
          action={
            isPlatformAdmin ? (
              <Button color="primary" variant="contained" onClick={() => setCreatingOrg(true)}>
                New organization
              </Button>
            ) : undefined
          }
        />
        <CreateOrganizationDialog open={creatingOrg} onClose={() => setCreatingOrg(false)} />
      </Content>
    );
  }
  if (!current) {
    return (
      <Content>
        <Grid container justifyContent="center">
          <Grid item xs={12} sm={8} md={5}>
            <InfoCard title="Choose Organization">
              <OrganizationChooser
                tenants={tenants}
                onChoose={tenant => switchTenant(tenant.id)}
              />
            </InfoCard>
          </Grid>
        </Grid>
      </Content>
    );
  }
  return <div key={current.tenant.id}>{props.children}</div>;
}
