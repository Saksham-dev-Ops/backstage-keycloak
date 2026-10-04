import { Link as RouterLink } from 'react-router-dom';
import {
  Content,
  ContentHeader,
  Progress,
  ResponseErrorPanel,
  Table,
  TableColumn,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import {
  PlatformTenant,
  StatTile,
  tenantApiRef,
  useLoader,
} from '@internal/backstage-plugin-tenant-react';

const columns: TableColumn<PlatformTenant>[] = [
  { title: 'Organization', field: 'name' },
  { title: 'Members', field: 'memberCount', type: 'numeric' },
  { title: 'Projects', field: 'projectCount', type: 'numeric' },
  { title: 'Status', field: 'status' },
];

export function OverviewPage() {
  const tenantApi = useApi(tenantApiRef);
  const overview = useLoader(() => tenantApi.getPlatformOverview(), [tenantApi]);
  const tenants = useLoader(() => tenantApi.listPlatformTenants(), [tenantApi]);

  return (
    <Content>
      <ContentHeader title="Platform overview" description="Everything across all organizations">
        <Button component={RouterLink} to="/admin/organizations" color="primary" variant="contained">
          Manage organizations
        </Button>
      </ContentHeader>
      {overview.error && <ResponseErrorPanel error={overview.error} />}
      {overview.loading && !overview.value && <Progress />}
      {overview.value && (
        <Grid container spacing={3} style={{ marginBottom: 24 }}>
          <Grid item xs={6} md={3}>
            <StatTile label="Organizations" value={overview.value.tenants} />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatTile label="Users" value={overview.value.users} />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatTile label="Projects" value={overview.value.projects} />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatTile label="Environments" value={overview.value.environments} />
          </Grid>
        </Grid>
      )}
      <Table
        title="Organizations at a glance"
        options={{ paging: false, search: false, padding: 'dense' }}
        isLoading={tenants.loading}
        columns={columns}
        data={tenants.value ?? []}
      />
    </Content>
  );
}
