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
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getCategories,
  getTasksWithCategories,
  removeTask,
  setTaskCompleted,
  setTaskReminderMinutes,
} from "../database";
import {
  cancelTaskNotifications,
  getReminderLabel,
  normalizeReminderMinutes,
  REMINDER_OPTIONS,
  scheduleSingleNotification,
} from "../utils/taskNotifications";

export default function TasksScreen({ bottomInset, isActive, onOpenPlanner }) {
  const insets = useSafeAreaInsets();
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [reminderModalVisible, setReminderModalVisible] = useState(false);
  const [selectedTaskForReminder, setSelectedTaskForReminder] = useState(null);
  const [selectedReminderMinutes, setSelectedReminderMinutes] = useState(1440);
  const [expandedDescriptions, setExpandedDescriptions] = useState({});
  const [selectedFilters, setSelectedFilters] = useState({
    timeRange: "all",
    priority: "all",
    status: "all",
    category: "all",
  });

  const loadTasks = useCallback(() => {
    try {
      setTasks(getTasksWithCategories());
    } catch (error) {
      console.error("Error loading tasks:", error);
    }
  }, []);

  useEffect(() => {
    try {
      setCategories(getCategories());
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  }, []);

  useEffect(() => {
    if (isActive) {
      loadTasks();
    }
  }, [isActive, loadTasks]);

  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (task) =>
          task.title.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query),
      );
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const weekLater = new Date(today);
    weekLater.setDate(weekLater.getDate() + 7);

    if (selectedFilters.timeRange === "today") {
      result = result.filter((task) => {
        if (!task.due_date) {
          return false;
        }

        const dueDate = new Date(task.due_date);
        return dueDate >= today && dueDate < tomorrow;
      });
    }

    if (selectedFilters.timeRange === "week") {
      result = result.filter((task) => {
        if (!task.due_date) {
          return false;
        }

        const dueDate = new Date(task.due_date);
        return dueDate >= today && dueDate <= weekLater;
      });
    }

    if (selectedFilters.priority !== "all") {
      result = result.filter((task) => task.priority === selectedFilters.priority);
    }

    if (selectedFilters.status === "completed") {
      result = result.filter((task) => task.completed === 1);
    } else if (selectedFilters.status === "pending") {
      result = result.filter((task) => task.completed === 0);
    }

    if (selectedFilters.category !== "all") {
      result = result.filter((task) => task.category_id === selectedFilters.category);
    }

    return result;
  }, [searchQuery, selectedFilters, tasks]);

  const activeFilterCount = useMemo(
    () => Object.values(selectedFilters).filter((value) => value !== "all").length,
    [selectedFilters],
  );

  const completedCount = tasks.filter((task) => task.completed === 1).length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTasks();
    setTimeout(() => setRefreshing(false), 350);
  }, [loadTasks]);

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedFilters({
      timeRange: "all",
      priority: "all",
      status: "all",
      category: "all",
    });
    setFilterModalVisible(false);
  }, []);

  const toggleComplete = async (taskId) => {
    const task = tasks.find((item) => item.id === taskId);
    const nextStatus = task?.completed === 1 ? 0 : 1;

    setTaskCompleted(taskId, nextStatus);

    if (nextStatus === 1) {
      await cancelTaskNotifications(taskId);
    } else if (task) {
      await scheduleSingleNotification({
        ...task,
        completed: 0,
        reminder_minutes: normalizeReminderMinutes(task.reminder_minutes),
      });
    }

    loadTasks();
  };

  const updateTaskReminder = async (taskId, minutes) => {
    setTaskReminderMinutes(taskId, minutes);

    const updatedTask = tasks.find((task) => task.id === taskId);
    if (updatedTask) {
      await cancelTaskNotifications(taskId);
      await scheduleSingleNotification({ ...updatedTask, reminder_minutes: minutes });
    }

    setReminderModalVisible(false);
    setSelectedTaskForReminder(null);
    loadTasks();
  };

  const deleteTask = (taskId) => {
    Alert.alert("Delete task", "This task and its reminder will be removed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await cancelTaskNotifications(taskId);
          removeTask(taskId);
          loadTasks();
        },
      },
    ]);
  };

  const getPriorityColor = (priority) =>
    priority === "High" ? "#FB7185" : priority === "Low" ? "#38BDF8" : "#FBBF24";

  const formatDisplayDate = (isoString) => {
    if (!isoString) {
      return null;
    }

    const date = new Date(isoString);
    const diffHours = (date - new Date()) / (1000 * 60 * 60);
    const prefix = diffHours < 0 ? "Overdue" : diffHours < 24 ? "Soon" : "Due";

    return `${prefix} ${date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#07111F" />

      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.titleWrap}>
              <Text style={styles.eyebrow}>Workspace</Text>
              <Text style={styles.title}>Task Library</Text>
              <Text style={styles.subtitle}>Everything you need, arranged so your mind can breathe.</Text>
            </View>
            <View style={styles.progressPill}>
              <Text style={styles.progressValue}>{progress}%</Text>
              <Text style={styles.progressLabel}>done</Text>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.searchToggle, showSearch && styles.searchToggleActive]}
              activeOpacity={0.88}
              onPress={() => setShowSearch((current) => !current)}
            >
              <Ionicons name="search" size={18} color="#F8FAFC" />
              <Text style={styles.searchToggleText}>Search</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}
              activeOpacity={0.88}
              onPress={() => setFilterModalVisible(true)}
            >
              <Ionicons name="options-outline" size={18} color="#F8FAFC" />
              <Text style={styles.filterButtonText}>Filters</Text>
              {activeFilterCount > 0 ? (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          </View>

          {showSearch ? (
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={18} color="#8FA5BF" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search title or note"
                placeholderTextColor="#64748B"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          <View style={styles.summaryCard}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>{tasks.length}</Text>
              <Text style={styles.summaryLabel}>Total</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>{tasks.filter((task) => task.completed === 0).length}</Text>
              <Text style={styles.summaryLabel}>Active</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>{tasks.filter((task) => task.due_date).length}</Text>
              <Text style={styles.summaryLabel}>Scheduled</Text>
            </View>
          </View>
        </View>

        <View style={styles.resultsRow}>
          <Text style={styles.resultsText}>
            {filteredTasks.length} visible of {tasks.length}
          </Text>
          {(searchQuery || activeFilterCount > 0) && (
            <TouchableOpacity onPress={clearFilters}>
              <Text style={styles.clearText}>Clear all</Text>
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={filteredTasks}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomInset }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#2563EB"
              colors={["#2563EB"]}
            />
          }
          renderItem={({ item }) => {
            const categoryColor = item.category_color || "#2563EB";
            const priorityColor = getPriorityColor(item.priority);
            const isExpanded = expandedDescriptions[item.id] || false;
            const isOverdue =
              item.due_date && new Date(item.due_date) < new Date() && item.completed === 0;
            const reminderMinutes = normalizeReminderMinutes(item.reminder_minutes);

            return (
              <View style={[styles.taskCard, item.completed === 1 && styles.taskCardComplete]}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.taskContent}
                  onPress={() => toggleComplete(item.id)}
                >
                  <View
                    style={[
                      styles.checkbox,
                      item.completed === 1 && {
                        backgroundColor: categoryColor,
                        borderColor: categoryColor,
                      },
                    ]}
                  >
                    {item.completed === 1 ? (
                      <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                    ) : (
                      <View style={[styles.checkboxInner, { backgroundColor: categoryColor }]} />
                    )}
                  </View>

                  <View style={styles.taskTextWrap}>
                    <View style={styles.badgesRow}>
                      {item.category_name ? (
                        <View style={[styles.badge, { backgroundColor: `${categoryColor}22` }]}>
                          <Text style={[styles.badgeText, { color: categoryColor }]}>
                            {item.category_name}
                          </Text>
                        </View>
                      ) : null}

                      <View style={[styles.badge, { backgroundColor: `${priorityColor}22` }]}>
                        <Text style={[styles.badgeText, { color: priorityColor }]}>{item.priority}</Text>
                      </View>

                      {isOverdue ? (
                        <View style={[styles.badge, { backgroundColor: "rgba(248,113,113,0.18)" }]}>
                          <Text style={[styles.badgeText, { color: "#FCA5A5" }]}>Overdue</Text>
                        </View>
                      ) : null}
                    </View>

                    <Text style={[styles.taskTitle, item.completed === 1 && styles.strike]} numberOfLines={2}>
                      {item.title}
                    </Text>

                    {item.due_date ? (
                      <View style={styles.dateRow}>
                        <Ionicons
                          name={isOverdue ? "alert-circle-outline" : "time-outline"}
                          size={14}
                          color={isOverdue ? "#FCA5A5" : "#94A3B8"}
                        />
                        <Text style={[styles.dateText, isOverdue && styles.dateTextAlert]}>
                          {formatDisplayDate(item.due_date)}
                        </Text>
                      </View>
                    ) : null}

                    {item.due_date && item.completed === 0 ? (
                      <TouchableOpacity
                        style={styles.reminderPill}
                        activeOpacity={0.85}
                        onPress={() => {
                          setSelectedTaskForReminder(item);
                          setSelectedReminderMinutes(reminderMinutes);
                          setReminderModalVisible(true);
                        }}
                      >
                        <Ionicons name="notifications-outline" size={13} color="#7DD3FC" />
                        <Text style={styles.reminderPillText}>{getReminderLabel(reminderMinutes)}</Text>
                      </TouchableOpacity>
                    ) : null}

                    {item.description ? (
                      <View style={styles.descriptionWrap}>
                        <Text style={styles.descriptionText} numberOfLines={isExpanded ? undefined : 2}>
                          {item.description}
                        </Text>
                        {item.description.length > 100 ? (
                          <TouchableOpacity
                            style={styles.expandButton}
                            onPress={() =>
                              setExpandedDescriptions((current) => ({
                                ...current,
                                [item.id]: !current[item.id],
                              }))
                            }
                          >
                            <Text style={styles.expandButtonText}>
                              {isExpanded ? "Show less" : "Read more"}
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                </TouchableOpacity>

                <View style={styles.sideActions}>
                  <TouchableOpacity
                    style={styles.iconButton}
                    activeOpacity={0.8}
                    onPress={() => onOpenPlanner(item)}
                  >
                    <Ionicons name="create-outline" size={18} color="#7DD3FC" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.iconButton}
                    activeOpacity={0.8}
                    onPress={() => deleteTask(item.id)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#FCA5A5" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="file-tray-outline" size={44} color="#7DD3FC" />
              <Text style={styles.emptyTitle}>
                {tasks.length === 0 ? "No tasks yet" : "No matching tasks"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {tasks.length === 0
                  ? "When you're ready, add the first task and let this space carry the load with you."
                  : "Nothing fits this view right now. Try a gentler search or clear a filter."}
              </Text>
            </View>
          }
        />

        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 84 }]}
          activeOpacity={0.92}
          onPress={() => onOpenPlanner(null)}
        >
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <Modal
        animationType="slide"
        transparent
        visible={filterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter tasks</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Ionicons name="close" size={24} color="#F8FAFC" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <FilterSection
                title="Due"
                options={[
                  { value: "all", label: "All" },
                  { value: "today", label: "Today" },
                  { value: "week", label: "This week" },
                ]}
                selectedValue={selectedFilters.timeRange}
                onSelect={(value) => setSelectedFilters((current) => ({ ...current, timeRange: value }))}
              />

              <FilterSection
                title="Priority"
                options={[
                  { value: "all", label: "All" },
                  { value: "High", label: "High" },
                  { value: "Medium", label: "Medium" },
                  { value: "Low", label: "Low" },
                ]}
                selectedValue={selectedFilters.priority}
                onSelect={(value) => setSelectedFilters((current) => ({ ...current, priority: value }))}
              />

              <FilterSection
                title="Status"
                options={[
                  { value: "all", label: "All" },
                  { value: "pending", label: "Active" },
                  { value: "completed", label: "Completed" },
                ]}
                selectedValue={selectedFilters.status}
                onSelect={(value) => setSelectedFilters((current) => ({ ...current, status: value }))}
              />

              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Category</Text>
                <View style={styles.filterOptionWrap}>
                  <FilterChip
                    label="All"
                    selected={selectedFilters.category === "all"}
                    onPress={() => setSelectedFilters((current) => ({ ...current, category: "all" }))}
                  />
                  {categories.map((category) => (
                    <FilterChip
                      key={category.id}
                      label={category.name}
                      selected={selectedFilters.category === category.id}
                      accentColor={category.color}
                      onPress={() =>
                        setSelectedFilters((current) => ({ ...current, category: category.id }))
                      }
                    />
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.secondaryModalButton} onPress={clearFilters}>
                <Text style={styles.secondaryModalButtonText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryModalButton}
                onPress={() => setFilterModalVisible(false)}
              >
                <Text style={styles.primaryModalButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={reminderModalVisible}
        onRequestClose={() => setReminderModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set reminder</Text>
              <TouchableOpacity onPress={() => setReminderModalVisible(false)}>
                <Ionicons name="close" size={24} color="#F8FAFC" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Choose when {selectedTaskForReminder?.title || "this task"} should remind you.
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {REMINDER_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.reminderOption,
                    selectedReminderMinutes === option.value && styles.reminderOptionSelected,
                  ]}
                  onPress={() => setSelectedReminderMinutes(option.value)}
                >
                  <Text
                    style={[
                      styles.reminderOptionText,
                      selectedReminderMinutes === option.value && styles.reminderOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {selectedReminderMinutes === option.value ? (
                    <Ionicons name="checkmark-circle" size={20} color="#2563EB" />
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.secondaryModalButton}
                onPress={() => setReminderModalVisible(false)}
              >
                <Text style={styles.secondaryModalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryModalButton}
                onPress={() =>
                  selectedTaskForReminder &&
                  updateTaskReminder(selectedTaskForReminder.id, selectedReminderMinutes)
                }
              >
                <Text style={styles.primaryModalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function FilterSection({ onSelect, options, selectedValue, title }) {
  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterSectionTitle}>{title}</Text>
      <View style={styles.filterOptionWrap}>
        {options.map((option) => (
          <FilterChip
            key={option.value}
            label={option.label}
            selected={selectedValue === option.value}
            onPress={() => onSelect(option.value)}
          />
        ))}
      </View>
    </View>
  );
}

function FilterChip({ accentColor, label, onPress, selected }) {
  return (
    <TouchableOpacity
      style={[
        styles.filterChip,
        selected && styles.filterChipSelected,
        accentColor && !selected && { borderColor: `${accentColor}66` },
      ]}
      onPress={onPress}
    >
      {accentColor ? <View style={[styles.filterDot, { backgroundColor: accentColor }]} /> : null}
      <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  header: {
    gap: 16,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
  },
  titleWrap: {
    flex: 1,
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
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -1,
  },
  subtitle: {
    color: "#94A3B8",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  progressPill: {
    minWidth: 82,
    backgroundColor: "rgba(15, 23, 42, 0.76)",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.14)",
    alignItems: "center",
  },
  progressValue: {
    color: "#F8FAFC",
    fontSize: 22,
    fontWeight: "900",
  },
  progressLabel: {
    color: "#8FA5BF",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  searchToggle: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: "rgba(37, 99, 235, 0.88)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  searchToggleActive: {
    backgroundColor: "rgba(14, 165, 233, 0.88)",
  },
  searchToggleText: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "800",
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minWidth: 120,
    borderRadius: 18,
    backgroundColor: "rgba(15, 23, 42, 0.76)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.14)",
    position: "relative",
  },
  filterButtonActive: {
    backgroundColor: "rgba(15, 118, 110, 0.72)",
    borderColor: "rgba(45, 212, 191, 0.2)",
  },
  filterButtonText: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "800",
  },
  filterBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FB7185",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#0F172A",
  },
  filterBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(15, 23, 42, 0.76)",
    borderRadius: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.14)",
  },
  searchInput: {
    flex: 1,
    minHeight: 52,
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "500",
  },
  summaryCard: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderRadius: 24,
    backgroundColor: "rgba(15, 23, 42, 0.76)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.14)",
  },
  summaryStat: {
    flex: 1,
  },
  summaryValue: {
    color: "#F8FAFC",
    fontSize: 24,
    fontWeight: "900",
  },
  summaryLabel: {
    color: "#8FA5BF",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
  },
  resultsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
    marginBottom: 12,
  },
  resultsText: {
    color: "#8FA5BF",
    fontSize: 13,
    fontWeight: "600",
  },
  clearText: {
    color: "#7DD3FC",
    fontSize: 13,
    fontWeight: "700",
  },
  listContent: {
    gap: 12,
  },
  taskCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "rgba(15, 23, 42, 0.76)",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.14)",
    marginBottom: 12,
  },
  taskCardComplete: {
    opacity: 0.58,
  },
  taskContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "rgba(148, 163, 184, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  taskTextWrap: {
    flex: 1,
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  taskTitle: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 23,
  },
  strike: {
    textDecorationLine: "line-through",
    color: "#7B91A8",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  dateText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  dateTextAlert: {
    color: "#FCA5A5",
  },
  reminderPill: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(14, 165, 233, 0.12)",
  },
  reminderPillText: {
    color: "#7DD3FC",
    fontSize: 11,
    fontWeight: "700",
  },
  descriptionWrap: {
    marginTop: 10,
  },
  descriptionText: {
    color: "#94A3B8",
    fontSize: 13,
    lineHeight: 20,
  },
  expandButton: {
    marginTop: 4,
    alignSelf: "flex-start",
  },
  expandButtonText: {
    color: "#7DD3FC",
    fontSize: 12,
    fontWeight: "700",
  },
  sideActions: {
    gap: 10,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  fab: {
    position: "absolute",
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563EB",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 16,
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
    marginTop: 12,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(7, 17, 31, 0.88)",
    justifyContent: "flex-end",
  },
  modalCard: {
    maxHeight: "82%",
    backgroundColor: "#0F1C2D",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    borderTopWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.18)",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  modalTitle: {
    color: "#F8FAFC",
    fontSize: 24,
    fontWeight: "900",
  },
  modalSubtitle: {
    color: "#94A3B8",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },
  filterSection: {
    marginBottom: 22,
  },
  filterSectionTitle: {
    color: "#7DD3FC",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.9,
    marginBottom: 12,
  },
  filterOptionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
  },
  filterChipSelected: {
    backgroundColor: "rgba(37, 99, 235, 0.18)",
    borderColor: "rgba(96, 165, 250, 0.55)",
  },
  filterChipText: {
    color: "#B8C6D5",
    fontSize: 14,
    fontWeight: "700",
  },
  filterChipTextSelected: {
    color: "#F8FAFC",
  },
  filterDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  modalFooter: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  secondaryModalButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryModalButtonText: {
    color: "#B8C6D5",
    fontSize: 15,
    fontWeight: "800",
  },
  primaryModalButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryModalButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  reminderOption: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.18)",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  reminderOptionSelected: {
    backgroundColor: "rgba(37, 99, 235, 0.14)",
    borderColor: "rgba(96, 165, 250, 0.55)",
  },
  reminderOptionText: {
    color: "#E2E8F0",
    fontSize: 15,
    fontWeight: "600",
  },
  reminderOptionTextSelected: {
    color: "#F8FAFC",
    fontWeight: "800",
  },
});
