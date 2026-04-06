import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEYS = {
  dashboard: "task-manager.dashboard-config",
  savedFilters: "task-manager.saved-filters",
};

export const THEME_OPTIONS = {
  midnight: {
    key: "midnight",
    name: "Midnight",
    gradient: ["#07111F", "#0B172A", "#122033"],
    panel: "rgba(15, 23, 42, 0.76)",
    accent: "#2563EB",
    accentSoft: "#7DD3FC",
    text: "#F8FAFC",
    muted: "#94A3B8",
    danger: "#FCA5A5",
  },
  sunrise: {
    key: "sunrise",
    name: "Sunrise",
    gradient: ["#2B132C", "#663947", "#F97316"],
    panel: "rgba(55, 20, 34, 0.76)",
    accent: "#FB923C",
    accentSoft: "#FDBA74",
    text: "#FFF7ED",
    muted: "#FED7AA",
    danger: "#FECACA",
  },
  forest: {
    key: "forest",
    name: "Forest",
    gradient: ["#081C15", "#1B4332", "#2D6A4F"],
    panel: "rgba(8, 28, 21, 0.78)",
    accent: "#34D399",
    accentSoft: "#6EE7B7",
    text: "#ECFDF5",
    muted: "#A7F3D0",
    danger: "#FCA5A5",
  },
  aurora: {
    key: "aurora",
    name: "Aurora",
    gradient: ["#0B1020", "#16324F", "#0F766E"],
    panel: "rgba(10, 20, 38, 0.8)",
    accent: "#22D3EE",
    accentSoft: "#67E8F9",
    text: "#ECFEFF",
    muted: "#A5F3FC",
    danger: "#FECACA",
  },
  ember: {
    key: "ember",
    name: "Ember",
    gradient: ["#1F0A0A", "#5B1A18", "#B45309"],
    panel: "rgba(42, 15, 14, 0.8)",
    accent: "#F97316",
    accentSoft: "#FDBA74",
    text: "#FFF7ED",
    muted: "#FED7AA",
    danger: "#FECACA",
  },
  lagoon: {
    key: "lagoon",
    name: "Lagoon",
    gradient: ["#041C32", "#064663", "#18A999"],
    panel: "rgba(4, 28, 50, 0.8)",
    accent: "#2DD4BF",
    accentSoft: "#99F6E4",
    text: "#F0FDFA",
    muted: "#A7F3D0",
    danger: "#FECACA",
  },
};

export const DEFAULT_DASHBOARD_CONFIG = {
  showCompletionStats: true,
  showWeeklyReport: true,
  showHabitConsistency: true,
  showHabitSummary: true,
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

export const loadSavedFilters = async () => {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.savedFilters);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to parse saved filters:", error);
    return [];
  }
};

export const saveSavedFilters = async (filters) => {
  await AsyncStorage.setItem(STORAGE_KEYS.savedFilters, JSON.stringify(filters));
};
