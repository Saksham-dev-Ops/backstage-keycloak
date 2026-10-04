import { useState } from 'react';
import { alertApiRef, useApi } from '@backstage/core-plugin-api';
import Button from '@material-ui/core/Button';
import AddIcon from '@material-ui/icons/Add';
import { departmentApiRef } from '../api/DepartmentApi';
import { ConfirmDialog, SectionCard } from '../components/Common';
import { ConsolePage } from '../components/Layout';
import { MinistryForm } from '../components/MinistryForm';
import { MinistryList } from '../components/MinistryList';
import { useAsync } from '../hooks';
import { Ministry } from '../types';
import { tokens } from '../utils/tokens';

export function MinistriesPage() {
  const api = useApi(departmentApiRef);
  const alertApi = useApi(alertApiRef);
  const ministries = useAsync(() => api.listMinistries(), [api]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Ministry>();
  const [deleting, setDeleting] = useState<Ministry>();

  return (
    <ConsolePage
      breadcrumbs={[{ label: 'Ministries', to: '/admin/ministries' }]}
      title="Ministries"
      description="Ministries group the departments on OpenForge."
      actions={
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          style={{
            height: 40,
            fontSize: 16,
            textTransform: 'none',
            borderRadius: tokens.radiusSm,
          }}
          onClick={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
        >
          Add Ministry
        </Button>
      }
    >
      <SectionCard
        title="All Ministries"
        subtitle="Each department belongs to one ministry."
      >
        <MinistryList
          ministries={ministries.value ?? []}
          loading={ministries.loading}
          error={ministries.error}
          onRetry={ministries.reload}
          onEdit={ministry => {
            setEditing(ministry);
            setFormOpen(true);
          }}
          onDelete={setDeleting}
        />
      </SectionCard>
      <MinistryForm
        open={formOpen}
        ministry={editing}
        onClose={() => setFormOpen(false)}
        onSubmit={async body => {
          if (editing) {
            await api.updateMinistry(editing.id, body);
          } else {
            await api.createMinistry(body);
          }
          alertApi.post({
            message: `${body.name} was saved`,
            severity: 'success',
            display: 'transient',
          });
          ministries.reload();
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        title="Delete ministry?"
        body={
          <>
            <strong>{deleting?.name}</strong> will be deleted. Ministries with
            departments cannot be deleted.
          </>
        }
        confirmLabel="Delete"
        onClose={() => setDeleting(undefined)}
        onConfirm={async () => {
          if (deleting) {
            await api.deleteMinistry(deleting.id);
            ministries.reload();
          }
        }}
      />
    </ConsolePage>
  );
}
