import { createRoleTheme } from '@internal/backstage-plugin-tenant-react';

/** Organization: clean corporate blue, light. */
export const organizationTheme = createRoleTheme({
  mode: 'light',
  primary: '#1d4ed8',
  secondary: '#0891b2',
  background: '#f1f5f9',
  paper: '#ffffff',
  text: '#0f172a',
  sidebar: {
    background: '#0f172a',
    indicator: '#38bdf8',
    color: '#94a3b8',
    selectedColor: '#ffffff',
    hover: '#1e293b',
  },
  header: ['#1d4ed8', '#0891b2'],
  headerShape: 'round',
  fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  radius: 10,
});
