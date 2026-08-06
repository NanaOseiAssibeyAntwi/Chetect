import { Dimensions, PixelRatio, Platform } from 'react-native';

const { height, width } = Dimensions.get('window');
const shortEdge = Math.min(width, height);
const longEdge = Math.max(width, height);

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const widthScale = clamp(shortEdge / 390, 0.92, 1);
const heightScale = clamp(longEdge / 844, 0.94, 1);
const uiScale = Math.min(widthScale, heightScale);

const normalize = (size: number, factor = uiScale) =>
  Math.round(PixelRatio.roundToNearestPixel(size * factor));

export type AppPalette = {
  background: string;
  backgroundAlt: string;
  panel: string;
  panelSoft: string;
  panelRaised: string;
  surfaceGlassDark: string;
  surfaceGlassStrong: string;
  border: string;
  borderSoft: string;
  borderStrong: string;
  text: string;
  muted: string;
  mutedStrong: string;
  teal: string;
  tealSoft: string;
  tealGlow: string;
  sky: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
};

export const lightPalette: AppPalette = {
  background: '#ffffff',
  backgroundAlt: '#f5f8fc',
  panel: '#ffffff',
  panelSoft: '#f7faff',
  panelRaised: '#ffffff',
  surfaceGlassDark: '#ffffff',
  surfaceGlassStrong: '#ffffff',
  border: '#dce8f6',
  borderSoft: '#edf3fb',
  borderStrong: '#9fb7d8',
  text: '#0b172a',
  muted: '#66758b',
  mutedStrong: '#334155',
  teal: '#0b5cad',
  tealSoft: '#e7f1ff',
  tealGlow: '#bdd7ff',
  sky: '#0284c7',
  warning: '#c65308',
  warningSoft: '#fff2e5',
  danger: '#b42318',
  dangerSoft: '#fff1f0',
  success: '#047857',
  successSoft: '#e8f7ef',
};

export const darkPalette: AppPalette = {
  background: '#061325',
  backgroundAlt: '#0b1f3a',
  panel: '#0f223a',
  panelSoft: '#142c4a',
  panelRaised: '#17365d',
  surfaceGlassDark: '#0f223a',
  surfaceGlassStrong: '#132b49',
  border: '#214365',
  borderSoft: '#1a3658',
  borderStrong: '#3b6698',
  text: '#f8fbff',
  muted: '#9badc4',
  mutedStrong: '#d6e4f5',
  teal: '#7cbcff',
  tealSoft: '#123963',
  tealGlow: '#2769a8',
  sky: '#38bdf8',
  warning: '#fdba74',
  warningSoft: '#402714',
  danger: '#f87171',
  dangerSoft: '#3f1d21',
  success: '#86efac',
  successSoft: '#143722',
};

/** @deprecated use useAppTheme() so colors respond to light/dark mode */
export const palette = lightPalette;

export const brand = {
  indigo: '#0b5cad',
  indigoDark: '#073b75',
  indigoGlow: '#bdd7ff',
  amber: '#c65308',
  amberDark: '#8f3600',
  amberGlow: '#ffd9b3',
};

export type GradientPair = readonly [string, string];

export const gradients: Record<'light' | 'dark', {
  primary: GradientPair;
  secondary: GradientPair;
  success: GradientPair;
  danger: GradientPair;
  hero: GradientPair;
  heroWarm: GradientPair;
}> = {
  light: {
    primary: ['#0b5cad', '#073b75'],
    secondary: ['#c65308', '#8f3600'],
    success: ['#047857', '#065f46'],
    danger: ['#b42318', '#7f1d1d'],
    hero: ['#ffffff', '#f5f8fc'],
    heroWarm: ['#ffffff', '#fff8f1'],
  },
  dark: {
    primary: ['#7cbcff', '#2f7fd4'],
    secondary: ['#fdba74', '#c65308'],
    success: ['#86efac', '#22c55e'],
    danger: ['#f87171', '#dc2626'],
    hero: ['#0b1f3a', '#061325'],
    heroWarm: ['#1f2633', '#061325'],
  },
};

export const font = {
  body: Platform.select({
    android: 'sans',
    default: undefined,
    ios: 'System',
    web: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  }),
  display: Platform.select({
    android: 'sans',
    default: undefined,
    ios: 'System',
    web: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  }),
  mono: Platform.select({
    android: 'monospace',
    default: undefined,
    ios: 'Menlo',
    web: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
  }),
};

export const radius = {
  xs: 4,
  sm: 8,
  md: 8,
  lg: 10,
  pill: 999,
};

export const shadow = {
  card: {
    elevation: 2,
    shadowColor: '#0b3b75',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  raised: {
    elevation: 4,
    shadowColor: '#0b3b75',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
  },
};

export const layout = {
  bottomPadding: normalize(28, heightScale),
  cardGap: normalize(10),
  footerSpacer: normalize(shortEdge < 360 ? 88 : 104, heightScale),
  heroTop: normalize(shortEdge < 360 ? 26 : 34, heightScale),
  maxWidth: shortEdge >= 768 ? 600 : 500,
  screenPadding: normalize(shortEdge < 360 ? 16 : 20),
  screenPaddingWide: normalize(shortEdge < 360 ? 16 : 18),
  sectionGap: normalize(20, heightScale),
  tabBarHeight: normalize(shortEdge < 360 ? 62 : 66, heightScale),
  tabBarPaddingBottom: normalize(8, heightScale),
  tabBarPaddingTop: normalize(6, heightScale),
};

export const type = {
  body: normalize(13),
  bodyLarge: normalize(15),
  display: normalize(24),
  hero: normalize(shortEdge < 360 ? 31 : 34),
  label: normalize(10),
  subtitle: normalize(15),
  tiny: normalize(9),
  title: normalize(18),
};
