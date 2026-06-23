// "Golden Hour" design system — RN port of the EU Youth Buddy Design System.
// (Lumy-inspired dark theme: deep midnight navy + golden-hour accents, Pip the green frog.)
// Source of truth: claude.ai/design project 665b0df4 — tokens/colors.css, typography.css,
// spacing.css. Components read the SEMANTIC aliases so the whole app themes from here.

export const colors = {
  // Night surfaces
  night950: '#05070F',
  night900: '#0A0F1E', // page base
  night850: '#0E1426',
  night800: '#131B33', // card
  night700: '#1B2540', // raised card / pill
  night600: '#273152',
  night500: '#36426B', // divider on dark

  // Golden-hour accents
  sunrise600: '#F2994A',
  golden600: '#F5C24B', // primary — golden hour
  golden500: '#F9D45C',
  golden300: '#FCE8A6',
  lime500: '#DCE552',
  lime400: '#E8EF7A',
  sunset500: '#FF7A6B',
  sunset400: '#FF9E8E',
  noon500: '#3FD0C9',
  twilight500: '#6C72E0',
  twilight400: '#8E93EC',

  // Brand green (Pip)
  green700: '#007022',
  green600: '#00C639',
  green500: '#00E763',
  green400: '#5FE58A',
  green300: '#94F3AA',

  // Semantic
  primary: '#F5C24B',
  primaryPress: '#F2994A',
  primarySoft: 'rgba(245, 194, 75, 0.14)',
  onPrimary: '#0A0F1E',
  secondary: '#8E93EC',
  accent: '#FF7A6B',
  success: '#3FD08A',
  successSoft: 'rgba(63, 208, 138, 0.16)',
  warning: '#F5C24B',
  danger: '#FF5352',
  info: '#5B8CFF',
  euBlue: '#5B8CFF',

  // Text
  textPrimary: '#F4F6FB',
  textSecondary: '#AEB6CC',
  textTertiary: '#7A839E',
  textDisabled: '#4B5471',
  textInverse: '#0A0F1E',
  textLink: '#8E93EC',

  // Surfaces
  surfacePage: '#0A0F1E',
  surfaceCard: '#131B33',
  surfaceRaised: '#1B2540',
  surfaceGlass: 'rgba(27, 37, 64, 0.55)',
  surfaceFrost: 'rgba(20, 28, 52, 0.7)',
  surfaceScrim: 'rgba(3, 6, 15, 0.6)',

  // Borders
  borderSubtle: 'rgba(255, 255, 255, 0.07)',
  borderDefault: 'rgba(255, 255, 255, 0.14)',
  borderStrong: 'rgba(255, 255, 255, 0.28)',
};

// Signature gradients (LinearGradient `colors` arrays).
export const gradients = {
  night: ['#18204A', '#0A0F1E', '#05070F'] as const,
  nightLocations: [0, 0.46, 1] as const,
  sunrise: ['#2A2350', '#1A1733', '#0A0F1E'] as const,
  golden: ['#F9D45C', '#F2994A'] as const,
  sunset: ['#FF9E8E', '#FF5E63', '#7C5BD6'] as const,
  // Indigo top-glow light-leak (the Lumy signature) — vertical approximation of the radial glow.
  glowTop: ['rgba(124,111,224,0.45)', 'rgba(124,111,224,0.0)'] as const,
};

export const space = {
  s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24, s8: 32, s10: 40, s12: 48, s16: 64,
};

export const radius = {
  xs: 6, sm: 8, md: 10, lg: 16, xl: 20, xxl: 28, pill: 999,
};

// Font families from @expo-google-fonts (loaded in App via useFonts).
export const fonts = {
  display: 'BricolageGrotesque_800ExtraBold', // characterful display & titles
  displayBold: 'BricolageGrotesque_700Bold',
  sans: 'PlusJakartaSans_400Regular',
  sansMedium: 'PlusJakartaSans_500Medium',
  sansSemibold: 'PlusJakartaSans_600SemiBold',
  sansBold: 'PlusJakartaSans_700Bold',
  sansExtrabold: 'PlusJakartaSans_800ExtraBold',
};

export const type = {
  xs: 12, sm: 14, md: 16, lg: 18, xl: 20, xxl: 24, xxxl: 32, display: 34,
};

// Shadow presets (RN-friendly; deep on dark + a golden glow for the hero CTA).
export const shadow = {
  card: {
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 }, elevation: 8,
  },
  primary: {
    shadowColor: '#F5C24B', shadowOpacity: 0.45, shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  glowGreen: {
    shadowColor: '#00E763', shadowOpacity: 0.5, shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 }, elevation: 12,
  },
};

export const theme = { colors, gradients, space, radius, fonts, type, shadow };
export default theme;
