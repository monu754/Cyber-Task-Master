import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AppIcon, AppIconButton, SectionBadge } from "../components/AppIcon";
import {
  completeTaskAndGenerateNext,
  getTasksWithDetails,
  removeTask,
  setTaskStatus,
} from "../database";
import { getThemeTextStyle } from "../utils/preferences";
import { cancelTaskNotifications, scheduleSingleNotification } from "../utils/taskNotifications";

const VIEW_OPTIONS = [
  { key: "list", label: "List" },
  { key: "calendar", label: "Calendar" },
  { key: "history", label: "History" },
];
const STATUS_OPTIONS = ["all", "Todo", "In Progress", "Done"];
const PRIORITY_OPTIONS = ["all", "Low", "Medium", "High"];
const PAGE_SIZE = 12;

const isTaskOverdue = (task) => {
  if (!task?.due_date || task.status === "Done") {
    return false;
  }

  const dueDate = new Date(task.due_date);
  if (Number.isNaN(dueDate.getTime())) {
    return false;
  }

  return dueDate.getTime() < Date.now();
};

const getTaskSortWeight = (task) => {
  const overdue = isTaskOverdue(task);
  const hasDueDate = Boolean(task?.due_date);
  const dueTime = hasDueDate ? new Date(task.due_date).getTime() : Number.MAX_SAFE_INTEGER;
  const safeDueTime = Number.isNaN(dueTime) ? Number.MAX_SAFE_INTEGER : dueTime;

  return {
    overdueRank: overdue ? 0 : 1,
    undatedRank: hasDueDate ? 0 : 1,
    dueTime: safeDueTime,
    doneRank: task.status === "Done" ? 1 : 0,
    idRank: -(Number(task.id) || 0),
  };
};

const compareTasksByUrgency = (leftTask, rightTask) => {
  const left = getTaskSortWeight(leftTask);
  const right = getTaskSortWeight(rightTask);

  if (left.overdueRank !== right.overdueRank) {
    return left.overdueRank - right.overdueRank;
  }
  if (left.doneRank !== right.doneRank) {
    return left.doneRank - right.doneRank;
  }
  if (left.undatedRank !== right.undatedRank) {
    return left.undatedRank - right.undatedRank;
  }
  if (left.dueTime !== right.dueTime) {
    return left.dueTime - right.dueTime;
  }

  return left.idRank - right.idRank;
};

const groupBy = (items, getKey) =>
  items.reduce((accumulator, item) => {
    const key = getKey(item);
    if (!accumulator[key]) {
      accumulator[key] = [];
    }
    accumulator[key].push(item);
    return accumulator;
  }, {});

function SegmentedOption({ active, label, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.segmentedOption, active && styles.segmentedOptionActive]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <Text style={[styles.segmentedOptionText, active && styles.segmentedOptionTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function FilterChip({ active, label, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <Text
        style={[styles.filterChipText, active && styles.filterChipTextActive]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function HorizontalChips({ children }) {
  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      directionalLockEnabled
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipsRow}
    >
      {children}
    </ScrollView>
  );
}

function FilterSection({ children, title }) {
  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterSectionTitle}>{title}</Text>
      <HorizontalChips>{children}</HorizontalChips>
    </View>
  );
}

function SectionTitle({ action, theme, title }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, getThemeTextStyle(theme, "section")]}>{title}</Text>
      {action}
    </View>
  );
}

