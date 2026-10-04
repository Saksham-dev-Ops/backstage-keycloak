import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Header, Page, Progress } from '@backstage/core-components';
import { UnifiedThemeProvider } from '@backstage/theme';
import { TenantGate } from '@internal/backstage-plugin-tenant-react';
import { ROLE_UI } from './roleUi';
import { useRole } from './shared/useRole';

/**
 * Picks the UI of the signed-in user's role (see `roleUi.ts`) and applies its
 * theme, sends `/` to the role's landing page, and sends pages the role may
 * not open back there. The backend enforces the same limits on the data.
 */
export function RoleGuard(props: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { roleId, loading, current, isPlatformAdmin } = useRole();

  if (loading && !current && !isPlatformAdmin) {
    return <Progress />;
  }
  if (!roleId) {
    // Not in an organization yet, or several to choose from
    return (
      <Page themeId="home">
        <Header title="Welcome" />
        <TenantGate>{null}</TenantGate>
      </Page>
    );
  }

  const ui = ROLE_UI[roleId];
  const content =
    pathname === '/' || !ui.isPathAllowed(pathname) ? (
      <Navigate to={ui.landingPath} replace />
    ) : (
      props.children
    );

  const themeName = `role-${roleId}`;
  const vars = Object.entries(ui.theme.cssVars)
    .map(([name, value]) => `${name}: ${value};`)
    .join(' ');

  return (
    <UnifiedThemeProvider theme={ui.theme.theme} themeName={themeName}>
      {/* Colors of the @backstage/ui components, which don't use the MUI theme */}
      <style>{`body[data-theme-name='${themeName}'] { ${vars} }`}</style>
      {content}
    </UnifiedThemeProvider>
  );
}
