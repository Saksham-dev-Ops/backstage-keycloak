import { createRoleTheme } from '@internal/backstage-plugin-tenant-react';

/** User: friendly, light green, very rounded. */
export const userTheme = createRoleTheme({
  mode: 'light',
  primary: '#059669',
  secondary: '#7c3aed',
  background: '#f0fdf4',
  paper: '#ffffff',
  text: '#052e16',
  sidebar: {
    background: '#064e3b',
    indicator: '#6ee7b7',
    color: '#a7f3d0',
    selectedColor: '#ffffff',
    hover: '#065f46',
  },
  header: ['#059669', '#10b981'],
  headerShape: 'wave',
  fontFamily: "'Trebuchet MS', 'Segoe UI', Roboto, sans-serif",
  radius: 18,
});
