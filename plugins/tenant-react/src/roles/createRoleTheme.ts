import {
  createUnifiedTheme,
  UnifiedThemeOptions,
  genPageTheme,
  palettes,
  shapes,
  UnifiedTheme,
} from '@backstage/theme';

export type RoleThemeOptions = {
  mode: 'light' | 'dark';
  primary: string;
  secondary: string;
  /** Page and card backgrounds */
  background: string;
  paper: string;
  text?: string;
  sidebar: { background: string; indicator: string; color: string; selectedColor: string; hover: string };
  /** Gradient of page headers */
  header: string[];
  headerShape: 'wave' | 'wave2' | 'round';
  fontFamily: string;
  /** Corner radius of cards, buttons and inputs, in px */
  radius: number;
  /** Extra component style overrides, merged over the defaults above */
  components?: UnifiedThemeOptions['components'];
};

export type RoleTheme = {
  theme: UnifiedTheme;
  /** Colors for the `@backstage/ui` components, which don't use the MUI theme */
  cssVars: Record<string, string>;
};

/** Builds the full look of a role UI from a few brand settings. */
export function createRoleTheme(o: RoleThemeOptions): RoleTheme {
  const base = o.mode === 'dark' ? palettes.dark : palettes.light;
  const pageTheme = genPageTheme({ colors: o.header, shape: shapes[o.headerShape] });

  const theme = createUnifiedTheme({
    fontFamily: o.fontFamily,
    defaultPageTheme: 'home',
    pageTheme: {
      home: pageTheme,
      documentation: pageTheme,
      tool: pageTheme,
      service: pageTheme,
      website: pageTheme,
      library: pageTheme,
      other: pageTheme,
      app: pageTheme,
      apis: pageTheme,
    },
    palette: {
      ...base,
      mode: o.mode,
      primary: { main: o.primary },
      secondary: { main: o.secondary },
      background: { default: o.background, paper: o.paper },
      ...(o.text ? { text: { primary: o.text } } : {}),
      link: o.primary,
      linkHover: o.secondary,
      navigation: {
        background: o.sidebar.background,
        indicator: o.sidebar.indicator,
        color: o.sidebar.color,
        selectedColor: o.sidebar.selectedColor,
        navItem: { hoverBackground: o.sidebar.hover },
        submenu: { background: o.sidebar.background },
      },
      tabbar: { indicator: o.secondary },
    },
    components: {
      MuiPaper: { styleOverrides: { rounded: { borderRadius: o.radius } } },
      MuiButton: {
        styleOverrides: { root: { borderRadius: o.radius, textTransform: 'none', fontWeight: 600 } },
      },
      MuiOutlinedInput: { styleOverrides: { root: { borderRadius: o.radius } } },
      MuiChip: { styleOverrides: { root: { borderRadius: o.radius } } },
      ...o.components,
    },
  });

  return {
    theme,
    cssVars: {
      '--bui-bg-app': o.background,
      '--bui-bg-neutral-1': o.paper,
      '--bui-accent-bg': o.primary,
      '--bui-accent-bg-hover': o.secondary,
      '--bui-ring': o.primary,
      '--bui-font-regular': o.fontFamily,
      ...(o.text ? { '--bui-fg-primary': o.text } : {}),
    },
  };
}
