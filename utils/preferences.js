import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEYS = {
  dashboard: "task-manager.dashboard-config",
};

const createTheme = ({
  key,
  name,
  blurb,
  gradient,
  panel,
  panelSoft,
  accent,
  accentSoft,
  text,
  muted,
  danger,
  success = "#86EFAC",
  icon = {},
  typography = {},
}) => ({
  key,
  name,
  blurb,
  gradient,
  panel,
  panelSoft: panelSoft || panel,
  accent,
  accentSoft,
  text,
  muted,
  danger,
  success,
  icon: {
    radius: 18,
    shellRadius: 18,
    tilt: "0deg",
    borderScale: 1,
    ...icon,
  },
  typography: {
    eyebrow: {
      fontWeight: "800",
      letterSpacing: 1.1,
      textTransform: "uppercase",
      ...typography.eyebrow,
    },
    title: {
      fontWeight: "900",
      letterSpacing: -0.8,
      textTransform: "none",
      fontStyle: "normal",
      ...typography.title,
    },
    subtitle: {
      fontWeight: "500",
      letterSpacing: 0.1,
      fontStyle: "normal",
      ...typography.subtitle,
    },
    section: {
      fontWeight: "800",
      letterSpacing: 0.2,
      textTransform: "none",
      ...typography.section,
    },
    badge: {
      fontWeight: "800",
      letterSpacing: 0.5,
      textTransform: "uppercase",
      ...typography.badge,
    },
    button: {
      fontWeight: "800",
      letterSpacing: 0.2,
      textTransform: "none",
      ...typography.button,
    },
    body: {
      fontWeight: "500",
      letterSpacing: 0.1,
      fontStyle: "normal",
      ...typography.body,
    },
  },
});

export const THEME_OPTIONS = {
  midnight: createTheme({
    key: "midnight",
    name: "Midnight Signal",
    blurb: "Sleek, sharp, and quietly futuristic.",
    gradient: ["#06121F", "#0A1B2D", "#132B43"],
    panel: "rgba(10, 23, 41, 0.78)",
    panelSoft: "rgba(17, 36, 61, 0.72)",
    accent: "#3B82F6",
    accentSoft: "#7DD3FC",
    text: "#F8FAFC",
    muted: "#9FB3C8",
    danger: "#FCA5A5",
    icon: { radius: 18, shellRadius: 18, tilt: "-2deg" },
    typography: {
      title: { fontWeight: "900", letterSpacing: -1.1 },
      subtitle: { letterSpacing: 0.15 },
    },
  }),
  solar_flare: createTheme({
    key: "solar_flare",
    name: "Solar Flare",
    blurb: "Bold warmth with editorial punch.",
    gradient: ["#2A1208", "#7C2D12", "#F97316"],
    panel: "rgba(58, 22, 10, 0.78)",
    panelSoft: "rgba(97, 37, 14, 0.72)",
    accent: "#FDBA74",
    accentSoft: "#FFEDD5",
    text: "#FFF7ED",
    muted: "#FED7AA",
    danger: "#FECACA",
    icon: { radius: 12, shellRadius: 14, tilt: "3deg" },
    typography: {
      eyebrow: { letterSpacing: 1.8 },
      title: { fontWeight: "800", letterSpacing: -0.3 },
      subtitle: { fontStyle: "italic", letterSpacing: 0.25 },
      button: { fontWeight: "900", letterSpacing: 0.5, textTransform: "uppercase" },
    },
  }),
  neon_rush: createTheme({
    key: "neon_rush",
    name: "Neon Rush",
    blurb: "Electric contrast with nightlife energy.",
    gradient: ["#09090F", "#29104A", "#00A6FB"],
    panel: "rgba(20, 10, 36, 0.78)",
    panelSoft: "rgba(36, 16, 66, 0.72)",
    accent: "#22D3EE",
    accentSoft: "#F472B6",
    text: "#FDF4FF",
    muted: "#D8B4FE",
    danger: "#FB7185",
    success: "#67E8F9",
    icon: { radius: 22, shellRadius: 24, tilt: "6deg", borderScale: 1.15 },
    typography: {
      eyebrow: { letterSpacing: 2.1 },
      title: { fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
      section: { fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" },
      badge: { letterSpacing: 1 },
    },
  }),
  velvet_mono: createTheme({
    key: "velvet_mono",
    name: "Velvet Mono",
    blurb: "Minimal monochrome with a luxe red spark.",
    gradient: ["#111111", "#1E1E1E", "#3A0F18"],
    panel: "rgba(24, 24, 27, 0.84)",
    panelSoft: "rgba(39, 39, 42, 0.76)",
    accent: "#FB7185",
    accentSoft: "#FDE2E7",
    text: "#FAFAF9",
    muted: "#D6D3D1",
    danger: "#FDA4AF",
    success: "#A7F3D0",
    icon: { radius: 10, shellRadius: 10, tilt: "0deg", borderScale: 0.9 },
    typography: {
      eyebrow: { letterSpacing: 2.4 },
      title: { fontWeight: "700", letterSpacing: 2.2, textTransform: "uppercase" },
      subtitle: { letterSpacing: 0.4 },
      body: { letterSpacing: 0.35 },
      badge: { letterSpacing: 1.4 },
    },
  }),
  mint_studio: createTheme({
    key: "mint_studio",
    name: "Mint Studio",
    blurb: "Clean modern calm with glossy freshness.",
    gradient: ["#031B1B", "#0F3D3E", "#1E8E7E"],
    panel: "rgba(6, 33, 34, 0.8)",
    panelSoft: "rgba(14, 59, 61, 0.74)",
    accent: "#5EEAD4",
    accentSoft: "#CCFBF1",
    text: "#ECFEFF",
    muted: "#A7F3D0",
    danger: "#FECACA",
    icon: { radius: 24, shellRadius: 26, tilt: "-5deg", borderScale: 1.05 },
    typography: {
      title: { fontWeight: "800", letterSpacing: -0.2 },
      subtitle: { letterSpacing: 0.25 },
      section: { fontWeight: "700", letterSpacing: 0.6 },
      button: { fontWeight: "700", letterSpacing: 0.4 },
    },
  }),
};

export const DEFAULT_DASHBOARD_CONFIG = {
  showCompletionStats: true,
  showWeeklyReport: true,
  showHabitConsistency: true,
  showHabitSummary: true,
};

export const getThemeTextStyle = (theme, variant = "body") => {
  const typography = theme?.typography?.[variant];
  if (!typography) {
    return null;
  }

  return {
    fontWeight: typography.fontWeight,
    letterSpacing: typography.letterSpacing,
    textTransform: typography.textTransform,
    fontStyle: typography.fontStyle,
  };
};

export const loadDashboardConfig = async () => {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.dashboard);
  if (!raw) {
    return DEFAULT_DASHBOARD_CONFIG;
  }

  try {
    return { ...DEFAULT_DASHBOARD_CONFIG, ...JSON.parse(raw) };
  } catch (error) {
    console.error("Failed to parse dashboard config:", error);
    return DEFAULT_DASHBOARD_CONFIG;
  }
};

export const saveDashboardConfig = async (config) => {
  await AsyncStorage.setItem(STORAGE_KEYS.dashboard, JSON.stringify(config));
};
