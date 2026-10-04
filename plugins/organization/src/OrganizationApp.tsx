import { Navigate, Route, Routes } from 'react-router-dom';
import {
  PluginsPage,
  ProjectDetailPage,
  ProjectListPage,
  TenantGate,
} from '@internal/backstage-plugin-tenant-react';
import { AuditPage } from './pages/AuditPage';
import { DashboardPage } from './pages/DashboardPage';
import { MembersPage } from './pages/MembersPage';

/** Routes of the organization UI, under `/org`. */
export function OrganizationApp() {
  return (
    <TenantGate>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/projects">
          <Route index element={<ProjectListPage />} />
          <Route path=":projectId" element={<ProjectDetailPage />} />
        </Route>
        <Route path="/members" element={<MembersPage />} />
        <Route path="/plugins" element={<PluginsPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="*" element={<Navigate to="/org" replace />} />
      </Routes>
    </TenantGate>
  );
}
