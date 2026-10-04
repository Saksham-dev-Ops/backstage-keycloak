import { useApi } from '@backstage/core-plugin-api';
import { departmentApiRef } from '../api/DepartmentApi';
import { AuditLogTable } from '../components/AuditLog';
import { SectionCard } from '../components/Common';
import { ConsolePage } from '../components/Layout';
import { useAsync } from '../hooks';

export function AuditLogPage() {
  const api = useApi(departmentApiRef);
  const entries = useAsync(() => api.listAuditLog({ limit: 200 }), [api]);
  return (
    <ConsolePage
      breadcrumbs={[{ label: 'Audit log', to: '/admin/audit' }]}
      title="Audit log"
      description="Changes made to departments, their users and ministries."
    >
      <SectionCard
        title="Recent activity"
        subtitle="The latest 200 changes, newest first."
      >
        <AuditLogTable
          entries={entries.value ?? []}
          loading={entries.loading}
          error={entries.error}
          onRetry={entries.reload}
        />
      </SectionCard>
    </ConsolePage>
  );
}
