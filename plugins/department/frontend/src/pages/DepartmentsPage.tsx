import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { alertApiRef, useApi } from '@backstage/core-plugin-api';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import AddIcon from '@material-ui/icons/Add';
import { departmentApiRef } from '../api/DepartmentApi';
import {
  ConfirmDialog,
  Pagination,
  SectionCard,
} from '../components/Common';
import {
  DepartmentAction,
  DepartmentFilters,
  DepartmentFilterValues,
  DepartmentTable,
  EMPTY_FILTERS,
} from '../components/DepartmentList';
import { DepartmentForm } from '../components/DepartmentForm';
import { ConsolePage } from '../components/Layout';
import { useAsync, useDebouncedValue } from '../hooks';
import { Department } from '../types';
import { tokens } from '../utils/tokens';

const useStyles = makeStyles({
  add: {
    height: 40,
    padding: '0 20px',
    fontSize: 16,
    fontWeight: 500,
    textTransform: 'none',
    borderRadius: tokens.radiusSm,
    background: tokens.primary,
    boxShadow: 'none',
    '&:hover': { background: tokens.primaryHover, boxShadow: 'none' },
  },
});

type Confirmation = { action: 'suspend' | 'delete'; department: Department };

/** Platform admin: every department, grouped under its ministry. */
export function DepartmentsPage() {
  const classes = useStyles();
  const api = useApi(departmentApiRef);
  const alertApi = useApi(alertApiRef);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [filters, setFilters] = useState<DepartmentFilterValues>({
    ...EMPTY_FILTERS,
    ministryId: searchParams.get('ministryId') ?? '',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editing, setEditing] = useState<Department>();
  const [confirmation, setConfirmation] = useState<Confirmation>();

  // Typing in the search fields should not fire a request per keystroke
  const search = useDebouncedValue(filters.search);
  const admin = useDebouncedValue(filters.admin);

  const ministries = useAsync(() => api.listMinistries(), [api]);
  const departments = useAsync(
    () =>
      api.listDepartments({
        page,
        pageSize,
        ministryId: filters.ministryId || undefined,
        status: filters.status || undefined,
        search: search || undefined,
        admin: admin || undefined,
      }),
    [api, page, pageSize, filters.ministryId, filters.status, search, admin],
  );

  const refresh = () => {
    departments.reload();
    ministries.reload();
  };

  const onFiltersChange = (values: DepartmentFilterValues) => {
    setFilters(values);
    setPage(1);
  };

  const onAction = async (action: DepartmentAction, department: Department) => {
    switch (action) {
      case 'view':
        navigate(`/admin/departments/${department.id}`);
        break;
      case 'edit':
        setEditing(department);
        break;
      case 'activate':
        try {
          await api.updateDepartment(department.id, { status: 'active' });
          alertApi.post({
            message: `${department.name} is active again`,
            severity: 'success',
            display: 'transient',
          });
          refresh();
        } catch (error) {
          alertApi.post({
            message: (error as Error).message,
            severity: 'error',
          });
        }
        break;
      default:
        setConfirmation({ action, department });
    }
  };

  return (
    <ConsolePage
      breadcrumbs={[{ label: 'Departments', to: '/admin/departments' }]}
      title="Departments"
      description="Every Department on OpenForge, grouped under its ministry. Create Department, assign their first admin and manage limits."
      actions={
        <Button
          variant="contained"
          color="primary"
          className={classes.add}
          startIcon={<AddIcon />}
          onClick={() => navigate('/admin/departments/new')}
        >
          Add Department
        </Button>
      }
    >
      <SectionCard
        title="All Departments"
        subtitle="Search, filter and manage Department."
        toolbar={
          <DepartmentFilters
            ministries={ministries.value ?? []}
            values={filters}
            onChange={onFiltersChange}
          />
        }
      >
        <DepartmentTable
          departments={departments.value?.items ?? []}
          loading={departments.loading}
          error={departments.error}
          onRetry={departments.reload}
          onAction={onAction}
        />
      </SectionCard>

      {departments.value && departments.value.total > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={departments.value.total}
          onPageChange={setPage}
          onPageSizeChange={size => {
            setPageSize(size);
            setPage(1);
          }}
        />
      )}

      {editing && (
        <DepartmentForm
          open
          department={editing}
          ministries={ministries.value ?? []}
          onClose={() => setEditing(undefined)}
          onUpdate={async (id, body) => {
            const updated = await api.updateDepartment(id, body);
            alertApi.post({
              message: `${updated.name} was updated`,
              severity: 'success',
              display: 'transient',
            });
            refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmation}
        title={
          confirmation?.action === 'delete'
            ? 'Delete department?'
            : 'Suspend department?'
        }
        body={
          confirmation?.action === 'delete' ? (
            <>
              <strong>{confirmation.department.name}</strong> will be deleted
              with all of its users' access, projects, configuration and
              secrets. This cannot be undone.
            </>
          ) : (
            <>
              Members of <strong>{confirmation?.department.name}</strong> will
              lose access until it is activated again. No data is deleted.
            </>
          )
        }
        confirmLabel={confirmation?.action === 'delete' ? 'Delete' : 'Suspend'}
        onClose={() => setConfirmation(undefined)}
        onConfirm={async () => {
          if (!confirmation) return;
          const { action, department } = confirmation;
          if (action === 'delete') {
            await api.deleteDepartment(department.id);
          } else {
            await api.updateDepartment(department.id, { status: 'suspended' });
          }
          alertApi.post({
            message: `${department.name} was ${
              action === 'delete' ? 'deleted' : 'suspended'
            }`,
            severity: 'success',
            display: 'transient',
          });
          refresh();
        }}
      />
    </ConsolePage>
  );
}
