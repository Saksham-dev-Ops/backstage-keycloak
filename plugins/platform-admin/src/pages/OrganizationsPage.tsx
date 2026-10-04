import { useState } from 'react';
import { Content, ContentHeader, ResponseErrorPanel, Table, TableColumn } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import Button from '@material-ui/core/Button';
import Chip from '@material-ui/core/Chip';
import {
  CreateOrganizationDialog,
  PlatformTenant,
  tenantApiRef,
  useLoader,
} from '@internal/backstage-plugin-tenant-react';

const columns: TableColumn<PlatformTenant>[] = [
  { title: 'Name', field: 'name' },
  { title: 'Slug', field: 'slug' },
  {
    title: 'Status',
    field: 'status',
    render: t => (
      <Chip size="small" label={t.status} color={t.status === 'active' ? 'primary' : 'default'} />
    ),
  },
  { title: 'Members', field: 'memberCount', type: 'numeric' },
  { title: 'Projects', field: 'projectCount', type: 'numeric' },
  { title: 'Created', field: 'createdAt', render: t => new Date(t.createdAt).toLocaleDateString() },
];

export function OrganizationsPage() {
  const tenantApi = useApi(tenantApiRef);
  const tenants = useLoader(() => tenantApi.listPlatformTenants(), [tenantApi]);
  const [creating, setCreating] = useState(false);

  return (
    <Content>
      <ContentHeader title="Organizations" description="Every organization on the platform">
        <Button color="primary" variant="contained" onClick={() => setCreating(true)}>
          New organization
        </Button>
      </ContentHeader>
      {tenants.error && <ResponseErrorPanel error={tenants.error} />}
      <Table
        options={{ paging: false, padding: 'dense' }}
        isLoading={tenants.loading}
        columns={columns}
        data={tenants.value ?? []}
      />
      <CreateOrganizationDialog
        open={creating}
        onClose={() => {
          setCreating(false);
          tenants.reload();
        }}
      />
    </Content>
  );
}
