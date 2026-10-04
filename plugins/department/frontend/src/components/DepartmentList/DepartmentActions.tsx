import { useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import IconButton from '@material-ui/core/IconButton';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import { Department } from '../../types';
import { tokens } from '../../utils/tokens';

export type DepartmentAction = 'view' | 'edit' | 'suspend' | 'activate' | 'delete';

const useStyles = makeStyles({
  button: { color: tokens.primary },
  danger: { color: tokens.danger },
});

/** The kebab menu of a department row. */
export function DepartmentActions(props: {
  department: Department;
  onAction: (action: DepartmentAction, department: Department) => void;
}) {
  const classes = useStyles();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const { department } = props;
  const run = (action: DepartmentAction) => {
    setAnchor(null);
    props.onAction(action, department);
  };
  return (
    <>
      <IconButton
        size="small"
        className={classes.button}
        aria-label={`Actions for ${department.name}`}
        aria-haspopup="menu"
        onClick={e => setAnchor(e.currentTarget)}
      >
        <MoreVertIcon />
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={!!anchor}
        onClose={() => setAnchor(null)}
        getContentAnchorEl={null}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={() => run('view')}>View details</MenuItem>
        <MenuItem onClick={() => run('edit')}>Edit department</MenuItem>
        {department.status === 'suspended' ? (
          <MenuItem onClick={() => run('activate')}>Activate</MenuItem>
        ) : (
          <MenuItem onClick={() => run('suspend')}>Suspend</MenuItem>
        )}
        <MenuItem onClick={() => run('delete')} className={classes.danger}>
          Delete
        </MenuItem>
      </Menu>
    </>
  );
}
