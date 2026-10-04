import { Content, ContentHeader } from '@backstage/core-components';
import { AuditTab } from '@internal/backstage-plugin-tenant-react';

export function AuditPage() {
  return (
    <Content>
      <ContentHeader title="Audit log" description="Everything that happened in this organization" />
      <AuditTab />
    </Content>
  );
}
