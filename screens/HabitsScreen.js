import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AppIcon, AppIconButton, SectionBadge } from "../components/AppIcon";
import {
  completeTaskAndGenerateNext,
  getHabitInsights,
  getHabitsWithDetails,
  removeHabit,
  setTaskStatus,
} from "../database";
import { buildHabitConsistencySeries } from "../utils/analytics";
import { cancelTaskNotifications, scheduleSingleNotification } from "../utils/taskNotifications";

const getLocalDayKey = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
};

const getHabitAvailability = (habit) => {
  const dueDayKey = getLocalDayKey(habit?.due_date);
  const todayKey = getLocalDayKey(new Date());

  if (!dueDayKey || !todayKey) {
    return {
      canCompleteToday: false,
      tone: "neutral",
      message: "Set a valid schedule before this habit can be completed.",
    };
  }

  if (dueDayKey < todayKey) {
    return {
      canCompleteToday: false,
      tone: "missed",
      message: "Missed earlier. Wait for the next scheduled check-in.",
    };
  }

  if (dueDayKey > todayKey) {
    return {
      canCompleteToday: false,
      tone: "upcoming",
      message: "Upcoming habit. You can complete it on its scheduled day.",
    };
  }

  return {
    canCompleteToday: true,
    tone: "today",
    message: "Ready for today.",
  };
};

