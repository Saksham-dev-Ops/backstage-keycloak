import { Navigate, Route, Routes } from 'react-router-dom';
import { AddDepartmentPage } from './AddDepartmentPage';
import { DepartmentDetailPage } from './DepartmentDetailPage';
import { DepartmentsPage } from './DepartmentsPage';

/** Routes under `/admin/departments`. */
export function DepartmentRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DepartmentsPage />} />
      <Route path="/new" element={<AddDepartmentPage />} />
      <Route path="/:departmentId" element={<DepartmentDetailPage />} />
      <Route path="*" element={<Navigate to="/admin/departments" replace />} />
    </Routes>
  );
}
