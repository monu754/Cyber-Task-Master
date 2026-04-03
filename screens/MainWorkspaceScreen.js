import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Updates from "expo-updates";
import {
  Animated,
  AppState,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { THEME_OPTIONS } from "../utils/preferences";
import AddTaskScreen from "./AddTaskScreen";
import HomeScreen from "./HomeScreen";
import TasksScreen from "./TasksScreen";

const TABS = [
  { key: "home", label: "Dashboard", icon: "home-outline", activeIcon: "home" },
  { key: "tasks", label: "Tasks", icon: "albums-outline", activeIcon: "albums" },
  { key: "planner", label: "Planner", icon: "add-circle-outline", activeIcon: "add-circle" },
];

const getPageWidth = (width) => (width > 0 ? width : Dimensions.get("window").width);

export default function MainWorkspaceScreen({ onChangeTheme, themeKey }) {
  const pagerRef = useRef(null);
  const previousIndexRef = useRef(0);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const pageWidth = getPageWidth(width);
  const [activeIndex, setActiveIndex] = useState(0);
  const [plannerTask, setPlannerTask] = useState(null);
  const [updateState, setUpdateState] = useState({
    isAvailable: false,
    isChecking: false,
    isDownloading: false,
    error: "",
  });

  const bottomInset = Math.max(insets.bottom + 96, 118);
  const theme = THEME_OPTIONS[themeKey] || THEME_OPTIONS.midnight;
  const isCompact = width < 390;

  const checkForAppUpdates = useCallback(async () => {
    if (__DEV__ || !Updates.isEnabled) {
      return;
    }

    setUpdateState((current) => ({ ...current, isChecking: true, error: "" }));

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
    (task = null, sourceIndex = activeIndex) => {
      previousIndexRef.current = sourceIndex;
      setPlannerTask(task);
      goToIndex(2);
    },
    [activeIndex, goToIndex],
  );

  const handlePlannerCancel = useCallback(() => {
    setPlannerTask(null);
    goToIndex(previousIndexRef.current === 2 ? 0 : previousIndexRef.current);
  }, [goToIndex]);

  const handlePlannerSaved = useCallback(() => {
    setPlannerTask(null);
    goToIndex(1);
  }, [goToIndex]);

  const navItems = useMemo(
    () =>
      TABS.map((tab, index) => {
        const isActive = activeIndex === index;
        return {
          ...tab,
          shortLabel:
            tab.key === "home" ? "Home" : tab.key === "planner" ? "Plan" : tab.label,
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

        {updateState.isAvailable || updateState.isChecking || updateState.isDownloading || updateState.error ? (
          <View style={[styles.updateBannerWrap, { top: insets.top + 10 }]}>
            <BlurView intensity={30} tint="dark" style={styles.updateBannerBlur}>
              <View style={styles.updateBanner}>
              <View style={styles.updateBannerIcon}>
                <Ionicons name="cloud-download-outline" size={18} color="#F8FAFC" />
              </View>
              <View style={styles.updateBannerTextWrap}>
                <Text style={styles.updateBannerTitle}>
                  {updateState.isAvailable
                    ? "New update available"
                    : updateState.isDownloading
                      ? "Downloading update"
                      : updateState.isChecking
                        ? "Checking for updates"
                        : "Update status"}
                </Text>
                <Text style={styles.updateBannerText}>
                  {updateState.error ||
                    (updateState.isAvailable
                      ? "A newer version is ready. Apply it without leaving the app."
                      : updateState.isDownloading
                        ? "Please wait while the latest version is prepared."
                        : "We are checking whether a newer version is available.")}
                </Text>
              </View>
              {updateState.isAvailable ? (
                <TouchableOpacity
                  style={styles.updateBannerButton}
                  activeOpacity={0.88}
                  onPress={applyAvailableUpdate}
                >
                  <Text style={styles.updateBannerButtonText}>
                    {updateState.isDownloading ? "Applying..." : "Update"}
                  </Text>
                </TouchableOpacity>
              ) : !updateState.isDownloading ? (
                <TouchableOpacity
                  style={styles.updateCheckButton}
                  activeOpacity={0.88}
                  onPress={checkForAppUpdates}
                >
                  <Ionicons name="refresh-outline" size={16} color="#D7ECFF" />
                </TouchableOpacity>
              ) : null}
              </View>
            </BlurView>
          </View>
        ) : null}

        <Animated.ScrollView
          ref={pagerRef}
          horizontal
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
              onOpenPlanner={() => openPlanner(null, 0)}
              onChangeTheme={onChangeTheme}
              theme={theme}
              themeKey={themeKey}
            />
          </View>

          <View style={[styles.page, { width: pageWidth }]}>
            <TasksScreen
              isActive={activeIndex === 1}
              bottomInset={bottomInset}
              onOpenPlanner={(task) => openPlanner(task ?? null, 1)}
              theme={theme}
            />
          </View>

          <View style={[styles.page, { width: pageWidth }]}>
            <AddTaskScreen
              isActive={activeIndex === 2}
              bottomInset={bottomInset}
              taskToEdit={plannerTask}
              onCancel={handlePlannerCancel}
              onSaved={handlePlannerSaved}
              theme={theme}
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
                  if (item.index === 2 && activeIndex !== 2) {
                    openPlanner(null, activeIndex);
                    return;
                  }

                  if (item.index !== 2) {
                    setPlannerTask(null);
                  }

                  goToIndex(item.index);
                }}
              >
                <View style={[styles.iconWrap, item.isActive && styles.iconWrapActive]}>
                  <Ionicons name={item.iconName} size={item.index === 2 ? 22 : 18} color="#F8FAFC" />
                </View>
                <Text style={[styles.navLabel, item.isActive && styles.navLabelActive]}>
                  {isCompact ? item.shortLabel : item.label}
                </Text>
              </TouchableOpacity>
            ))}
            </View>
          </BlurView>
        </View>
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
  updateBannerWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 20,
  },
  updateBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(15, 118, 110, 0.78)",
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(153, 246, 228, 0.26)",
  },
  updateBannerBlur: {
    borderRadius: 22,
    overflow: "hidden",
  },
  updateBannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  updateBannerTextWrap: {
    flex: 1,
  },
  updateBannerTitle: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "800",
  },
  updateBannerText: {
    color: "#D7ECFF",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  updateBannerButton: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  updateBannerButtonText: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "800",
  },
  updateCheckButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
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
