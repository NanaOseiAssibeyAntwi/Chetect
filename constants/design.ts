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
  background: '#f7f7f5',
  backgroundAlt: '#eeeeeb',
  panel: '#ffffff',
  panelSoft: '#f2f2ef',
  panelRaised: '#ffffff',
  surfaceGlassDark: '#ffffff',
  surfaceGlassStrong: '#ffffff',
  border: '#deded8',
  borderSoft: '#e9e9e4',
  borderStrong: '#b8b8af',
  text: '#161716',
  muted: '#747670',
  mutedStrong: '#3f423d',
  teal: '#2f3b46',
  tealSoft: '#e8eaeb',
  tealGlow: '#c9ced1',
  sky: '#4a555f',
  warning: '#555a5f',
  warningSoft: '#e9e9e6',
  danger: '#7b3b3f',
  dangerSoft: '#efe5e5',
  success: '#4f665a',
  successSoft: '#e6ebe8',
};

export const darkPalette: AppPalette = {
  background: '#111211',
  backgroundAlt: '#191a18',
  panel: '#1c1d1b',
  panelSoft: '#22231f',
  panelRaised: '#262723',
  surfaceGlassDark: '#1c1d1b',
  surfaceGlassStrong: '#262723',
  border: '#343530',
  borderSoft: '#292a26',
  borderStrong: '#565850',
  text: '#f4f4f1',
  muted: '#9c9e97',
  mutedStrong: '#d0d1ca',
  teal: '#c4cbd1',
  tealSoft: '#303438',
  tealGlow: '#565e65',
  sky: '#b8c0c7',
  warning: '#bfc2c5',
  warningSoft: '#303231',
  danger: '#ca8b90',
  dangerSoft: '#3b282a',
  success: '#a3b1a8',
  successSoft: '#2b332e',
};

/** @deprecated use useAppTheme() so colors respond to light/dark mode */
export const palette = lightPalette;

export const brand = {
  indigo: '#2f3b46',
  indigoDark: '#1f2730',
  indigoGlow: '#c9ced1',
  amber: '#555a5f',
  amberDark: '#33373b',
  amberGlow: '#d4d5d2',
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
    primary: ['#2f3b46', '#222b34'],
    secondary: ['#555a5f', '#42464a'],
    success: ['#4f665a', '#405349'],
    danger: ['#7b3b3f', '#633236'],
    hero: ['#eeeeeb', '#f7f7f5'],
    heroWarm: ['#eeeeeb', '#f7f7f5'],
  },
  dark: {
    primary: ['#c4cbd1', '#9fa8b0'],
    secondary: ['#bfc2c5', '#9a9fa3'],
    success: ['#a3b1a8', '#87968d'],
    danger: ['#ca8b90', '#ad7278'],
    hero: ['#191a18', '#111211'],
    heroWarm: ['#191a18', '#111211'],
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
  md: 10,
  lg: 12,
  pill: 999,
};

export const shadow = {
  card: {
    elevation: 1,
    shadowColor: '#111816',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  raised: {
    elevation: 2,
    shadowColor: '#111816',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
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
