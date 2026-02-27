import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage"; // <-- Added Storage Import
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  SafeAreaView,
  StatusBar,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width, height } = Dimensions.get("window");

export default function HomeScreen({ navigation }) {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [isReady, setIsReady] = useState(false); // To prevent saving empty arrays on initial load

  // Advanced animations
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // --- NEW: Load Data on Boot ---
  useEffect(() => {
    const loadTasks = async () => {
      try {
        const savedTasks = await AsyncStorage.getItem("cyber_tasks");
        if (savedTasks) {
          setTasks(JSON.parse(savedTasks));
        }
      } catch (error) {
        console.error("Failed to load tasks", error);
      } finally {
        setIsReady(true);
      }
    };
    loadTasks();
  }, []);

  // --- NEW: Save Data on Change ---
  useEffect(() => {
    if (isReady) {
      AsyncStorage.setItem("cyber_tasks", JSON.stringify(tasks));
    }
  }, [tasks, isReady]);

  // Animation logic
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
  }, []);

  const addTask = (task) => setTasks((prev) => [...prev, task]);
  const toggleComplete = (id) =>
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    );

  const deleteTask = (id) => {
    Alert.alert(
      "Delete Objective",
      "Are you sure you want to remove this objective? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          onPress: () => setTasks((prev) => prev.filter((t) => t.id !== id)),
          style: "destructive",
        },
      ],
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  const progress =
    tasks.length > 0
      ? (tasks.filter((t) => t.completed).length / tasks.length) * 100
      : 0;
  const completedCount = tasks.filter((t) => t.completed).length;
  const filteredTasks = tasks.filter((t) =>
    filter === "completed"
      ? t.completed
      : filter === "pending"
        ? !t.completed
        : true,
  );

  return (
    <SafeAreaView style={styles.outerContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

      {/* ANIMATED BACKGROUND ORBS */}
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

      <Animated.View
        style={[
          styles.container,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* PREMIUM HEADER */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>Welcome Back</Text>
              <Text style={styles.headerTitle}>Objectives</Text>
            </View>
            <View style={styles.taskBadge}>
              <Text style={styles.badgeText}>
                {completedCount}/{tasks.length}
              </Text>
              <Text style={styles.badgeLabel}>Completed</Text>
            </View>
          </View>

          {/* ENHANCED STATS CARD */}
          <View style={styles.statsCard}>
            <View style={styles.statsHeader}>
              <Text style={styles.statsLabel}>Progress Overview</Text>
              <Text style={styles.statsValue}>{Math.round(progress)}%</Text>
            </View>
            <View style={styles.progressContainer}>
              <View style={styles.barBg}>
                <Animated.View
                  style={[styles.barFill, { width: `${progress}%` }]}
                />
              </View>
              <Text style={styles.progressText}>
                {completedCount} of {tasks.length} objectives completed
              </Text>
            </View>
          </View>
        </View>

        {/* PREMIUM FILTER BAR */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Filter</Text>
          <View style={styles.filterBar}>
            {["all", "pending", "completed"].map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterTab, filter === f && styles.activeTab]}
                onPress={() => setFilter(f)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={
                    f === "completed"
                      ? "checkmark-done"
                      : f === "pending"
                        ? "hourglass"
                        : "layers"
                  }
                  size={16}
                  color={filter === f ? "#F8FAFC" : "#64748B"}
                  style={styles.filterIcon}
                />
                <Text
                  style={[
                    styles.filterTabText,
                    filter === f && styles.activeTabText,
                  ]}
                >
                  {f === "all" ? "All" : f === "pending" ? "Active" : "Done"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* TASK LIST */}
        <FlatList
          data={filteredTasks}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={onRefresh}
          scrollEventThrottle={16}
          renderItem={({ item }) => (
            <Animated.View
              style={[
                styles.taskNode,
                item.completed && styles.completedNode,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <TouchableOpacity
                style={styles.nodeContent}
                onPress={() => toggleComplete(item.id)}
                activeOpacity={0.6}
              >
                <View
                  style={[
                    styles.checkbox,
                    item.completed && styles.checkboxCompleted,
                  ]}
                >
                  {item.completed ? (
                    <Ionicons name="checkmark" size={16} color="#FFF" />
                  ) : (
                    <View style={styles.checkboxInner} />
                  )}
                </View>
                <View style={styles.nodeText}>
                  <Text
                    style={[styles.nodeTitle, item.completed && styles.strike]}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                  {item.description ? (
                    <Text style={styles.nodeDesc} numberOfLines={1}>
                      {item.description}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => deleteTask(item.id)}
                style={styles.deleteBtn}
                activeOpacity={0.6}
              >
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </TouchableOpacity>
            </Animated.View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle" size={64} color="#6366F1" />
              <Text style={styles.emptyTitle}>All Clear!</Text>
              <Text style={styles.emptySubtitle}>
                Create a new objective to get started
              </Text>
            </View>
          }
        />

        {/* PREMIUM FAB */}
        <TouchableOpacity
          style={styles.plusFab}
          onPress={() => navigation.navigate("AddTask", { addTask })}
          activeOpacity={0.8}
        >
          <Ionicons name="add-sharp" size={40} color="#FFF" />
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: "#020617" },
  container: { 
    flex: 1, 
    paddingHorizontal: 20, 
    zIndex: 10,
    // 👇 ADD THIS LINE: It perfectly calculates the notch/status bar height
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 15 : 15, 
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
  header: { marginBottom: 28 },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
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
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.3)",
    alignItems: "center",
  },
  badgeText: { fontSize: 18, fontWeight: "900", color: "#818CF8" },
  badgeLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
    marginTop: 2,
  },
  statsCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.2)",
    overflow: "hidden",
  },
  statsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  statsLabel: { color: "#94A3B8", fontWeight: "600", fontSize: 14 },
  statsValue: { color: "#818CF8", fontWeight: "900", fontSize: 28 },
  progressContainer: { gap: 8 },
  barBg: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: { height: "100%", backgroundColor: "#6366F1", borderRadius: 4 },
  progressText: { fontSize: 12, color: "#94A3B8", fontWeight: "500" },
  filterSection: { marginBottom: 24 },
  filterLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6366F1",
    marginBottom: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  filterBar: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 6,
    borderRadius: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.15)",
  },
  filterTab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    flexDirection: "row",
    gap: 6,
  },
  activeTab: {
    backgroundColor: "rgba(99, 102, 241, 0.25)",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.4)",
  },
  filterIcon: { marginRight: 4 },
  filterTabText: { color: "#64748B", fontWeight: "700", fontSize: 12 },
  activeTabText: { color: "#F8FAFC" },
  listContent: { paddingBottom: 120 },
  taskNode: {
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 18,
    borderRadius: 18,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#6366F1",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    borderRightColor: "rgba(255,255,255,0.04)",
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  completedNode: {
    borderLeftColor: "#10B981",
    opacity: 0.5,
    backgroundColor: "rgba(16, 185, 129, 0.05)",
  },
  nodeContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(99, 102, 241, 0.1)",
    marginTop: 2,
  },
  checkboxCompleted: { backgroundColor: "#10B981", borderColor: "#10B981" },
  checkboxInner: {
    width: 6,
    height: 6,
    borderRadius: 2,
    backgroundColor: "#6366F1",
  },
  nodeText: { flex: 1 },
  nodeTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#F8FAFC",
    lineHeight: 22,
  },
  nodeDesc: { fontSize: 13, color: "#94A3B8", marginTop: 6, fontWeight: "400" },
  strike: { textDecorationLine: "line-through", color: "#64748B" },
  deleteBtn: { padding: 8, marginLeft: 12 },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 80,
    gap: 16,
  },
  emptyTitle: { fontSize: 24, fontWeight: "900", color: "#F8FAFC" },
  emptySubtitle: { fontSize: 14, color: "#94A3B8", fontWeight: "500" },
  plusFab: {
    position: "absolute",
    bottom: 60,
    right: 24,
    backgroundColor: "#6366F1",
    width: 68,
    height: 68,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    elevation: 25,
    shadowColor: "#6366F1",
    shadowOpacity: 0.7,
    shadowRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
});
