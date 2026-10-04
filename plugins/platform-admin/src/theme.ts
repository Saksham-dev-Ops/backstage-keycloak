import { consoleTokens, createRoleTheme } from '@internal/backstage-plugin-tenant-react';

/** Platform admin: the light OpenForge admin console. */
export const platformAdminTheme = createRoleTheme({
  mode: 'light',
  primary: consoleTokens.primary,
  secondary: consoleTokens.primaryHover,
  background: consoleTokens.surface,
  paper: consoleTokens.surface,
  text: consoleTokens.text,
  sidebar: {
    background: '#FAFAFB',
    indicator: consoleTokens.primary,
    color: consoleTokens.textBody,
    selectedColor: consoleTokens.primary,
    hover: consoleTokens.primarySoft,
  },
  header: ['#1C4FB8', '#163F94'],
  headerShape: 'wave2',
  fontFamily: consoleTokens.fontFamily,
  radius: consoleTokens.radiusSm,
  components: {
    // Make room for the console sidebar (see Sidebar.tsx) instead of the
    // Backstage one; below `md` the sidebar becomes a drawer.
    BackstageSidebarPage: {
      styleOverrides: {
        root: {
          '@media (min-width:600px)': { paddingLeft: 0 },
          '@media (max-width:599.95px)': { paddingBottom: 0 },
          '@media (min-width:960px)': { paddingLeft: consoleTokens.sidebarWidth },
        },
      },
    },
  },
});