function HabitBars({ color, data }) {
  const maxValue = Math.max(...data.map((item) => item.value), 1);
  return (
    <View style={styles.chartRow}>
      {data.map((item) => (
        <View key={item.day} style={styles.chartBarWrap}>
          <View
            style={[
              styles.chartBar,
              { height: Math.max(12, (item.value / maxValue) * 56), backgroundColor: color },
            ]}
          />
          <Text style={styles.chartLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function HabitCard({ habit, onDelete, onEdit, onToggleDone, theme }) {
  const availability = getHabitAvailability(habit);
  const dueLabel = habit.due_date
    ? new Date(habit.due_date).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "No next reminder";

  return (
    <View style={[styles.habitCard, { borderColor: `${habit.category_color || theme.accent}55` }]}>
      <View style={styles.cardTop}>
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{habit.recurrence}</Text>
          </View>
          {habit.category_name ? (
            <View style={[styles.badge, { backgroundColor: `${habit.category_color || theme.accent}22` }]}>
              <Text style={[styles.badgeText, { color: habit.category_color || theme.accentSoft }]}>
                {habit.category_name}
              </Text>
            </View>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={() => onToggleDone(habit)}
          activeOpacity={availability.canCompleteToday ? 0.85 : 1}
          disabled={!availability.canCompleteToday}
        >
          <AppIcon
            name={habit.status === "Done" ? "checkmark-done" : "radio-button-off"}
            size={16}
            theme={theme}
            tone={
              habit.status === "Done"
                ? "success"
                : availability.canCompleteToday
                  ? "neutral"
                  : "muted"
            }
          />
        </TouchableOpacity>
      </View>

      <Text style={styles.habitTitle}>{habit.title}</Text>
      {habit.description ? <Text style={styles.metaText}>{habit.description}</Text> : null}
      <Text style={styles.metaText}>Next check-in: {dueLabel}</Text>
      <Text
        style={[
          styles.availabilityText,
          availability.tone === "today"
            ? styles.availabilityToday
            : availability.tone === "missed"
              ? styles.availabilityMissed
              : styles.availabilityUpcoming,
        ]}
      >
        {availability.message}
      </Text>

      <View style={styles.statsRow}>
        <View style={styles.statPill}>
          <Text style={styles.statValue}>{habit.total_completions || 0}</Text>
          <Text style={styles.statLabel}>total</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statValue}>{habit.current_streak || 0}</Text>
          <Text style={styles.statLabel}>current streak</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statValue}>{habit.longest_streak || 0}</Text>
          <Text style={styles.statLabel}>best streak</Text>
        </View>
      </View>

      {habit.last_completed_at ? (
        <Text style={styles.metaText}>
          Last completed: {new Date(habit.last_completed_at).toLocaleString()}
        </Text>
      ) : (
        <Text style={styles.metaText}>No completions yet.</Text>
      )}

      <View style={styles.cardButtons}>
        <AppIconButton
          accessibilityLabel="Edit habit"
          iconName="pencil"
          onPress={() => onEdit(habit)}
          theme={theme}
          tone="accent"
        />
        <AppIconButton
          accessibilityLabel="Complete habit"
          disabled={!availability.canCompleteToday}
          iconName="checkmark-done"
          onPress={() => onToggleDone(habit)}
          theme={theme}
          tone="success"
        />
        <AppIconButton
          accessibilityLabel="Delete habit"
          iconName="trash-outline"
          onPress={() => onDelete(habit.id)}
          theme={theme}
          tone="danger"
        />
      </View>
    </View>
  );
}

export default function HabitsScreen({ bottomInset, isActive, onOpenPlanner, theme }) {
  const insets = useSafeAreaInsets();
  const [habits, setHabits] = useState([]);
  const [insights, setInsights] = useState(null);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadHabits = useCallback(() => {
    setHabits(getHabitsWithDetails());
    setInsights(getHabitInsights());
  }, []);

  useEffect(() => {
    if (isActive) {
      loadHabits();
    }
  }, [isActive, loadHabits]);

  const filteredHabits = useMemo(() => {
    if (!search.trim()) {
      return habits;
    }

    const query = search.trim().toLowerCase();
    return habits.filter((habit) =>
      [habit.title, habit.description, habit.category_name]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [habits, search]);

  const consistencySeries = useMemo(
    () => buildHabitConsistencySeries(insights?.weekly_completion || []),
    [insights],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    loadHabits();
    setRefreshing(false);
  };

  const onToggleDone = async (habit) => {
    const availability = getHabitAvailability(habit);
    if (!availability.canCompleteToday) {
      Alert.alert("Not available", availability.message);
      return;
    }

    if (habit.status === "Done") {
      const updatedHabit = setTaskStatus(habit.id, "Todo");
      if (updatedHabit?.due_date) {
        await scheduleSingleNotification({ ...updatedHabit, completed: 0 });
      }
    } else {
      await cancelTaskNotifications(habit.id);
      completeTaskAndGenerateNext(habit.id);
    }
    loadHabits();
  };

  const onDelete = (habitId) => {
    Alert.alert("Delete habit", "This will remove the habit and its local reminders.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await cancelTaskNotifications(habitId);
          removeHabit(habitId);
          loadHabits();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={theme?.gradient?.[0] || "#07111F"} />
      <FlatList
        data={filteredHabits}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <HabitCard habit={item} onDelete={onDelete} onEdit={onOpenPlanner} onToggleDone={onToggleDone} theme={theme} />
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <SectionBadge iconName="infinite-outline" label="Routine loop" theme={theme} />
            <Text style={[styles.eyebrow, { color: theme?.accentSoft || "#7DD3FC" }]}>Routine focus</Text>
            <Text style={[styles.title, { color: theme?.text || "#F8FAFC" }]}>Habit Tracker</Text>
            <Text style={[styles.subtitle, { color: theme?.muted || "#94A3B8" }]}>
              Recurring routines live here. Complete one and the next check-in is created automatically.
            </Text>

            <View style={styles.metricRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>{insights?.total_habits || 0}</Text>
                <Text style={styles.metricLabel}>habits</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>{insights?.active_streak_habits || 0}</Text>
                <Text style={styles.metricLabel}>on streak</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>{insights?.total_completions || 0}</Text>
                <Text style={styles.metricLabel}>completions</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>This week</Text>
              <HabitBars color={theme?.accent || "#2563EB"} data={consistencySeries} />
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Search habits and categories"
              placeholderTextColor="#64748B"
              value={search}
              onChangeText={setSearch}
            />
          </View>
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No habits yet.</Text>}
        contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(bottomInset, insets.bottom + 24) }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme?.accent || "#2563EB"} />
        }
      />

      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 84 }]}
        onPress={() => onOpenPlanner(null)}
      >
        <AppIcon name="add" size={22} theme={theme} tone="accent" active style={styles.fabIcon} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingTop: 18, gap: 14 },
  header: { gap: 16, marginBottom: 8 },
  eyebrow: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.1 },
  title: { fontSize: 32, fontWeight: "900" },
  subtitle: { fontSize: 15, lineHeight: 22 },
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
  sectionTitle: { color: "#F8FAFC", fontSize: 20, fontWeight: "800" },
  searchInput: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: "rgba(15,23,42,0.76)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.14)",
    color: "#F8FAFC",
    paddingHorizontal: 16,
    fontSize: 15,
  },
  habitCard: {
    backgroundColor: "rgba(15,23,42,0.76)",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    gap: 10,
    marginBottom: 12,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, flex: 1 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  badgeText: { color: "#C8D6E5", fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  habitTitle: { color: "#F8FAFC", fontSize: 17, fontWeight: "800", lineHeight: 24 },
  metaText: { color: "#94A3B8", fontSize: 12, lineHeight: 18 },
  availabilityText: { fontSize: 12, fontWeight: "700" },
  availabilityToday: { color: "#A7F3D0" },
  availabilityUpcoming: { color: "#7DD3FC" },
  availabilityMissed: { color: "#FCA5A5" },
  statsRow: { flexDirection: "row", gap: 8 },
  statPill: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
  },
  statValue: { color: "#F8FAFC", fontSize: 18, fontWeight: "900" },
  statLabel: { color: "#8FA5BF", fontSize: 11, fontWeight: "700", marginTop: 4 },
  cardButtons: { flexDirection: "row", gap: 10 },
  emptyText: { color: "#94A3B8", textAlign: "center", paddingVertical: 28 },
  fab: {
    position: "absolute",
    right: 24,
    width: 68,
    height: 68,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(7, 17, 31, 0.42)",
    borderWidth: 1,
    borderColor: "rgba(125, 211, 252, 0.18)",
    shadowColor: "#020617",
    shadowOpacity: 0.42,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 16,
  },
  fabIcon: { transform: [{ scale: 1.08 }] },
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
});