function TaskCard({ item, onDelete, onEdit, onToggleDone, onUpdateStatus, theme }) {
  const isOverdue = isTaskOverdue(item);
  const dueLabel = item.due_date
    ? new Date(item.due_date).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const completedLabel =
    item.status === "Done" && item.updated_at
      ? new Date(item.updated_at).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  return (
    <View
      style={[
        styles.taskCard,
        { borderColor: isOverdue ? "rgba(248, 113, 113, 0.6)" : `${item.category_color || theme.accent}55` },
        isOverdue && styles.taskCardOverdue,
      ]}
    >
      <View style={styles.cardTop}>
        <View style={styles.badgeRow}>
          {isOverdue ? (
            <View style={styles.overdueBadge}>
              <Text style={styles.overdueBadgeText}>Overdue</Text>
            </View>
          ) : null}
          {item.category_name ? (
            <View
              style={[
                styles.badge,
                { backgroundColor: `${item.category_color || theme.accent}22` },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: item.category_color || theme.accentSoft },
                ]}
              >
                {item.category_name}
              </Text>
            </View>
          ) : null}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.priority}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => onToggleDone(item)} activeOpacity={0.85}>
          <AppIcon
            name={item.status === "Done" ? "checkmark-done" : "radio-button-off"}
            size={16}
            theme={theme}
            tone={item.status === "Done" ? "success" : "neutral"}
          />
        </TouchableOpacity>
      </View>

      <Text style={[styles.taskTitle, getThemeTextStyle(theme, "section")]}>{item.title}</Text>
      {item.description ? (
        <Text style={styles.taskDescription} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}

      <Text style={styles.metaText}>Status: {item.status}</Text>
      {dueLabel ? <Text style={styles.metaText}>Deadline: {dueLabel}</Text> : null}
      {completedLabel ? <Text style={styles.metaText}>Completed: {completedLabel}</Text> : null}
      {isOverdue ? <Text style={styles.overdueText}>Action needed: this task is past due.</Text> : null}
      {item.hasBlockingDependency ? (
        <Text style={[styles.metaText, styles.alertText]}>Waiting on another task to finish first.</Text>
      ) : null}
      {item.dependencies?.length ? (
        <Text style={styles.metaText}>
          Depends on: {item.dependencies.map((dependency) => dependency.depends_on_title).join(", ")}
        </Text>
      ) : null}

      <HorizontalChips>
        {["Todo", "In Progress", "Done"].map((status) => (
          <FilterChip
            key={status}
            label={status}
            active={item.status === status}
            onPress={() => onUpdateStatus(item, status)}
          />
        ))}
      </HorizontalChips>

      <View style={styles.cardButtons}>
        <AppIconButton
          accessibilityLabel="Edit task"
          iconName="pencil"
          onPress={() => onEdit(item)}
          theme={theme}
          tone="accent"
        />
        <AppIconButton
          accessibilityLabel="Delete task"
          iconName="trash-outline"
          onPress={() => onDelete(item.id)}
          theme={theme}
          tone="danger"
        />
      </View>
    </View>
  );
}

