import { Content, ContentHeader, ResponseErrorPanel, Table, TableColumn } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import Chip from '@material-ui/core/Chip';
import { PlatformUser, tenantApiRef, useLoader } from '@internal/backstage-plugin-tenant-react';

const columns: TableColumn<PlatformUser>[] = [
  { title: 'Email', field: 'email' },
  { title: 'Name', field: 'name' },
  {
    title: 'Organizations',
    render: u => (
      <>
        {u.isPlatformAdmin && (
          <Chip size="small" color="secondary" label="Platform admin" style={{ margin: 2 }} />
        )}
        {u.memberships.map(m => (
          <Chip key={m.tenantId} size="small" label={`${m.tenantName} · ${m.role}`} style={{ margin: 2 }} />
        ))}
        {!u.isPlatformAdmin && !u.memberships.length && 'None'}
      </>
    ),
  },
  { title: 'Joined', field: 'createdAt', render: u => new Date(u.createdAt).toLocaleDateString() },
];

export function UsersPage() {
  const tenantApi = useApi(tenantApiRef);
  const users = useLoader(() => tenantApi.listPlatformUsers(), [tenantApi]);
  return (
    <Content>
      <ContentHeader title="Users" description="Every account and the organizations it belongs to" />
      {users.error && <ResponseErrorPanel error={users.error} />}
      <Table
        options={{ paging: true, pageSize: 20, padding: 'dense' }}
        isLoading={users.loading}
        columns={columns}
        data={users.value ?? []}
      />
    </Content>
  );
}
