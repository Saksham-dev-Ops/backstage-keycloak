import { ReactNode } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { tokens } from '../../utils/tokens';
import { Breadcrumbs, Crumb } from './Breadcrumbs';
import { PageHeader } from './PageHeader';

const useStyles = makeStyles(theme => ({
  root: {
    minHeight: '100vh',
    background: tokens.surface,
    fontFamily: tokens.fontFamily,
    color: tokens.text,
    '& .MuiTypography-root, & .MuiButton-root, & .MuiInputBase-root, & table': {
      fontFamily: tokens.fontFamily,
    },
  },
  content: {
    padding: '32px 40px 40px',
    maxWidth: 1600,
    [theme.breakpoints.down('sm')]: { padding: '24px 16px 32px' },
  },
}));

/** A page of the admin console: breadcrumb bar, header, then content. */
export function ConsolePage(props: {
  breadcrumbs: Crumb[];
  breadcrumbVariant?: 'console' | 'section';
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const classes = useStyles();
  return (
    <div className={classes.root}>
      <Breadcrumbs
        items={props.breadcrumbs}
        variant={props.breadcrumbVariant}
      />
      <main className={classes.content}>
        <PageHeader
          title={props.title}
          description={props.description}
          actions={props.actions}
        />
        {props.children}
      </main>
    </div>
  );
}
