import { Navigate, Route, Routes } from 'react-router-dom';
import { TenantGate } from '@internal/backstage-plugin-tenant-react';
import { MyProjectPage } from './pages/MyProjectPage';
import { MyProjectsPage } from './pages/MyProjectsPage';

/** Routes of the user UI, under `/me`. */
export function UserApp() {
  return (
    <TenantGate>
      <Routes>
        <Route path="/" element={<MyProjectsPage />} />
        <Route path="/projects/:projectId" element={<MyProjectPage />} />
        <Route path="*" element={<Navigate to="/me" replace />} />
      </Routes>
    </TenantGate>
  );
}
