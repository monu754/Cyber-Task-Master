import { Ionicons } from "@expo/vector-icons";
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
import {
  completeTaskAndGenerateNext,
  getActiveTimer,
  getProjects,
  getTasksWithDetails,
  getTags,
  getWorkspaces,
  removeTask,
  setTaskStatus,
  startTaskTimer,
  stopActiveTimer,
} from "../database";
import { minutesToLabel } from "../utils/analytics";
import { loadSavedFilters, saveSavedFilters } from "../utils/preferences";
import { cancelTaskNotifications, scheduleSingleNotification } from "../utils/taskNotifications";

const VIEW_OPTIONS = [
  { key: "list", label: "List" },
  { key: "board", label: "Board" },
  { key: "calendar", label: "Calendar" },
  { key: "timeline", label: "Timeline" },
];
const STATUS_OPTIONS = ["all", "Todo", "In Progress", "Done"];
const PRIORITY_OPTIONS = ["all", "Low", "Medium", "High"];
const PAGE_SIZE = 12;

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

function SectionTitle({ action, title }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

function TaskCard({
  item,
  onDelete,
  onEdit,
  onStartTimer,
  onToggleDone,
  onUpdateStatus,
  timerTaskId,
  theme,
}) {
  const isActiveTimer = timerTaskId === item.id;
  const dueLabel = item.due_date
    ? new Date(item.due_date).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "No due date";

  return (
    <View style={[styles.taskCard, { borderColor: `${item.project_color || theme.accent}55` }]}>
      <View style={styles.cardTop}>
        <View style={styles.badgeRow}>
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
            <Text style={styles.badgeText}>{item.project_name || "Project"}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.priority}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => onToggleDone(item)} activeOpacity={0.85}>
          <Ionicons
            name={item.status === "Done" ? "checkmark-circle" : "ellipse-outline"}
            size={24}
            color={item.status === "Done" ? "#34D399" : "#94A3B8"}
          />
        </TouchableOpacity>
      </View>

      <Text style={styles.taskTitle}>{item.title}</Text>
      {item.description ? (
        <Text style={styles.taskDescription} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}

      <Text style={styles.metaText}>
        {item.status} | {dueLabel} | {minutesToLabel(item.tracked_minutes || 0)} tracked
      </Text>
      {item.workspace_name ? (
        <Text style={styles.metaText}>Workspace: {item.workspace_name}</Text>
      ) : null}
      {item.tags?.length ? (
        <Text style={styles.metaText}>Tags: {item.tags.map((tag) => tag.name).join(", ")}</Text>
      ) : null}
      {item.hasBlockingDependency ? (
        <Text style={[styles.metaText, styles.alertText]}>Blocked by another task</Text>
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
        <TouchableOpacity style={styles.iconButton} onPress={() => onEdit(item)}>
          <Ionicons name="create-outline" size={18} color="#7DD3FC" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={() => onStartTimer(item)}>
          <Ionicons
            name={isActiveTimer ? "pause-outline" : "play-outline"}
            size={18}
            color="#A7F3D0"
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={() => onDelete(item.id)}>
          <Ionicons name="trash-outline" size={18} color="#FCA5A5" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function TasksScreen({ bottomInset, isActive, onOpenPlanner, theme }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 390;
  const isVeryCompact = width < 360;
  const searchPlaceholder = isVeryCompact
    ? "Search tasks"
    : isCompact
      ? "Search tasks, projects, notes"
      : "Search tasks, notes, projects, workspaces";
  const [tasks, setTasks] = useState([]);
  const [savedFilters, setSavedFilters] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tags, setTags] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [activeTimer, setActiveTimer] = useState(null);
  const [viewMode, setViewMode] = useState("list");
  const [search, setSearch] = useState("");
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [filters, setFilters] = useState({
    status: "all",
    priority: "all",
    workspaceId: "all",
    projectId: "all",
    tag: "all",
  });

  const loadScreenData = useCallback(async () => {
    setTasks(getTasksWithDetails());
    setWorkspaces(getWorkspaces());
    setProjects(getProjects());
    setTags(getTags());
    setActiveTimer(getActiveTimer());
    setSavedFilters(await loadSavedFilters());
  }, []);

  useEffect(() => {
    if (isActive) {
      loadScreenData();
    }
  }, [isActive, loadScreenData]);

  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    if (search.trim()) {
      const query = search.trim().toLowerCase();
      result = result.filter((task) =>
        [task.title, task.description, task.project_name, task.workspace_name, task.category_name]
          .join(" ")
          .toLowerCase()
          .includes(query),
      );
    }

    if (filters.status !== "all") {
      result = result.filter((task) => task.status === filters.status);
    }
    if (filters.priority !== "all") {
      result = result.filter((task) => task.priority === filters.priority);
    }
    if (filters.workspaceId !== "all") {
      result = result.filter((task) => task.workspace_id === filters.workspaceId);
    }
    if (filters.projectId !== "all") {
      result = result.filter((task) => task.project_id === filters.projectId);
    }
    if (filters.tag !== "all") {
      result = result.filter((task) => task.tags.some((tag) => tag.name === filters.tag));
    }

    return result;
  }, [filters, search, tasks]);

  const pagedTasks = useMemo(
    () => filteredTasks.slice(0, visibleCount),
    [filteredTasks, visibleCount],
  );
  const boardGroups = useMemo(() => groupBy(filteredTasks, (task) => task.status), [filteredTasks]);
  const calendarGroups = useMemo(
    () =>
      groupBy(
        filteredTasks.filter((task) => task.due_date),
        (task) => new Date(task.due_date).toDateString(),
      ),
    [filteredTasks],
  );
  const timelineTasks = useMemo(
    () =>
      [...filteredTasks]
        .filter((task) => task.due_date)
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date)),
    [filteredTasks],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadScreenData();
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

  const onStartTimer = (task) => {
    if (activeTimer?.task_id === task.id) {
      stopActiveTimer();
    } else {
      startTaskTimer(task.id);
    }
    loadScreenData();
  };

  const onSaveCurrentFilter = async () => {
    const nextSavedFilters = [
      ...savedFilters,
      {
        id: Date.now().toString(),
        label: `${viewMode} | ${savedFilters.length + 1}`,
        filters,
        viewMode,
      },
    ].slice(-6);
    setSavedFilters(nextSavedFilters);
    await saveSavedFilters(nextSavedFilters);
  };

  const renderTaskCard = ({ item }) => (
    <TaskCard
      item={item}
      onDelete={onDelete}
      onEdit={onOpenPlanner}
      onStartTimer={onStartTimer}
      onToggleDone={onToggleDone}
      onUpdateStatus={onUpdateStatus}
      timerTaskId={activeTimer?.task_id}
      theme={theme}
    />
  );

  const listHeader = (
    <View style={styles.header}>
      <Text style={[styles.eyebrow, { color: theme?.accentSoft || "#7DD3FC" }]}>Workspace</Text>
      <Text
        style={[
          styles.title,
          isCompact && styles.titleCompact,
          { color: theme?.text || "#F8FAFC" },
        ]}
      >
        Task Library
      </Text>
      <Text
        style={[
          styles.subtitle,
          isCompact && styles.subtitleCompact,
          { color: theme?.muted || "#94A3B8" },
        ]}
      >
        Pick a view, then use the filter rows below to narrow tasks exactly the way you want.
      </Text>

      {activeTimer ? (
        <View style={styles.timerBanner}>
          <Ionicons name="time-outline" size={18} color="#A7F3D0" />
          <Text style={styles.timerText}>Tracking {activeTimer.task_title}</Text>
        </View>
      ) : null}

      <View style={styles.searchRow}>
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
          <Ionicons name="options-outline" size={18} color="#F8FAFC" />
          {!isVeryCompact ? <Text style={styles.filtersButtonText}>Filters</Text> : null}
        </TouchableOpacity>
      </View>

      <View style={[styles.segmentedWrap, isCompact && styles.segmentedWrapCompact]}>
        {VIEW_OPTIONS.map((item) => (
          <SegmentedOption
            key={item.key}
            label={
              isVeryCompact
                ? item.key === "calendar"
                  ? "Cal"
                  : item.key === "timeline"
                    ? "Time"
                    : item.label
                : item.label
            }
            active={viewMode === item.key}
            onPress={() => setViewMode(item.key)}
          />
        ))}
      </View>

      <SectionTitle
        title="Saved filters"
        action={
          <TouchableOpacity onPress={onSaveCurrentFilter}>
            <Text style={styles.linkText}>Save current</Text>
          </TouchableOpacity>
        }
      />
      <HorizontalChips>
        {savedFilters.length ? (
          savedFilters.map((item) => (
            <FilterChip
              key={item.id}
              label={item.label}
              active={false}
              onPress={() => {
                setFilters(item.filters);
                setViewMode(item.viewMode || "list");
              }}
            />
          ))
        ) : (
          <Text style={styles.metaText}>No saved filters yet.</Text>
        )}
      </HorizontalChips>
    </View>
  );

  const renderBoardView = () => (
    <View style={styles.viewSection}>
      <Text style={styles.boardIntro}>
        Board view groups tasks by status so users can quickly understand what is pending,
        in progress, and finished.
      </Text>
      {["Todo", "In Progress", "Done"].map((status) => (
        <View key={status} style={styles.boardSection}>
          <View style={styles.boardSectionHeader}>
            <Text style={styles.boardTitle}>{status}</Text>
            <View style={styles.boardCount}>
              <Text style={styles.boardCountText}>{(boardGroups[status] || []).length}</Text>
            </View>
          </View>
          {(boardGroups[status] || []).length ? (
            (boardGroups[status] || []).map((task) => (
              <TaskCard
                key={task.id}
                item={task}
                onDelete={onDelete}
                onEdit={onOpenPlanner}
                onStartTimer={onStartTimer}
                onToggleDone={onToggleDone}
                onUpdateStatus={onUpdateStatus}
                timerTaskId={activeTimer?.task_id}
                theme={theme}
              />
            ))
          ) : (
            <View style={styles.emptyLane}>
              <Text style={styles.emptyLaneText}>No tasks in {status.toLowerCase()}.</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );

  const renderCalendarView = () => (
    <View style={styles.viewSection}>
      <Text style={styles.boardIntro}>
        Calendar view groups tasks by due date so users can see what is coming up each day.
      </Text>
      {Object.keys(calendarGroups).length === 0 ? (
        <Text style={styles.metaText}>No scheduled tasks yet.</Text>
      ) : (
        Object.entries(calendarGroups).map(([day, dayTasks]) => (
          <View key={day} style={styles.calendarGroup}>
            <Text style={styles.calendarTitle}>{day}</Text>
            {dayTasks.map((task) => renderTaskCard({ item: task }))}
          </View>
        ))
      )}
    </View>
  );

  const renderTimelineView = () => (
    <View style={styles.viewSection}>
      <Text style={styles.boardIntro}>
        Timeline view shows scheduled work in time order from earliest to latest.
      </Text>
      {timelineTasks.length === 0 ? (
        <Text style={styles.metaText}>Add due dates to build a timeline.</Text>
      ) : (
        timelineTasks.map((task, index) => (
          <View key={task.id} style={styles.timelineRow}>
            <View style={styles.timelineTrack}>
              <View
                style={[
                  styles.timelineDot,
                  {
                    backgroundColor: task.hasBlockingDependency
                      ? "#FB7185"
                      : theme?.accent || "#2563EB",
                  },
                ]}
              />
              {index !== timelineTasks.length - 1 ? <View style={styles.timelineLine} /> : null}
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineDate}>
                {new Date(task.due_date).toLocaleString()}
              </Text>
              {renderTaskCard({ item: task })}
            </View>
          </View>
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
            filteredTasks.length > visibleCount ? (
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
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomInset }]}
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
          {viewMode === "board" ? renderBoardView() : null}
          {viewMode === "calendar" ? renderCalendarView() : null}
          {viewMode === "timeline" ? renderTimelineView() : null}
        </ScrollView>
      )}

      <TouchableOpacity
        style={[
          styles.fab,
          { bottom: insets.bottom + 84, backgroundColor: theme?.accent || "#2563EB" },
        ]}
        onPress={() => onOpenPlanner(null)}
      >
        <Ionicons name="add" size={26} color="#FFFFFF" />
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
              action={
                <TouchableOpacity onPress={() => setIsFilterModalVisible(false)}>
                  <Text style={styles.linkText}>Done</Text>
                </TouchableOpacity>
              }
            />

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

            <FilterSection title="Workspace">
              <FilterChip
                label="all"
                active={filters.workspaceId === "all"}
                onPress={() => setFilters((current) => ({ ...current, workspaceId: "all" }))}
              />
              {workspaces.map((item) => (
                <FilterChip
                  key={item.id}
                  label={item.name}
                  active={filters.workspaceId === item.id}
                  onPress={() => setFilters((current) => ({ ...current, workspaceId: item.id }))}
                />
              ))}
            </FilterSection>

            <FilterSection title="Project">
              <FilterChip
                label="all"
                active={filters.projectId === "all"}
                onPress={() => setFilters((current) => ({ ...current, projectId: "all" }))}
              />
              {projects.map((item) => (
                <FilterChip
                  key={item.id}
                  label={item.name}
                  active={filters.projectId === item.id}
                  onPress={() => setFilters((current) => ({ ...current, projectId: item.id }))}
                />
              ))}
            </FilterSection>

            <FilterSection title="Tag">
              <FilterChip
                label="all"
                active={filters.tag === "all"}
                onPress={() => setFilters((current) => ({ ...current, tag: "all" }))}
              />
              {tags.map((item) => (
                <FilterChip
                  key={item.id}
                  label={item.name}
                  active={filters.tag === item.name}
                  onPress={() => setFilters((current) => ({ ...current, tag: item.name }))}
                />
              ))}
            </FilterSection>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalSecondaryButton}
                onPress={() =>
                  setFilters({
                    status: "all",
                    priority: "all",
                    workspaceId: "all",
                    projectId: "all",
                    tag: "all",
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
  header: { gap: 16, marginBottom: 8 },
  eyebrow: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.1 },
  title: { fontSize: 32, fontWeight: "900" },
  titleCompact: { fontSize: 28 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  subtitleCompact: { fontSize: 14, lineHeight: 20 },
  timerBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(15,118,110,0.26)",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(167,243,208,0.14)",
  },
  timerText: { color: "#E6FFFA", fontWeight: "700" },
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
  filtersButton: {
    minHeight: 54,
    borderRadius: 18,
    paddingHorizontal: 14,
    backgroundColor: "rgba(37,99,235,0.18)",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.45)",
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
  },
  sectionTitle: { color: "#F8FAFC", fontSize: 20, fontWeight: "800" },
  linkText: { color: "#7DD3FC", fontSize: 13, fontWeight: "700" },
  taskCard: {
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
  taskTitle: { color: "#F8FAFC", fontSize: 17, fontWeight: "800", lineHeight: 24 },
  taskDescription: { color: "#94A3B8", fontSize: 13, lineHeight: 20 },
  metaText: { color: "#94A3B8", fontSize: 12, lineHeight: 18 },
  alertText: { color: "#FCA5A5" },
  cardButtons: { flexDirection: "row", gap: 10 },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  emptyText: { color: "#94A3B8", textAlign: "center", paddingVertical: 28 },
  viewSection: { gap: 16 },
  boardIntro: { color: "#B5C6D6", fontSize: 14, lineHeight: 21 },
  boardSection: {
    backgroundColor: "rgba(15,23,42,0.4)",
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.12)",
  },
  boardSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  boardTitle: { color: "#F8FAFC", fontSize: 19, fontWeight: "800" },
  boardCount: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(37,99,235,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  boardCountText: { color: "#F8FAFC", fontWeight: "800" },
  emptyLane: {
    minHeight: 76,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(148,163,184,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyLaneText: { color: "#90A6BC", fontSize: 13, fontWeight: "600" },
  calendarGroup: { gap: 10 },
  calendarTitle: { color: "#F8FAFC", fontSize: 18, fontWeight: "800" },
  timelineRow: { flexDirection: "row", gap: 12 },
  timelineTrack: { width: 20, alignItems: "center" },
  timelineDot: { width: 14, height: 14, borderRadius: 7, marginTop: 20 },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: "rgba(148,163,184,0.22)",
    marginTop: 4,
  },
  timelineContent: { flex: 1 },
  timelineDate: { color: "#7DD3FC", fontSize: 13, fontWeight: "700", marginBottom: 8 },
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
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563EB",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 16,
  },
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
