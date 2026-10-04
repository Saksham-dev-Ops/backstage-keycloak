import { Content, ContentHeader } from '@backstage/core-components';
import { MembersTab } from '@internal/backstage-plugin-tenant-react';

export function MembersPage() {
  return (
    <Content>
      <ContentHeader
        title="Members"
        description="People in this organization. Assign developers and viewers to projects from a project's Team tab."
      />
      <MembersTab />
    </Content>
  );
}
