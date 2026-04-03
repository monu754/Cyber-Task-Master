import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  AppState,
  FlatList,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getTasksWithCategories } from "../database";
import {
  requestNotificationPermissions,
  syncTaskNotifications,
} from "../utils/taskNotifications";

const PREVIEW_LIMIT = 4;

export default function HomeScreen({ navigation }) {
  const [tasks, setTasks] = useState([]);

  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const notificationListener = useRef();
  const responseListener = useRef();

  const loadTasks = useCallback(() => {
    try {
      const allTasks = getTasksWithCategories();
      setTasks(allTasks);
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
        { text: "View Tasks", onPress: () => navigation.navigate("Tasks") },
      ]);
    });

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        loadTasks();
      }
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }

      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }

      subscription.remove();
    };
  }, [loadTasks, navigation]);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks]),
  );

  useEffect(() => {
    Animated.parallel([
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: 1,
            duration: 6000,
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 6000,
            useNativeDriver: true,
          }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 3000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: true,
          }),
        ]),
      ),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, floatAnim, pulseAnim, slideAnim]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (tasks.length > 0) {
        syncTaskNotifications(tasks);
      }
    }, 700);

    return () => clearTimeout(timeoutId);
  }, [tasks]);

  const completedCount = tasks.filter((task) => task.completed === 1).length;
  const pendingTasks = tasks.filter((task) => task.completed === 0);
  const overdueCount = pendingTasks.filter(
    (task) => task.due_date && new Date(task.due_date) < new Date(),
  ).length;
  const todayCount = pendingTasks.filter((task) => {
    if (!task.due_date) {
      return false;
    }

    const dueDate = new Date(task.due_date);
    const today = new Date();

    return dueDate.toDateString() === today.toDateString();
  }).length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const upcomingTasks = useMemo(
    () =>
      pendingTasks
        .filter((task) => task.due_date)
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
        .slice(0, PREVIEW_LIMIT),
    [pendingTasks],
  );

  const recentTasks = useMemo(() => pendingTasks.slice(0, PREVIEW_LIMIT), [pendingTasks]);

  const previewTasks = upcomingTasks.length > 0 ? upcomingTasks : recentTasks;

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
    <SafeAreaView style={styles.outerContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

      <Animated.View
        style={[
          styles.orbNeon,
          {
            transform: [
              {
                translateY: floatAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-30, 50],
                }),
              },
              { scale: pulseAnim },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.orbGlow,
          {
            transform: [
              {
                translateX: floatAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, -40],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.orbAccent,
          {
            transform: [
              {
                translateY: floatAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [50, -30],
                }),
              },
            ],
          },
        ]}
      />

      <Animated.ScrollView
        style={[
          styles.container,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Focus Dashboard</Text>
            <Text style={styles.headerTitle}>Your Tasks</Text>
          </View>
          <View style={styles.taskBadge}>
            <Text style={styles.badgeNumber}>
              {completedCount}/{tasks.length}
            </Text>
            <Text style={styles.badgeLabel}>Completed</Text>
          </View>
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statsHeader}>
            <Text style={styles.statsLabel}>Progress Overview</Text>
            <Text style={styles.statsValue}>{progress}%</Text>
          </View>
          <View style={styles.progressContainer}>
            <View style={styles.barBg}>
              <Animated.View style={[styles.barFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {completedCount} of {tasks.length} tasks completed
            </Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{pendingTasks.length}</Text>
            <Text style={styles.summaryLabel}>Active</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{todayCount}</Text>
            <Text style={styles.summaryLabel}>Due Today</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, overdueCount > 0 && styles.overdueValue]}>
              {overdueCount}
            </Text>
            <Text style={styles.summaryLabel}>Overdue</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.primaryAction}
            activeOpacity={0.85}
            onPress={() => navigation.navigate("Tasks")}
          >
            <Ionicons name="list-outline" size={20} color="#FFFFFF" />
            <Text style={styles.primaryActionText}>View All Tasks</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryAction}
            activeOpacity={0.85}
            onPress={() => navigation.navigate("AddTask")}
          >
            <Ionicons name="add-circle-outline" size={20} color="#A5B4FC" />
            <Text style={styles.secondaryActionText}>Create Task</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Up Next</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Tasks")}>
            <Text style={styles.sectionLink}>Open list</Text>
          </TouchableOpacity>
        </View>

        {previewTasks.length > 0 ? (
          <FlatList
            data={previewTasks}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
            contentContainerStyle={styles.previewList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.taskNode, { borderLeftColor: item.category_color || "#6366F1" }]}
                activeOpacity={0.85}
                onPress={() => navigation.navigate("Tasks")}
              >
                <View style={styles.taskTopRow}>
                  <View style={styles.previewBadge}>
                    <Text style={styles.previewBadgeText}>
                      {item.category_name || "General"}
                    </Text>
                  </View>
                  <Text style={styles.priorityText}>{item.priority}</Text>
                </View>
                <Text style={styles.nodeTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.dateText}>{formatDisplayDate(item.due_date)}</Text>
              </TouchableOpacity>
            )}
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="sparkles-outline" size={58} color="#6366F1" />
            <Text style={styles.emptyTitle}>No tasks yet</Text>
            <Text style={styles.emptySubtitle}>
              Create your first task and your dashboard will start filling up automatically.
            </Text>
          </View>
        )}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: "#020617" },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  scrollContent: {
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + 15 : 15,
    paddingBottom: 32,
  },
  orbNeon: {
    position: "absolute",
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    top: -100,
    right: -150,
  },
  orbGlow: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "rgba(168, 85, 247, 0.08)",
    bottom: 50,
    left: -100,
  },
  orbAccent: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(14, 165, 233, 0.06)",
    bottom: -50,
    right: 20,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
    marginTop: 10,
  },
  greeting: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94A3B8",
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: "900",
    color: "#F8FAFC",
    letterSpacing: -1,
  },
  taskBadge: {
    backgroundColor: "#312E81",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: "#A5B4FC",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 100,
    shadowColor: "#818CF8",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 15,
  },
  badgeNumber: {
    fontSize: 17,
    fontWeight: "900",
    color: "#FFFFFF",
    textShadowColor: "#A5B4FC",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  badgeLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#E0E7FF",
    marginTop: 4,
    letterSpacing: 0.5,
  },
  statsCard: {
    backgroundColor: "rgba(49, 46, 129, 0.7)",
    padding: 20,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "rgba(165, 180, 252, 0.5)",
    overflow: "hidden",
  },
  statsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  statsLabel: { color: "#E0E7FF", fontWeight: "600", fontSize: 14 },
  statsValue: { color: "#FFFFFF", fontWeight: "900", fontSize: 28 },
  progressContainer: { gap: 8 },
  barBg: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: { height: "100%", backgroundColor: "#A5B4FC", borderRadius: 4 },
  progressText: { fontSize: 12, color: "#E0E7FF", fontWeight: "500" },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "rgba(49, 46, 129, 0.45)",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(165, 180, 252, 0.22)",
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "900",
    color: "#F8FAFC",
    marginBottom: 4,
  },
  overdueValue: {
    color: "#F87171",
  },
  summaryLabel: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    marginBottom: 24,
  },
  primaryAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#4F46E5",
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#818CF8",
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(49, 46, 129, 0.55)",
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(165, 180, 252, 0.35)",
  },
  secondaryActionText: {
    color: "#A5B4FC",
    fontSize: 15,
    fontWeight: "800",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    color: "#F8FAFC",
    fontSize: 20,
    fontWeight: "800",
  },
  sectionLink: {
    color: "#818CF8",
    fontSize: 13,
    fontWeight: "700",
  },
  previewList: {
    gap: 12,
  },
  taskNode: {
    backgroundColor: "rgba(49, 46, 129, 0.5)",
    padding: 18,
    borderRadius: 18,
    borderLeftWidth: 4,
    borderWidth: 1.5,
    borderTopColor: "rgba(165, 180, 252, 0.2)",
    borderRightColor: "rgba(165, 180, 252, 0.15)",
    borderBottomColor: "rgba(165, 180, 252, 0.15)",
  },
  taskTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  previewBadge: {
    backgroundColor: "rgba(165, 180, 252, 0.16)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  previewBadgeText: {
    color: "#C7D2FE",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  priorityText: {
    color: "#A5B4FC",
    fontSize: 12,
    fontWeight: "700",
  },
  nodeTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#F8FAFC",
    lineHeight: 22,
    marginBottom: 6,
  },
  dateText: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "500",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 48,
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyTitle: { fontSize: 24, fontWeight: "900", color: "#F8FAFC" },
  emptySubtitle: {
    fontSize: 14,
    color: "#94A3B8",
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
  },
});
