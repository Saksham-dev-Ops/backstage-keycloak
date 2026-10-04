import { makeStyles } from '@material-ui/core/styles';
import { DepartmentProject } from '../../types';
import { formatDate } from '../../utils/format';
import { tokens } from '../../utils/tokens';
import { Column, DataTable } from '../Common';

const useStyles = makeStyles({
  name: { color: tokens.text, fontWeight: 500 },
  description: {
    color: tokens.textMuted,
    fontSize: 13,
    maxWidth: 360,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
});

/**
 * Projects of a department. Read-only here: projects are created by the
 * department's admins in their organization UI.
 */
export function ProjectList(props: {
  projects: DepartmentProject[];
  loading: boolean;
  error?: Error;
  onRetry: () => void;
}) {
  const classes = useStyles();
  const columns: Column<DepartmentProject>[] = [
    {
      key: 'name',
      title: 'Project',
      minWidth: 320,
      sticky: 'left',
      render: p => (
        <span>
          <div className={classes.name}>{p.name}</div>
          {p.description && <div className={classes.description}>{p.description}</div>}
        </span>
      ),
    },
    { key: 'slug', title: 'Identifier', minWidth: 180, render: p => p.slug },
    { key: 'environments', title: 'Environments', minWidth: 140, render: p => p.environmentCount },
    {
      key: 'members',
      title: 'Assigned users',
      minWidth: 140,
      render: p => p.assignedMemberCount ?? '–',
    },
    { key: 'updated', title: 'Last updated', minWidth: 140, render: p => formatDate(p.updatedAt) },
  ];
  return (
    <DataTable
      aria-label="Projects"
      columns={columns}
      rows={props.projects}
      rowKey={p => p.id}
      loading={props.loading}
      error={props.error}
      errorTitle="Unable to load projects"
      emptyTitle="No projects found"
      emptyBody="Department admins create projects from their organization console."
      onRetry={props.onRetry}
    />
  );
}
