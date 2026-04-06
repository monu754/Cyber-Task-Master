import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AppState,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppIcon, SectionBadge } from "../components/AppIcon";
import { getHabitInsights, getHabitsWithDetails, getTaskInsights, getTasksWithDetails } from "../database";
import {
  buildHabitConsistencySeries,
  buildHabitSummary,
  buildSevenDaySeries,
  buildWeeklyReport,
} from "../utils/analytics";
import {
  DEFAULT_DASHBOARD_CONFIG,
  loadDashboardConfig,
  saveDashboardConfig,
} from "../utils/preferences";
import { requestNotificationPermissions, syncTaskNotifications } from "../utils/taskNotifications";

function MiniBars({ color, data }) {
  const maxValue = Math.max(...data.map((item) => item.value), 1);
  return (
    <View style={styles.chartRow}>
      {data.map((item) => (
        <View key={item.day} style={styles.chartBarWrap}>
          <View
            style={[
              styles.chartBar,
              { height: Math.max(12, (item.value / maxValue) * 64), backgroundColor: color },
            ]}
          />
          <Text style={styles.chartLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

export default function HomeScreen({
  isActive,
  bottomInset,
  onApplyUpdate,
  onCheckForUpdates,
  onOpenHabitPlanner,
  onOpenHabits,
  onOpenThemes,
  onOpenPlanner,
  onOpenTasks,
  theme,
  updateState,
}) {
  const { width } = useWindowDimensions();
  const isCompact = width < 390;
  const [tasks, setTasks] = useState([]);
  const [habits, setHabits] = useState([]);
  const [insights, setInsights] = useState(null);
  const [habitInsights, setHabitInsights] = useState(null);
  const [dashboardConfig, setDashboardConfig] = useState(DEFAULT_DASHBOARD_CONFIG);

  const loadHomeData = useCallback(async () => {
    const allTasks = getTasksWithDetails();
    const allHabits = getHabitsWithDetails();
    setTasks(allTasks);
    setHabits(allHabits);
    setInsights(getTaskInsights());
    setHabitInsights(getHabitInsights());
    setDashboardConfig(await loadDashboardConfig());
  }, []);

  useEffect(() => {
    requestNotificationPermissions();
    loadHomeData();

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        loadHomeData();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [loadHomeData]);

  useEffect(() => {
    if (isActive) {
      loadHomeData();
    }
  }, [isActive, loadHomeData]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const schedulableItems = [...tasks, ...habits];
      if (schedulableItems.length > 0) {
        syncTaskNotifications(schedulableItems);
      }
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [habits, tasks]);

  const pendingTasks = useMemo(() => tasks.filter((task) => task.status !== "Done"), [tasks]);
  const nextDueTask = useMemo(() => {
    const scheduledPendingTasks = pendingTasks
      .filter((task) => task.due_date)
      .sort((leftTask, rightTask) => new Date(leftTask.due_date) - new Date(rightTask.due_date));

    return scheduledPendingTasks[0] || pendingTasks[0] || null;
  }, [pendingTasks]);
  const completionSeries = useMemo(
    () => buildSevenDaySeries(insights?.weekly_completion || [], "completed"),
    [insights],
  );
  const habitSeries = useMemo(
    () => buildHabitConsistencySeries(habitInsights?.weekly_completion || []),
    [habitInsights],
  );
  const weeklyReport = useMemo(
    () =>
      buildWeeklyReport({
        insights: insights || { total_tasks: 0, done_tasks: 0, overdue_tasks: 0 },
        tasks,
      }),
    [insights, tasks],
  );
  const habitSummary = useMemo(
    () =>
      buildHabitSummary({
        habits,
        insights: habitInsights || { total_habits: 0, completed_habits: 0, pending_habits: 0 },
      }),
    [habitInsights, habits],
  );

  const updateDashboardConfig = async (key, value) => {
    const nextConfig = { ...dashboardConfig, [key]: value };
    setDashboardConfig(nextConfig);
    await saveDashboardConfig(nextConfig);
  };

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={theme?.gradient?.[0] || "#07111F"} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        {updateState?.isAvailable ? (
          <LinearGradient
            colors={[theme?.accent || "#2563EB", "#0F172A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.updateBanner}
          >
            <View style={styles.updateBannerContent}>
              <Text style={styles.updateBannerEyebrow}>Update available</Text>
              <Text style={styles.updateBannerTitle}>A newer app version is ready to install.</Text>
              <Text style={styles.updateBannerText}>
                {updateState?.isDownloading
                  ? "Downloading the latest release now."
                  : "Install the latest update to get the newest fixes and improvements."}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.updateBannerButton,
                updateState?.isDownloading && styles.updateBannerButtonDisabled,
              ]}
              onPress={onApplyUpdate}
              disabled={updateState?.isDownloading}
            >
              <Text style={styles.updateBannerButtonText}>
                {updateState?.isDownloading ? "Applying..." : "Update app"}
              </Text>
            </TouchableOpacity>
          </LinearGradient>
        ) : null}

        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <SectionBadge iconName="sparkles-outline" label="Daily rhythm" theme={theme} />
            <Text style={[styles.eyebrow, { color: theme?.accentSoft || "#7DD3FC" }]}>
              Task flow
            </Text>
            <Text style={[styles.title, isCompact && styles.titleCompact, { color: theme?.text || "#F8FAFC" }]}>
              Daily Focus
            </Text>
            <Text style={[styles.subtitle, isCompact && styles.subtitleCompact, { color: theme?.muted || "#94A3B8" }]}>
              Track progress, customize the dashboard, and keep the week visible without
              leaving your local workspace.
            </Text>
          </View>
          <View style={styles.scorePill}>
            <Text style={styles.scoreValue}>{insights?.done_tasks || 0}</Text>
            <Text style={styles.scoreLabel}>completed</Text>
          </View>
        </View>

        <LinearGradient colors={[theme?.accent || "#2563EB", "#0F766E"]} style={styles.heroCard}>
          <Text style={styles.heroDate}>{todayLabel}</Text>
          <Text style={styles.heroHeadline}>
            {pendingTasks.length
              ? `${pendingTasks.length} one-time tasks are in motion. Keep the next few clean and finishable.`
              : "A fresh workspace is ready. Add one meaningful task or habit and create momentum."}
          </Text>
          <Text style={styles.heroMeta}>
            {insights?.overdue_tasks || 0} overdue tasks | {habitInsights?.pending_habits || 0} habits waiting
          </Text>
          <View style={styles.heroActions}>
            <TouchableOpacity style={styles.primaryAction} onPress={onOpenHabitPlanner}>
              <Text style={styles.primaryActionText}>New habit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryAction} onPress={onOpenPlanner}>
              <Text style={styles.secondaryActionText}>New task</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.metricRow}>
          <MetricCard label="All tasks" value={insights?.total_tasks || 0} />
          <MetricCard label="In progress" value={insights?.in_progress_tasks || 0} />
          <MetricCard label="Habits" value={habitInsights?.total_habits || 0} />
        </View>

        <View style={styles.card}>
          <SectionHeader
            title="Habit tracker"
            iconName="infinite-outline"
            theme={theme}
            action={<TouchableOpacity onPress={onOpenHabits}><Text style={styles.linkText}>Open</Text></TouchableOpacity>}
          />
          <Text style={styles.cardText}>
            {habitInsights?.pending_habits || 0} habits are active and {habitInsights?.active_streak_habits || 0} are currently on a streak.
          </Text>
          {habitSummary.nextHabits.length ? (
            habitSummary.nextHabits.map((habit) => (
              <Text key={habit.id} style={styles.cardText}>
                Next habit: {habit.title}
              </Text>
            ))
          ) : (
            <Text style={styles.cardText}>No pending habits right now.</Text>
          )}
        </View>

        <View style={styles.card}>
          <SectionHeader
            title="Next due task"
            iconName="grid-outline"
            theme={theme}
            action={<TouchableOpacity onPress={onOpenTasks}><Text style={styles.linkText}>See all</Text></TouchableOpacity>}
          />
          {nextDueTask ? (
            <TouchableOpacity
              style={[styles.taskCard, { borderColor: `${nextDueTask.project_color || theme?.accent}55` }]}
              onPress={onOpenTasks}
            >
              <Text style={styles.taskTitle}>{nextDueTask.title}</Text>
              <Text style={styles.taskMeta}>
                {nextDueTask.status}
                {nextDueTask.due_date
                  ? ` | ${new Date(nextDueTask.due_date).toLocaleString()}`
                  : ""}
              </Text>
              {nextDueTask.description ? (
                <Text style={styles.taskMeta}>{nextDueTask.description}</Text>
              ) : null}
            </TouchableOpacity>
          ) : (
            <Text style={styles.cardText}>No active tasks yet.</Text>
          )}
        </View>

        <View style={styles.card}>
          <SectionHeader title="Theme" iconName="diamond-outline" theme={theme} />
          <Text style={styles.cardText}>
            Browse all themes on a separate page with full previews before you apply one.
          </Text>
          <TouchableOpacity style={styles.themePageButton} onPress={onOpenThemes}>
            <AppIcon name="color-palette-outline" size={16} theme={theme} tone="accent" style={styles.themeButtonIcon} />
            <Text style={styles.themePageButtonText}>Open theme gallery</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <SectionHeader title="Dashboard customization" iconName="options-outline" theme={theme} />
          <ToggleRow
            label="Completion stats"
            value={dashboardConfig.showCompletionStats}
            onValueChange={(value) => updateDashboardConfig("showCompletionStats", value)}
          />
          <ToggleRow
            label="Weekly report"
            value={dashboardConfig.showWeeklyReport}
            onValueChange={(value) => updateDashboardConfig("showWeeklyReport", value)}
          />
          <ToggleRow
            label="Habit consistency"
            value={dashboardConfig.showHabitConsistency}
            onValueChange={(value) => updateDashboardConfig("showHabitConsistency", value)}
          />
          <ToggleRow
            label="Habit summary"
            value={dashboardConfig.showHabitSummary}
            onValueChange={(value) => updateDashboardConfig("showHabitSummary", value)}
          />
        </View>

        {dashboardConfig.showCompletionStats ? (
          <View style={styles.card}>
            <SectionHeader title="Task completion stats" iconName="bar-chart-outline" theme={theme} />
            <MiniBars color={theme?.accent || "#2563EB"} data={completionSeries} />
          </View>
        ) : null}

        {dashboardConfig.showWeeklyReport ? (
          <View style={styles.card}>
            <SectionHeader title="Weekly performance report" iconName="pulse-outline" theme={theme} />
            <Text style={styles.cardText}>Completion rate: {weeklyReport.completionRate}%</Text>
            <Text style={styles.cardText}>Overdue share: {weeklyReport.overdueRate}%</Text>
            {weeklyReport.focusTasks.length ? (
              weeklyReport.focusTasks.map((task) => (
                <Text key={task.id} style={styles.cardText}>
                  Focus next: {task.title}
                </Text>
              ))
            ) : (
              <Text style={styles.cardText}>No blocked or active focus tasks right now.</Text>
            )}
          </View>
        ) : null}

        {dashboardConfig.showHabitConsistency ? (
          <View style={styles.card}>
            <SectionHeader title="Habit consistency" iconName="analytics-outline" theme={theme} />
            <MiniBars color="#34D399" data={habitSeries} />
          </View>
        ) : null}

        {dashboardConfig.showHabitSummary ? (
          <View style={styles.card}>
            <SectionHeader title="Habit tracker summary" iconName="leaf-outline" theme={theme} />
            <Text style={styles.cardText}>Streak health: {habitSummary.completionRate}%</Text>
            <Text style={styles.cardText}>Pending habits: {habitSummary.pendingHabits}</Text>
            <Text style={styles.cardText}>Best streak: {habitInsights?.longest_streak || 0}</Text>
            {habitSummary.nextHabits.length ? (
              habitSummary.nextHabits.map((habit) => (
                <Text key={habit.id} style={styles.cardText}>
                  Up next: {habit.title}
                </Text>
              ))
            ) : (
              <Text style={styles.cardText}>No pending habits right now.</Text>
            )}
          </View>
        ) : null}

        <View style={styles.card}>
          <SectionHeader title="App updates" iconName="cloud-download-outline" theme={theme} />
          <Text style={styles.cardText}>
            {updateState?.unsupportedReason ||
              updateState?.error ||
              (updateState?.isAvailable
                ? "A newer version is ready to install."
                : updateState?.isDownloading
                  ? "Downloading the latest version now."
                  : updateState?.isChecking
                    ? "Looking for the latest published build."
                    : "The app checks for updates automatically when it opens. You can also run a manual check here anytime.")}
          </Text>
          <View style={styles.updateActionsRow}>
            <TouchableOpacity
              style={[
                styles.updateSecondaryButton,
                updateState?.isChecking && styles.updateSecondaryButtonDisabled,
              ]}
              onPress={onCheckForUpdates}
              disabled={updateState?.isChecking}
            >
              <Text style={styles.updateSecondaryButtonText}>
                {updateState?.isChecking ? "Checking..." : "Check for update"}
              </Text>
            </TouchableOpacity>
            {updateState?.isAvailable ? (
              <TouchableOpacity
                style={[
                  styles.updatePrimaryButton,
                  updateState?.isDownloading && styles.updatePrimaryButtonDisabled,
                ]}
                onPress={onApplyUpdate}
                disabled={updateState?.isDownloading}
              >
                <Text style={styles.updatePrimaryButtonText}>
                  {updateState?.isDownloading ? "Applying..." : "Update app"}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({ label, value }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function SectionHeader({ action, iconName, theme, title }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleWrap}>
        {iconName ? <AppIcon name={iconName} size={14} theme={theme} tone="accent" style={styles.sectionIcon} /> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {action}
    </View>
  );
}

function ToggleRow({ label, onValueChange, value }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.cardText}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: "#2563EB" }} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 18, gap: 18 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
  },
  headerText: { flex: 1 },
  eyebrow: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  title: { fontSize: 34, fontWeight: "900", letterSpacing: -1 },
  titleCompact: { fontSize: 30 },
  subtitle: { fontSize: 15, lineHeight: 22, marginTop: 8 },
  subtitleCompact: { fontSize: 14, lineHeight: 20 },
  scorePill: {
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 14,
    minWidth: 86,
    borderWidth: 1,
    borderColor: "rgba(125, 211, 252, 0.18)",
    alignItems: "center",
  },
  scoreValue: { color: "#F8FAFC", fontSize: 22, fontWeight: "900" },
  scoreLabel: { color: "#8FA5BF", fontSize: 12, fontWeight: "700", marginTop: 2 },
  updateBanner: {
    borderRadius: 28,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: "rgba(125, 211, 252, 0.28)",
    shadowColor: "#020617",
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  updateBannerContent: { gap: 6 },
  updateBannerEyebrow: {
    color: "#BFDBFE",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  updateBannerTitle: { color: "#F8FAFC", fontSize: 20, lineHeight: 28, fontWeight: "900" },
  updateBannerText: { color: "rgba(226, 232, 240, 0.92)", fontSize: 14, lineHeight: 21 },
  updateBannerButton: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  updateBannerButtonDisabled: {
    opacity: 0.7,
  },
  updateBannerButtonText: { color: "#0B172A", fontSize: 15, fontWeight: "900" },
  heroCard: { borderRadius: 30, padding: 22, gap: 14 },
  heroDate: {
    color: "#E0E7FF",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  heroHeadline: { color: "#F8FAFC", fontSize: 20, lineHeight: 28, fontWeight: "800" },
  heroMeta: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "700" },
  heroActions: { flexDirection: "row", gap: 12 },
  primaryAction: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryActionText: { color: "#0B172A", fontSize: 15, fontWeight: "800" },
  secondaryAction: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryActionText: { color: "#F8FAFC", fontSize: 15, fontWeight: "800" },
  metricRow: { flexDirection: "row", gap: 12 },
  metricCard: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.76)",
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.14)",
  },
  metricValue: { color: "#F8FAFC", fontSize: 24, fontWeight: "900" },
  metricLabel: { color: "#8FA5BF", fontSize: 13, fontWeight: "700", marginTop: 6 },
  card: {
    backgroundColor: "rgba(15, 23, 42, 0.76)",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.14)",
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitleWrap: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionIcon: { transform: [{ scale: 0.82 }] },
  sectionTitle: { color: "#F8FAFC", fontSize: 20, fontWeight: "800" },
  cardText: { color: "#CBD5E1", fontSize: 14, lineHeight: 21 },
  themePageButton: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.18)",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  themeButtonIcon: { transform: [{ scale: 0.85 }] },
  themePageButtonText: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "800",
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 8,
  },
  chartBarWrap: { flex: 1, alignItems: "center", gap: 8 },
  chartBar: { width: "100%", borderRadius: 999 },
  chartLabel: { color: "#94A3B8", fontSize: 12, fontWeight: "700" },
  linkText: { color: "#7DD3FC", fontSize: 13, fontWeight: "700" },
  updateActionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  updateSecondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(125, 211, 252, 0.3)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  updateSecondaryButtonDisabled: {
    opacity: 0.7,
  },
  updateSecondaryButtonText: { color: "#E0F2FE", fontSize: 14, fontWeight: "800" },
  updatePrimaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  updatePrimaryButtonDisabled: { opacity: 0.7 },
  updatePrimaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  taskCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
    marginTop: 4,
  },
  taskTitle: { color: "#F8FAFC", fontSize: 16, fontWeight: "800" },
  taskMeta: { color: "#94A3B8", fontSize: 13, marginTop: 6 },
});
