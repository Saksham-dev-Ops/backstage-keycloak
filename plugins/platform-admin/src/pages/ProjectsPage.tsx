import { useState } from 'react';
import { Content, ContentHeader, ResponseErrorPanel, Table, TableColumn } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import MenuItem from '@material-ui/core/MenuItem';
import TextField from '@material-ui/core/TextField';
import { PlatformProject, tenantApiRef, useLoader } from '@internal/backstage-plugin-tenant-react';

const columns: TableColumn<PlatformProject>[] = [
  { title: 'Organization', field: 'tenantName' },
  { title: 'Project', field: 'name' },
  { title: 'Slug', field: 'slug' },
  { title: 'Environments', field: 'environmentCount', type: 'numeric' },
  { title: 'Assigned users', field: 'assignedMemberCount', type: 'numeric' },
  { title: 'Updated', field: 'updatedAt', render: p => new Date(p.updatedAt).toLocaleDateString() },
];

export function ProjectsPage() {
  const tenantApi = useApi(tenantApiRef);
  const projects = useLoader(() => tenantApi.listPlatformProjects(), [tenantApi]);
  const [tenantId, setTenantId] = useState('');

  const organizations = new Map(projects.value?.map(p => [p.tenantId, p.tenantName]));
  const shown = (projects.value ?? []).filter(p => !tenantId || p.tenantId === tenantId);

  return (
    <Content>
      <ContentHeader title="All projects" description="Projects of every organization">
        <TextField
          select
          label="Organization"
          value={tenantId}
          onChange={e => setTenantId(e.target.value)}
          variant="outlined"
          size="small"
          style={{ minWidth: 220 }}
        >
          <MenuItem value="">All organizations</MenuItem>
          {[...organizations].map(([id, name]) => (
            <MenuItem key={id} value={id}>
              {name}
            </MenuItem>
          ))}
        </TextField>
      </ContentHeader>
      {projects.error && <ResponseErrorPanel error={projects.error} />}
      <Table
        options={{ paging: false, padding: 'dense' }}
        isLoading={projects.loading}
        columns={columns}
        data={shown}
      />
    </Content>
  );
}
