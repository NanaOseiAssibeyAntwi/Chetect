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

export const palette = {
  background: '#f6f7f9',
  backgroundAlt: '#eef2f6',
  panel: '#ffffff',
  panelSoft: '#f9fafb',
  panelRaised: '#ffffff',
  surfaceGlassDark: '#ffffff',
  surfaceGlassStrong: '#ffffff',
  border: '#e3e8ef',
  borderSoft: '#eef2f6',
  borderStrong: '#cdd5df',
  text: '#101828',
  muted: '#667085',
  mutedStrong: '#475467',
  teal: '#2563eb',
  tealSoft: '#eff6ff',
  tealGlow: '#93c5fd',
  sky: '#0ea5e9',
  warning: '#b45309',
  warningSoft: '#fff7ed',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  success: '#15803d',
  successSoft: '#f0fdf4',
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
  sm: 6,
  md: 8,
  lg: 8,
  pill: 999,
};

export const shadow = {
  card: {
    elevation: 1,
    shadowColor: '#101828',
    shadowOffset: { height: 1, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
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
  display: normalize(25),
  hero: normalize(shortEdge < 360 ? 36 : 42),
  label: normalize(10),
  subtitle: normalize(15),
  tiny: normalize(9),
  title: normalize(20),
};
