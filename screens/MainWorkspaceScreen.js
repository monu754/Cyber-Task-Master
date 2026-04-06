import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Updates from "expo-updates";
import {
  Animated,
  AppState,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { THEME_OPTIONS } from "../utils/preferences";
import AddHabitScreen from "./AddHabitScreen";
import AddTaskScreen from "./AddTaskScreen";
import HabitsScreen from "./HabitsScreen";
import HomeScreen from "./HomeScreen";
import TasksScreen from "./TasksScreen";
import ThemeScreen from "./ThemeScreen";

const TABS = [
  { key: "home", label: "Dashboard", icon: "home-outline", activeIcon: "home" },
  { key: "tasks", label: "Tasks", icon: "albums-outline", activeIcon: "albums" },
  { key: "habits", label: "Habits", icon: "repeat-outline", activeIcon: "repeat" },
  { key: "themes", label: "Themes", icon: "color-palette-outline", activeIcon: "color-palette" },
];

const getPageWidth = (width) => (width > 0 ? width : Dimensions.get("window").width);

export default function MainWorkspaceScreen({ onChangeTheme, themeKey }) {
  const pagerRef = useRef(null);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const pageWidth = getPageWidth(width);
  const [activeIndex, setActiveIndex] = useState(0);
  const [plannerTask, setPlannerTask] = useState(null);
  const [plannerHabit, setPlannerHabit] = useState(null);
  const [plannerType, setPlannerType] = useState(null);
  const [updateState, setUpdateState] = useState({
    isAvailable: false,
    isChecking: false,
    isDownloading: false,
    error: "",
    unsupportedReason: "",
  });

  const bottomInset = Math.max(insets.bottom + 96, 118);
  const theme = THEME_OPTIONS[themeKey] || THEME_OPTIONS.midnight;
  const isCompact = width < 390;

  const checkForAppUpdates = useCallback(async () => {
    if (__DEV__ || !Updates.isEnabled) {
      setUpdateState((current) => ({
        ...current,
        isChecking: false,
        isAvailable: false,
        isDownloading: false,
        unsupportedReason: __DEV__
          ? "In-app updates are disabled in local development builds. Install an EAS preview or production build to test updates."
          : "This installed build does not support Expo Updates. Install an EAS preview or production build linked to your update channel.",
      }));
      return;
    }

    setUpdateState((current) => ({
      ...current,
      isChecking: true,
      error: "",
      unsupportedReason: "",
    }));

    try {
      const result = await Updates.checkForUpdateAsync();

      setUpdateState((current) => ({
        ...current,
        isChecking: false,
        isAvailable: result.isAvailable,
      }));
    } catch (error) {
      setUpdateState((current) => ({
        ...current,
        isChecking: false,
        error: "Unable to check for updates right now.",
      }));
      console.error("Update check failed:", error);
    }
  }, []);

  const applyAvailableUpdate = useCallback(async () => {
    if (__DEV__ || !Updates.isEnabled) {
      setUpdateState((current) => ({
        ...current,
        isDownloading: false,
        unsupportedReason: __DEV__
          ? "In-app updates are disabled in local development builds. Install an EAS preview or production build to apply OTA updates."
          : "This installed build does not support Expo Updates. Install an EAS preview or production build linked to your update channel.",
      }));
      return;
    }

    setUpdateState((current) => ({ ...current, isDownloading: true, error: "" }));

    try {
      const result = await Updates.fetchUpdateAsync();

      if (result.isNew) {
        await Updates.reloadAsync();
        return;
      }

      setUpdateState((current) => ({
        ...current,
        isDownloading: false,
        isAvailable: false,
      }));
    } catch (error) {
      setUpdateState((current) => ({
        ...current,
        isDownloading: false,
        error: "Update download failed. Please try again.",
      }));
      console.error("Update download failed:", error);
    }
  }, []);

  const goToIndex = useCallback(
    (index, animated = true) => {
      const clampedIndex = Math.max(0, Math.min(index, TABS.length - 1));
      setActiveIndex(clampedIndex);
      pagerRef.current?.scrollTo({ x: clampedIndex * pageWidth, animated });
    },
    [pageWidth],
  );

  useEffect(() => {
    goToIndex(activeIndex, false);
  }, [activeIndex, goToIndex, pageWidth]);

  useEffect(() => {
    checkForAppUpdates();

    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") {
        checkForAppUpdates();
      }
    });

    return () => subscription.remove();
  }, [checkForAppUpdates]);

  const openPlanner = useCallback(
    (task = null) => {
      setPlannerTask(task);
      setPlannerHabit(null);
      setPlannerType("task");
    },
    [],
  );

  const openHabitPlanner = useCallback(
    (habit = null) => {
      setPlannerHabit(habit);
      setPlannerTask(null);
      setPlannerType("habit");
    },
    [],
  );

  const handlePlannerCancel = useCallback(() => {
    setPlannerTask(null);
    setPlannerHabit(null);
    setPlannerType(null);
  }, []);

  const handlePlannerSaved = useCallback(() => {
    setPlannerTask(null);
    setPlannerHabit(null);
    setPlannerType(null);
    goToIndex(1);
  }, [goToIndex]);

  const handleHabitSaved = useCallback(() => {
    setPlannerTask(null);
    setPlannerHabit(null);
    setPlannerType(null);
    goToIndex(2);
  }, [goToIndex]);

  const navItems = useMemo(
    () =>
      TABS.map((tab, index) => {
        const isActive = activeIndex === index;
        return {
          ...tab,
          shortLabel:
            tab.key === "home"
              ? "Home"
              : tab.key === "themes"
                  ? "Theme"
                  : tab.label,
          index,
          isActive,
          iconName: isActive ? tab.activeIcon : tab.icon,
        };
      }),
    [activeIndex],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={theme.gradient} style={styles.gradient}>
        <View pointerEvents="none" style={styles.backgroundLayer}>
          <View style={styles.blobAmber} />
          <View style={styles.blobBlue} />
          <View style={styles.blobMint} />
        </View>

        <Animated.ScrollView
          ref={pagerRef}
          horizontal
          scrollEnabled
          pagingEnabled
          bounces={false}
          directionalLockEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          contentOffset={{ x: activeIndex * pageWidth, y: 0 }}
          onMomentumScrollEnd={(event) => {
            const nextIndex = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
            setActiveIndex(nextIndex);
          }}
        >
          <View style={[styles.page, { width: pageWidth }]}>
            <HomeScreen
              isActive={activeIndex === 0}
              bottomInset={bottomInset}
              onOpenTasks={() => goToIndex(1)}
              onOpenPlanner={() => openPlanner(null)}
              onOpenHabitPlanner={() => openHabitPlanner(null)}
              onOpenHabits={() => goToIndex(2)}
              onOpenThemes={() => goToIndex(3)}
              onApplyUpdate={applyAvailableUpdate}
              onCheckForUpdates={checkForAppUpdates}
              theme={theme}
              updateState={updateState}
            />
          </View>

          <View style={[styles.page, { width: pageWidth }]}>
            <TasksScreen
              isActive={activeIndex === 1}
              bottomInset={bottomInset}
              onOpenPlanner={(task) => openPlanner(task ?? null)}
              theme={theme}
            />
          </View>

          <View style={[styles.page, { width: pageWidth }]}>
            <HabitsScreen
              isActive={activeIndex === 2}
              bottomInset={bottomInset}
              onOpenPlanner={(habit) => openHabitPlanner(habit ?? null)}
              theme={theme}
            />
          </View>

          <View style={[styles.page, { width: pageWidth }]}>
            <ThemeScreen
              isActive={activeIndex === 3}
              bottomInset={bottomInset}
              onChangeTheme={onChangeTheme}
              theme={theme}
              themeKey={themeKey}
            />
          </View>
        </Animated.ScrollView>

        <View style={[styles.bottomWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <BlurView intensity={34} tint="dark" style={styles.bottomBarBlur}>
            <View style={styles.bottomBar}>
            {navItems.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={[styles.navButton, item.isActive && styles.navButtonActive]}
                activeOpacity={0.9}
                onPress={() => {
                  setPlannerTask(null);
                  setPlannerHabit(null);
                  goToIndex(item.index);
                }}
              >
                <View style={[styles.iconWrap, item.isActive && styles.iconWrapActive]}>
                  <Ionicons name={item.iconName} size={18} color="#F8FAFC" />
                </View>
                <Text style={[styles.navLabel, item.isActive && styles.navLabelActive]}>
                  {isCompact ? item.shortLabel : item.label}
                </Text>
              </TouchableOpacity>
            ))}
            </View>
          </BlurView>
        </View>

        <Modal
          visible={plannerType === "task"}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={handlePlannerCancel}
        >
          <AddTaskScreen
            isActive={plannerType === "task"}
            bottomInset={bottomInset}
            taskToEdit={plannerTask}
            onCancel={handlePlannerCancel}
            onSaved={handlePlannerSaved}
            theme={theme}
          />
        </Modal>

        <Modal
          visible={plannerType === "habit"}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={handlePlannerCancel}
        >
          <AddHabitScreen
            isActive={plannerType === "habit"}
            bottomInset={bottomInset}
            habitToEdit={plannerHabit}
            onCancel={handlePlannerCancel}
            onSaved={handleHabitSaved}
            theme={theme}
          />
        </Modal>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#07111F",
  },
  gradient: {
    flex: 1,
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  blobAmber: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    top: -80,
    right: -80,
    backgroundColor: "rgba(251, 191, 36, 0.12)",
  },
  blobBlue: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: 180,
    left: -130,
    bottom: 40,
    backgroundColor: "rgba(59, 130, 246, 0.12)",
  },
  blobMint: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    right: 40,
    bottom: 180,
    backgroundColor: "rgba(45, 212, 191, 0.09)",
  },
  page: {
    flex: 1,
  },
  bottomWrap: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 0,
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 22,
    backgroundColor: "rgba(7, 17, 31, 0.74)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.18)",
  },
  bottomBarBlur: {
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: "#020617",
    shadowOpacity: 0.34,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 18,
  },
  navButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 16,
  },
  navButtonActive: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(148, 163, 184, 0.12)",
  },
  iconWrapActive: {
    backgroundColor: "#2563EB",
  },
  navLabel: {
    color: "#8FA5BF",
    fontSize: 11,
    fontWeight: "700",
  },
  navLabelActive: {
    color: "#F8FAFC",
  },
});
