import { Navigate, Route, Routes } from 'react-router-dom';
import { OrganizationsPage } from './pages/OrganizationsPage';
import { OverviewPage } from './pages/OverviewPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { UsersPage } from './pages/UsersPage';

/** Routes of the platform admin UI, under `/admin`. */
export function PlatformAdminApp() {
  return (
    <Routes>
      <Route path="/" element={<OverviewPage />} />
      <Route path="/organizations" element={<OrganizationsPage />} />
      <Route path="/users" element={<UsersPage />} />
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