export default function TasksScreen({ bottomInset, dataVersion, isActive, onOpenPlanner, theme }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 390;
  const isVeryCompact = width < 360;
  const isSmallScreen = width < 350;
  const searchPlaceholder = isVeryCompact
    ? "Search tasks"
    : isCompact
      ? "Search tasks and notes"
      : "Search tasks, notes, and categories";
  const [tasks, setTasks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [viewMode, setViewMode] = useState("list");
  const [search, setSearch] = useState("");
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [filters, setFilters] = useState({
    category: "all",
    status: "all",
    priority: "all",
  });

  const loadScreenData = useCallback(() => {
    setTasks(getTasksWithDetails());
  }, []);

  useEffect(() => {
    if (isActive) {
      loadScreenData();
    }
  }, [dataVersion, isActive, loadScreenData]);

  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    if (search.trim()) {
      const query = search.trim().toLowerCase();
      result = result.filter((task) =>
        [task.title, task.description, task.category_name]
          .join(" ")
          .toLowerCase()
          .includes(query),
      );
    }

    if (filters.category !== "all") {
      result = result.filter((task) => task.category_name === filters.category);
    }
    if (filters.status !== "all") {
      result = result.filter((task) => task.status === filters.status);
    }
    if (filters.priority !== "all") {
      result = result.filter((task) => task.priority === filters.priority);
    }

    return result.sort(compareTasksByUrgency);
  }, [filters, search, tasks]);

  const categoryOptions = useMemo(
    () => ["all", ...new Set(tasks.map((task) => task.category_name).filter(Boolean))],
    [tasks],
  );
  const activeTasks = useMemo(
    () => filteredTasks.filter((task) => task.status !== "Done"),
    [filteredTasks],
  );
  const pagedTasks = useMemo(
    () => activeTasks.slice(0, visibleCount),
    [activeTasks, visibleCount],
  );
  const calendarGroups = useMemo(
    () =>
      groupBy(
        activeTasks.filter((task) => task.due_date),
        (task) => new Date(task.due_date).toDateString(),
      ),
    [activeTasks],
  );
  const historyTasks = useMemo(
    () =>
      [...filteredTasks]
        .filter((task) => task.status === "Done")
        .sort((leftTask, rightTask) => new Date(rightTask.updated_at) - new Date(leftTask.updated_at)),
    [filteredTasks],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    loadScreenData();
    setRefreshing(false);
  };

  const onToggleDone = async (task) => {
    if (task.status === "Done") {
      const updatedTask = setTaskStatus(task.id, "Todo");
      if (updatedTask?.due_date) {
        await scheduleSingleNotification({ ...updatedTask, completed: 0 });
      }
    } else {
      await cancelTaskNotifications(task.id);
      completeTaskAndGenerateNext(task.id);
    }
    loadScreenData();
  };

  const onUpdateStatus = async (task, status) => {
    const updatedTask = setTaskStatus(task.id, status);
    if (status === "Done") {
      await cancelTaskNotifications(task.id);
    } else if (updatedTask?.due_date) {
      await scheduleSingleNotification({ ...updatedTask, completed: 0 });
    }
    loadScreenData();
  };

  const onDelete = (taskId) => {
    Alert.alert("Delete task", "This will remove the task and its linked local records.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await cancelTaskNotifications(taskId);
          removeTask(taskId);
          loadScreenData();
        },
      },
    ]);
  };

  const renderTaskCard = ({ item }) => (
    <TaskCard
      item={item}
      onDelete={onDelete}
      onEdit={onOpenPlanner}
      onToggleDone={onToggleDone}
      onUpdateStatus={onUpdateStatus}
      theme={theme}
    />
  );

  const listHeader = (
    <View style={styles.header}>
      <SectionBadge iconName="grid-outline" label="Task system" theme={theme} />
      <Text style={[styles.eyebrow, getThemeTextStyle(theme, "eyebrow"), { color: theme?.accentSoft || "#7DD3FC" }]}>Workspace</Text>
      <Text
        style={[
          styles.title,
          isCompact && styles.titleCompact,
          getThemeTextStyle(theme, "title"),
          { color: theme?.text || "#F8FAFC" },
        ]}
      >
        Task Library
      </Text>
      <Text
        style={[
          styles.subtitle,
          isCompact && styles.subtitleCompact,
          getThemeTextStyle(theme, "subtitle"),
          { color: theme?.muted || "#94A3B8" },
        ]}
      >
        One-time work lives here. Recurring routines now have their own habit tracker.
      </Text>

      <View style={[styles.searchRow, isSmallScreen && styles.searchRowTight]}>
        <TextInput
          style={styles.searchInput}
          placeholder={searchPlaceholder}
          placeholderTextColor="#64748B"
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity
          style={[styles.filtersButton, isVeryCompact && styles.filtersButtonCompact]}
          onPress={() => setIsFilterModalVisible(true)}
          activeOpacity={0.9}
        >
          <AppIcon
            name="options-outline"
            size={15}
            theme={theme}
            tone="accent"
            style={styles.filterIcon}
          />
          {!isVeryCompact ? <Text style={styles.filtersButtonText}>Filters</Text> : null}
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.segmentedWrap,
          isCompact && styles.segmentedWrapCompact,
          isSmallScreen && styles.segmentedWrapSmall,
        ]}
      >
        {VIEW_OPTIONS.map((item) => (
          <SegmentedOption
            key={item.key}
            label={
              isVeryCompact
                ? item.key === "calendar"
                  ? "Cal"
                  : item.key === "history"
                    ? "Past"
                    : item.label
                : item.label
            }
            active={viewMode === item.key}
            onPress={() => setViewMode(item.key)}
          />
        ))}
      </View>
    </View>
  );

  const renderCalendarView = () => (
    <View style={styles.viewSection}>
      <Text style={[styles.boardIntro, getThemeTextStyle(theme, "body")]}>
        Calendar view groups tasks by due date so users can see what is coming up each day.
      </Text>
      {Object.keys(calendarGroups).length === 0 ? (
        <Text style={styles.metaText}>No scheduled tasks yet.</Text>
      ) : (
        Object.entries(calendarGroups)
          .sort(([leftDay], [rightDay]) => new Date(leftDay) - new Date(rightDay))
          .map(([day, dayTasks]) => (
            <View key={day} style={styles.calendarGroup}>
              <Text style={[styles.calendarTitle, getThemeTextStyle(theme, "section")]}>{day}</Text>
              {[...dayTasks].sort(compareTasksByUrgency).map((task) => (
                <TaskCard
                  key={task.id}
                  item={task}
                  onDelete={onDelete}
                  onEdit={onOpenPlanner}
                  onToggleDone={onToggleDone}
                  onUpdateStatus={onUpdateStatus}
                  theme={theme}
                />
              ))}
            </View>
          ))
      )}
    </View>
  );

  const renderHistoryView = () => (
    <View style={styles.viewSection}>
      <Text style={[styles.boardIntro, getThemeTextStyle(theme, "body")]}>
        History keeps every completed one-time task in one place so finished work is easy to revisit.
      </Text>
      {historyTasks.length === 0 ? (
        <Text style={styles.metaText}>No completed tasks match these filters yet.</Text>
      ) : (
        historyTasks.map((task) => (
          <TaskCard
            key={task.id}
            item={task}
            onDelete={onDelete}
            onEdit={onOpenPlanner}
            onToggleDone={onToggleDone}
            onUpdateStatus={onUpdateStatus}
            theme={theme}
          />
        ))
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={theme?.gradient?.[0] || "#07111F"} />
      {viewMode === "list" ? (
        <FlatList
          data={pagedTasks}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderTaskCard}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={<Text style={styles.emptyText}>No matching tasks.</Text>}
          ListFooterComponent={
            activeTasks.length > visibleCount ? (
              <TouchableOpacity
                style={styles.loadMoreButton}
                onPress={() => setVisibleCount((current) => current + PAGE_SIZE)}
              >
                <Text style={styles.loadMoreText}>Load more</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ height: bottomInset }} />
            )
          }
          contentContainerStyle={[
            styles.listContent,
            isCompact && styles.listContentCompact,
            isSmallScreen && styles.listContentSmall,
            { paddingBottom: bottomInset },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme?.accent || "#2563EB"}
            />
          }
        />
      ) : (
        <ScrollView
          style={styles.container}
          contentContainerStyle={[
            styles.listContent,
            isCompact && styles.listContentCompact,
            { paddingBottom: Math.max(bottomInset, insets.bottom + 24) },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme?.accent || "#2563EB"}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {listHeader}
          {viewMode === "calendar" ? renderCalendarView() : null}
          {viewMode === "history" ? renderHistoryView() : null}
        </ScrollView>
      )}

      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 84 }]}
        onPress={() => onOpenPlanner(null)}
      >
        <AppIcon name="add" size={22} theme={theme} tone="accent" active style={styles.fabIcon} />
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent
        visible={isFilterModalVisible}
        onRequestClose={() => setIsFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <SectionTitle
              title="Filters"
              theme={theme}
              action={
                <TouchableOpacity onPress={() => setIsFilterModalVisible(false)}>
                  <Text style={styles.linkText}>Done</Text>
                </TouchableOpacity>
              }
            />

            <FilterSection title="Category">
              {categoryOptions.map((item) => (
                <FilterChip
                  key={item}
                  label={item}
                  active={filters.category === item}
                  onPress={() => setFilters((current) => ({ ...current, category: item }))}
                />
              ))}
            </FilterSection>

            <FilterSection title="Status">
              {STATUS_OPTIONS.map((item) => (
                <FilterChip
                  key={item}
                  label={item}
                  active={filters.status === item}
                  onPress={() => setFilters((current) => ({ ...current, status: item }))}
                />
              ))}
            </FilterSection>

            <FilterSection title="Priority">
              {PRIORITY_OPTIONS.map((item) => (
                <FilterChip
                  key={item}
                  label={item}
                  active={filters.priority === item}
                  onPress={() => setFilters((current) => ({ ...current, priority: item }))}
                />
              ))}
            </FilterSection>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalSecondaryButton}
                onPress={() =>
                  setFilters({
                    category: "all",
                    status: "all",
                    priority: "all",
                  })
                }
              >
                <Text style={styles.modalSecondaryText}>Clear all</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalPrimaryButton}
                onPress={() => setIsFilterModalVisible(false)}
              >
                <Text style={styles.modalPrimaryText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingTop: 18, gap: 14 },
  listContentCompact: { paddingHorizontal: 16, paddingTop: 16 },
  listContentSmall: { paddingHorizontal: 14, paddingTop: 14 },
  header: { gap: 16, marginBottom: 8 },
  eyebrow: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.1 },
  title: { fontSize: 32, fontWeight: "900" },
  titleCompact: { fontSize: 28 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  subtitleCompact: { fontSize: 14, lineHeight: 20 },
  searchInput: {
    flex: 1,
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: "rgba(15,23,42,0.76)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.14)",
    color: "#F8FAFC",
    paddingHorizontal: 16,
    fontSize: 15,
  },
  searchRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  searchRowTight: { gap: 8 },
  filtersButton: {
    minHeight: 54,
    borderRadius: 18,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.16)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  filtersButtonCompact: {
    width: 54,
    paddingHorizontal: 0,
  },
  filtersButtonText: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "800",
  },
  filterIcon: { transform: [{ scale: 0.86 }] },
  segmentedWrap: {
    flexDirection: "row",
    backgroundColor: "rgba(15,23,42,0.64)",
    borderRadius: 18,
    padding: 5,
    gap: 6,
  },
  segmentedWrapCompact: {
    gap: 4,
    padding: 4,
  },
  segmentedWrapSmall: { gap: 3, padding: 3 },
  segmentedOption: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentedOptionActive: {
    backgroundColor: "rgba(37,99,235,0.26)",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.45)",
  },
  segmentedOptionText: {
    color: "#9FB3C8",
    fontSize: 14,
    fontWeight: "700",
  },
  segmentedOptionTextActive: {
    color: "#F8FAFC",
  },
  filterSection: { gap: 8 },
  filterSectionTitle: {
    color: "#B7C7D8",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  chipsRow: { gap: 10, paddingRight: 18, alignItems: "center" },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.16)",
    maxWidth: 160,
  },
  filterChipActive: {
    backgroundColor: "rgba(37,99,235,0.18)",
    borderColor: "rgba(96,165,250,0.6)",
  },
  filterChipText: {
    color: "#B8C6D5",
    fontSize: 13,
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: "#F8FAFC",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  sectionTitle: { color: "#F8FAFC", fontSize: 20, fontWeight: "800", flex: 1, flexShrink: 1 },
  linkText: { color: "#7DD3FC", fontSize: 13, fontWeight: "700" },
  taskCard: {
    backgroundColor: "rgba(15,23,42,0.76)",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    gap: 10,
    marginBottom: 12,
  },
  taskCardOverdue: {
    backgroundColor: "rgba(57, 17, 24, 0.82)",
    shadowColor: "#7F1D1D",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, flex: 1 },
  overdueBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(239, 68, 68, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.38)",
  },
  overdueBadgeText: {
    color: "#FECACA",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  badgeText: { color: "#C8D6E5", fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  taskTitle: { color: "#F8FAFC", fontSize: 17, fontWeight: "800", lineHeight: 24, flexShrink: 1 },
  taskDescription: { color: "#94A3B8", fontSize: 13, lineHeight: 20, flexShrink: 1 },
  metaText: { color: "#94A3B8", fontSize: 12, lineHeight: 18, flexShrink: 1 },
  overdueText: { color: "#FCA5A5", fontSize: 12, lineHeight: 18, fontWeight: "700" },
  alertText: { color: "#FCA5A5" },
  cardButtons: { flexDirection: "row", gap: 10 },
  emptyText: { color: "#94A3B8", textAlign: "center", paddingVertical: 28 },
  viewSection: { gap: 16 },
  boardIntro: { color: "#B5C6D6", fontSize: 14, lineHeight: 21 },
  calendarGroup: { gap: 10 },
  calendarTitle: { color: "#F8FAFC", fontSize: 18, fontWeight: "800", flexShrink: 1 },
  loadMoreButton: {
    alignSelf: "center",
    minWidth: 140,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "rgba(37,99,235,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  loadMoreText: { color: "#F8FAFC", fontWeight: "800" },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.72)",
    justifyContent: "flex-end",
  },
  modalCard: {
    maxHeight: "82%",
    backgroundColor: "#0F1C2D",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    gap: 16,
    borderTopWidth: 1,
    borderColor: "rgba(148,163,184,0.18)",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  modalSecondaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalPrimaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: "rgba(37,99,235,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSecondaryText: {
    color: "#CBD5E1",
    fontWeight: "800",
    fontSize: 14,
  },
  modalPrimaryText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
});
