import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { getTasksWithCategories } from "../database";
import {
  requestNotificationPermissions,
  syncTaskNotifications,
} from "../utils/taskNotifications";

const PREVIEW_LIMIT = 4;

export default function HomeScreen({ isActive, bottomInset, onOpenPlanner, onOpenTasks }) {
  const [tasks, setTasks] = useState([]);
  const notificationListener = useRef();
  const responseListener = useRef();

  const loadTasks = useCallback(() => {
    try {
      setTasks(getTasksWithCategories());
    } catch (error) {
      console.error("Error loading tasks:", error);
    }
  }, []);

  useEffect(() => {
    requestNotificationPermissions();
    loadTasks();

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {});
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const { taskTitle } = response.notification.request.content.data;

      Alert.alert("Task Reminder", `Reminder received for "${taskTitle || "your task"}".`, [
        { text: "Later", style: "cancel" },
        { text: "Open tasks", onPress: onOpenTasks },
      ]);
    });

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        loadTasks();
      }
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }

      if (responseListener.current) {
        responseListener.current.remove();
      }

      subscription.remove();
    };
  }, [loadTasks, onOpenTasks]);

  useEffect(() => {
    if (isActive) {
      loadTasks();
    }
  }, [isActive, loadTasks]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (tasks.length > 0) {
        syncTaskNotifications(tasks);
      }
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [tasks]);

  const pendingTasks = useMemo(() => tasks.filter((task) => task.completed === 0), [tasks]);
  const completedCount = tasks.length - pendingTasks.length;
  const overdueCount = pendingTasks.filter(
    (task) => task.due_date && new Date(task.due_date) < new Date(),
  ).length;
  const todayCount = pendingTasks.filter((task) => {
    if (!task.due_date) {
      return false;
    }

    return new Date(task.due_date).toDateString() === new Date().toDateString();
  }).length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const upcomingTasks = useMemo(
    () =>
      pendingTasks
        .filter((task) => task.due_date)
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
        .slice(0, PREVIEW_LIMIT),
    [pendingTasks],
  );

  const previewTasks = upcomingTasks.length > 0 ? upcomingTasks : pendingTasks.slice(0, PREVIEW_LIMIT);

  const formatDisplayDate = (isoString) => {
    if (!isoString) {
      return "No deadline";
    }

    return new Date(isoString).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#07111F" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.eyebrow}>Task flow</Text>
            <Text style={styles.title}>Daily Focus</Text>
            <Text style={styles.subtitle}>
              A calmer way to begin. Keep your day clear, steady, and under your control.
            </Text>
            <View style={styles.datePill}>
              <Ionicons name="sparkles-outline" size={14} color="#C4B5FD" />
              <Text style={styles.datePillText}>{todayLabel}</Text>
            </View>
          </View>
          <View style={styles.scorePill}>
            <Text style={styles.scoreValue}>{progress}%</Text>
            <Text style={styles.scoreLabel}>on track</Text>
          </View>
        </View>

        <LinearGradient colors={["rgba(37,99,235,0.95)", "rgba(15,118,110,0.9)"]} style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{pendingTasks.length}</Text>
              <Text style={styles.heroStatLabel}>Active now</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{todayCount}</Text>
              <Text style={styles.heroStatLabel}>Due today</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{overdueCount}</Text>
              <Text style={styles.heroStatLabel}>Need rescue</Text>
            </View>
          </View>

          <Text style={styles.heroHeadline}>
            {pendingTasks.length > 0
              ? "You already know what matters. Let’s move the next few things forward."
              : "A fresh space for a fresh start. Add one task and build momentum from there."}
          </Text>

          <View style={styles.heroActions}>
            <TouchableOpacity style={styles.primaryAction} activeOpacity={0.9} onPress={onOpenTasks}>
              <Ionicons name="grid-outline" size={18} color="#0B172A" />
              <Text style={styles.primaryActionText}>Open tasks</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryAction} activeOpacity={0.9} onPress={onOpenPlanner}>
              <Ionicons name="add-outline" size={18} color="#F8FAFC" />
              <Text style={styles.secondaryActionText}>Plan task</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.metricRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{completedCount}</Text>
            <Text style={styles.metricLabel}>Completed</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{tasks.length}</Text>
            <Text style={styles.metricLabel}>All tasks</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[styles.metricValue, overdueCount > 0 && styles.metricValueAlert]}>
              {overdueCount}
            </Text>
            <Text style={styles.metricLabel}>Overdue</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Coming Up</Text>
          <TouchableOpacity onPress={onOpenTasks}>
            <Text style={styles.sectionLink}>See everything</Text>
          </TouchableOpacity>
        </View>

        {previewTasks.length > 0 ? (
          previewTasks.map((task) => (
            <TouchableOpacity
              key={task.id}
              style={[styles.taskCard, { borderColor: `${task.category_color || "#2563EB"}55` }]}
              activeOpacity={0.88}
              onPress={onOpenTasks}
            >
              <View style={styles.taskMetaRow}>
                <View
                  style={[
                    styles.categoryPill,
                    { backgroundColor: `${task.category_color || "#2563EB"}20` },
                  ]}
                >
                  <Text style={[styles.categoryPillText, { color: task.category_color || "#93C5FD" }]}>
                    {task.category_name || "General"}
                  </Text>
                </View>
                <Text style={styles.priorityText}>{task.priority}</Text>
              </View>

              <Text style={styles.taskTitle} numberOfLines={2}>
                {task.title}
              </Text>
              <Text style={styles.taskDate}>{formatDisplayDate(task.due_date)}</Text>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="sparkles-outline" size={42} color="#7DD3FC" />
            <Text style={styles.emptyTitle}>No tasks yet</Text>
            <Text style={styles.emptySubtitle}>
              Start with one small promise to yourself. The rest of the rhythm will follow.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    gap: 18,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
  },
  eyebrow: {
    color: "#7DD3FC",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  title: {
    color: "#F8FAFC",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1,
  },
  subtitle: {
    color: "#94A3B8",
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 250,
    marginTop: 8,
  },
  datePill: {
    marginTop: 14,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(76, 29, 149, 0.24)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(196, 181, 253, 0.18)",
  },
  datePillText: {
    color: "#E9D5FF",
    fontSize: 12,
    fontWeight: "700",
  },
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
  scoreValue: {
    color: "#F8FAFC",
    fontSize: 22,
    fontWeight: "900",
  },
  scoreLabel: {
    color: "#8FA5BF",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  heroCard: {
    borderRadius: 30,
    padding: 22,
    gap: 18,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroStat: {
    flex: 1,
  },
  heroDivider: {
    width: 1,
    height: 36,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginHorizontal: 10,
  },
  heroStatValue: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
  },
  heroStatLabel: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  heroHeadline: {
    color: "#F8FAFC",
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "800",
  },
  heroActions: {
    flexDirection: "row",
    gap: 12,
  },
  primaryAction: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryActionText: {
    color: "#0B172A",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryAction: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryActionText: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "800",
  },
  metricRow: {
    flexDirection: "row",
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.76)",
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.14)",
  },
  metricValue: {
    color: "#F8FAFC",
    fontSize: 24,
    fontWeight: "900",
  },
  metricValueAlert: {
    color: "#FCA5A5",
  },
  metricLabel: {
    color: "#8FA5BF",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 6,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: "#F8FAFC",
    fontSize: 22,
    fontWeight: "800",
  },
  sectionLink: {
    color: "#7DD3FC",
    fontSize: 13,
    fontWeight: "700",
  },
  taskCard: {
    backgroundColor: "rgba(15, 23, 42, 0.76)",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
  },
  taskMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  categoryPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  priorityText: {
    color: "#FCD34D",
    fontSize: 12,
    fontWeight: "700",
  },
  taskTitle: {
    color: "#F8FAFC",
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 24,
  },
  taskDate: {
    color: "#8FA5BF",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.76)",
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 36,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.14)",
    gap: 10,
  },
  emptyTitle: {
    color: "#F8FAFC",
    fontSize: 22,
    fontWeight: "900",
  },
  emptySubtitle: {
    color: "#94A3B8",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
});
