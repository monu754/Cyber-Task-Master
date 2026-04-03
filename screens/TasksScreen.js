import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Modal,
  Platform,
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
  REMINDER_OPTIONS,
  scheduleSingleNotification,
} from "../utils/taskNotifications";

export default function TasksScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({
    timeRange: "all",
    priority: "all",
    status: "all",
    category: "all",
  });
  const [reminderModalVisible, setReminderModalVisible] = useState(false);
  const [selectedTaskForReminder, setSelectedTaskForReminder] = useState(null);
  const [selectedReminderMinutes, setSelectedReminderMinutes] = useState(1440);
  const [categories, setCategories] = useState([]);
  const [expandedDescriptions, setExpandedDescriptions] = useState({});

  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const applyFilters = useCallback((allTasks, query, filters) => {
    let result = [...allTasks];

    if (query.trim()) {
      const searchLower = query.toLowerCase().trim();
      result = result.filter(
        (task) =>
          task.title.toLowerCase().includes(searchLower) ||
          (task.description && task.description.toLowerCase().includes(searchLower)),
      );
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const weekLater = new Date(today);
    weekLater.setDate(weekLater.getDate() + 7);

    if (filters.timeRange === "today") {
      result = result.filter((task) => {
        if (!task.due_date) {
          return false;
        }

        const dueDate = new Date(task.due_date);
        return dueDate >= today && dueDate < tomorrow;
      });
    } else if (filters.timeRange === "week") {
      result = result.filter((task) => {
        if (!task.due_date) {
          return false;
        }

        const dueDate = new Date(task.due_date);
        return dueDate >= today && dueDate <= weekLater;
      });
    }

    if (filters.priority !== "all") {
      result = result.filter((task) => task.priority === filters.priority);
    }

    if (filters.status === "completed") {
      result = result.filter((task) => task.completed === 1);
    } else if (filters.status === "pending") {
      result = result.filter((task) => task.completed === 0);
    }

    if (filters.category !== "all") {
      result = result.filter((task) => task.category_id === filters.category);
    }

    return result;
  }, []);

  const loadTasks = useCallback(() => {
    try {
      const allTasks = getTasksWithCategories();
      setTasks(allTasks);
      setFilteredTasks(applyFilters(allTasks, searchQuery, selectedFilters));
    } catch (error) {
      console.error("Error loading tasks:", error);
    }
  }, [applyFilters, searchQuery, selectedFilters]);

  const loadCategories = useCallback(() => {
    try {
      setCategories(getCategories());
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks]),
  );

  useEffect(() => {
    setFilteredTasks(applyFilters(tasks, searchQuery, selectedFilters));
  }, [applyFilters, searchQuery, selectedFilters, tasks]);

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

  const toggleComplete = async (id) => {
    const task = tasks.find((item) => item.id === id);
    const nextStatus = task?.completed === 1 ? 0 : 1;

    setTaskCompleted(id, nextStatus);

    if (nextStatus === 1) {
      await cancelTaskNotifications(id);
    } else if (task) {
      await scheduleSingleNotification({ ...task, completed: 0 });
    }

    loadTasks();
  };

  const deleteTask = (id) => {
    Alert.alert("Delete Objective", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await cancelTaskNotifications(id);
          removeTask(id);
          loadTasks();
        },
      },
    ]);
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

  const onRefresh = () => {
    setRefreshing(true);
    loadTasks();
    setTimeout(() => setRefreshing(false), 500);
  };

  const clearFilters = () => {
    setSelectedFilters({
      timeRange: "all",
      priority: "all",
      status: "all",
      category: "all",
    });
    setSearchQuery("");
    setFilterModalVisible(false);
  };

  const getPriorityColor = (priorityLevel) =>
    priorityLevel === "High"
      ? "#F43F5E"
      : priorityLevel === "Low"
        ? "#0EA5E9"
        : "#F59E0B";

  const activeFilterCount = useMemo(
    () => Object.values(selectedFilters).filter((value) => value !== "all").length,
    [selectedFilters],
  );

  const completedCount = tasks.filter((task) => task.completed === 1).length;
  const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  const formatDisplayDate = (isoString) => {
    if (!isoString) {
      return null;
    }

    const date = new Date(isoString);
    const now = new Date();
    const diffHours = (date - now) / (1000 * 60 * 60);

    let prefix = "Due";
    if (diffHours < 0) {
      prefix = "Overdue";
    } else if (diffHours < 24) {
      prefix = "Soon";
    }

    return `${prefix} ${date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}`;
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

      <Animated.View
        style={[
          styles.container,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerTitleRow}>
              <TouchableOpacity
                style={styles.backButton}
                activeOpacity={0.75}
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="chevron-back" size={24} color="#F8FAFC" />
              </TouchableOpacity>
              <View>
                <Text style={styles.greeting}>Workspace</Text>
                <Text style={styles.headerTitle}>Task Library</Text>
              </View>
            </View>

            <View style={styles.taskBadge}>
              <Text style={styles.badgeNumber}>
                {completedCount}/{tasks.length}
              </Text>
              <Text style={styles.badgeLabel}>Done</Text>
            </View>
          </View>

          <View style={styles.searchFilterBar}>
            <TouchableOpacity
              style={styles.searchIconBtn}
              onPress={() => setShowSearch((current) => !current)}
            >
              <Ionicons name="search" size={22} color="#A5B4FC" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterBtn, activeFilterCount > 0 && styles.activeFilterBtn]}
              onPress={() => setFilterModalVisible(true)}
            >
              <Ionicons
                name="filter"
                size={20}
                color={activeFilterCount > 0 ? "#FFFFFF" : "#A5B4FC"}
              />
              {activeFilterCount > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              )}
              <Text
                style={[
                  styles.filterBtnText,
                  activeFilterCount > 0 && styles.activeFilterText,
                ]}
              >
                Filters
              </Text>
            </TouchableOpacity>
          </View>

          {showSearch && (
            <Animated.View style={styles.searchContainer}>
              <Ionicons
                name="search-outline"
                size={20}
                color="#64748B"
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by title or description..."
                placeholderTextColor="#64748B"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={20} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </Animated.View>
          )}

          <View style={styles.statsCard}>
            <View style={styles.statsHeader}>
              <Text style={styles.statsLabel}>Progress Overview</Text>
              <Text style={styles.statsValue}>{Math.round(progress)}%</Text>
            </View>
            <View style={styles.progressContainer}>
              <View style={styles.barBg}>
                <Animated.View style={[styles.barFill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.progressText}>
                {completedCount} of {tasks.length} objectives completed
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.resultsInfo}>
          <Text style={styles.resultsText}>
            {filteredTasks.length} visible • {tasks.length} total
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
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={onRefresh}
          renderItem={({ item }) => {
            const priorityColor = getPriorityColor(item.priority);
            const categoryColor = item.category_color || "#6366F1";
            const isOverdue =
              item.due_date && new Date(item.due_date) < new Date() && item.completed === 0;
            const isExpanded = expandedDescriptions[item.id] || false;

            return (
              <Animated.View
                style={[
                  styles.taskNode,
                  item.completed === 1 && styles.completedNode,
                  isOverdue && styles.overdueNode,
                  { borderLeftColor: categoryColor },
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
                      item.completed === 1 && {
                        backgroundColor: categoryColor,
                        borderColor: categoryColor,
                      },
                    ]}
                  >
                    {item.completed === 1 ? (
                      <Ionicons name="checkmark" size={16} color="#FFF" />
                    ) : (
                      <View style={[styles.checkboxInner, { backgroundColor: categoryColor }]} />
                    )}
                  </View>
                  <View style={styles.nodeText}>
                    <View style={styles.badgesRow}>
                      {item.category_name && (
                        <View
                          style={[
                            styles.badge,
                            {
                              backgroundColor: `${categoryColor}20`,
                              borderColor: `${categoryColor}40`,
                            },
                          ]}
                        >
                          <Ionicons
                            name="folder"
                            size={10}
                            color={categoryColor}
                            style={{ marginRight: 4 }}
                          />
                          <Text style={[styles.badgeText, { color: categoryColor }]}>
                            {item.category_name}
                          </Text>
                        </View>
                      )}
                      <View
                        style={[
                          styles.badge,
                          {
                            backgroundColor: `${priorityColor}20`,
                            borderColor: `${priorityColor}40`,
                          },
                        ]}
                      >
                        <Text style={[styles.badgeText, { color: priorityColor }]}>
                          {item.priority}
                        </Text>
                      </View>
                      {isOverdue && (
                        <View
                          style={[
                            styles.badge,
                            { backgroundColor: "#EF444420", borderColor: "#EF444440" },
                          ]}
                        >
                          <Text style={[styles.badgeText, { color: "#EF4444" }]}>OVERDUE</Text>
                        </View>
                      )}
                    </View>

                    <Text
                      style={[styles.nodeTitle, item.completed === 1 && styles.strike]}
                      numberOfLines={2}
                    >
                      {item.title}
                    </Text>

                    {item.due_date && (
                      <View style={styles.dateRow}>
                        <Ionicons
                          name={isOverdue ? "alert-circle" : "time-outline"}
                          size={14}
                          color={
                            isOverdue
                              ? "#EF4444"
                              : item.completed === 1
                                ? "#64748B"
                                : "#94A3B8"
                          }
                        />
                        <Text
                          style={[
                            styles.dateText,
                            isOverdue && styles.overdueText,
                            item.completed === 1 && styles.strike,
                          ]}
                        >
                          {formatDisplayDate(item.due_date)}
                        </Text>
                      </View>
                    )}

                    {item.due_date && item.completed === 0 && (
                      <TouchableOpacity
                        style={styles.reminderBadge}
                        onPress={() => {
                          setSelectedTaskForReminder(item);
                          setSelectedReminderMinutes(item.reminder_minutes || 1440);
                          setReminderModalVisible(true);
                        }}
                      >
                        <Ionicons
                          name="notifications-outline"
                          size={12}
                          color="#A5B4FC"
                        />
                        <Text style={styles.reminderText}>
                          {getReminderLabel(item.reminder_minutes || 1440)}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {item.description ? (
                      <View style={styles.descriptionContainer}>
                        <Text
                          style={styles.nodeDesc}
                          numberOfLines={isExpanded ? undefined : 2}
                        >
                          {item.description}
                        </Text>
                        {item.description.length > 100 && (
                          <TouchableOpacity
                            onPress={() =>
                              setExpandedDescriptions((current) => ({
                                ...current,
                                [item.id]: !current[item.id],
                              }))
                            }
                            style={styles.expandButton}
                          >
                            <Text style={styles.expandButtonText}>
                              {isExpanded ? "Show less" : "Read more"}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : null}
                  </View>
                </TouchableOpacity>
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    onPress={() => navigation.navigate("AddTask", { task: item })}
                    style={styles.iconActionBtn}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="create-outline" size={19} color="#A5B4FC" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => deleteTask(item.id)}
                    style={styles.iconActionBtn}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </Animated.View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={64} color="#6366F1" />
              <Text style={styles.emptyTitle}>
                {tasks.length === 0 ? "No tasks yet" : "No matching tasks"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {tasks.length === 0
                  ? "Create your first task to start building a cleaner routine."
                  : "Try another search term or relax one of the filters."}
              </Text>
            </View>
          }
        />

        <TouchableOpacity
          style={[styles.plusFab, { bottom: insets.bottom + 16 }]}
          onPress={() => navigation.navigate("AddTask")}
          activeOpacity={0.8}
        >
          <Ionicons name="add-sharp" size={40} color="#FFF" />
        </TouchableOpacity>
      </Animated.View>

      <Modal
        animationType="slide"
        transparent
        visible={filterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Tasks</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Ionicons name="close" size={24} color="#F8FAFC" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>DUE DATE</Text>
                <View style={styles.filterOptions}>
                  {[
                    { value: "all", label: "All" },
                    { value: "today", label: "Today" },
                    { value: "week", label: "This Week" },
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.filterOption,
                        selectedFilters.timeRange === option.value &&
                          styles.filterOptionSelected,
                      ]}
                      onPress={() =>
                        setSelectedFilters({ ...selectedFilters, timeRange: option.value })
                      }
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          selectedFilters.timeRange === option.value &&
                            styles.filterOptionTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>PRIORITY</Text>
                <View style={styles.filterOptions}>
                  {[
                    { value: "all", label: "All" },
                    { value: "High", label: "High" },
                    { value: "Medium", label: "Medium" },
                    { value: "Low", label: "Low" },
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.filterOption,
                        selectedFilters.priority === option.value &&
                          styles.filterOptionSelected,
                      ]}
                      onPress={() =>
                        setSelectedFilters({ ...selectedFilters, priority: option.value })
                      }
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          selectedFilters.priority === option.value &&
                            styles.filterOptionTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>STATUS</Text>
                <View style={styles.filterOptions}>
                  {[
                    { value: "all", label: "All" },
                    { value: "pending", label: "Active" },
                    { value: "completed", label: "Completed" },
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.filterOption,
                        selectedFilters.status === option.value &&
                          styles.filterOptionSelected,
                      ]}
                      onPress={() =>
                        setSelectedFilters({ ...selectedFilters, status: option.value })
                      }
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          selectedFilters.status === option.value &&
                            styles.filterOptionTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>CATEGORY</Text>
                <View style={styles.filterOptions}>
                  <TouchableOpacity
                    style={[
                      styles.filterOption,
                      selectedFilters.category === "all" && styles.filterOptionSelected,
                    ]}
                    onPress={() =>
                      setSelectedFilters({ ...selectedFilters, category: "all" })
                    }
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        selectedFilters.category === "all" &&
                          styles.filterOptionTextSelected,
                      ]}
                    >
                      All
                    </Text>
                  </TouchableOpacity>

                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.filterOption,
                        selectedFilters.category === cat.id &&
                          styles.filterOptionSelected,
                        { borderColor: `${cat.color}40` },
                      ]}
                      onPress={() =>
                        setSelectedFilters({ ...selectedFilters, category: cat.id })
                      }
                    >
                      <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                      <Text
                        style={[
                          styles.filterOptionText,
                          selectedFilters.category === cat.id &&
                            styles.filterOptionTextSelected,
                        ]}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalClearBtn} onPress={clearFilters}>
                <Text style={styles.modalClearText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalApplyBtn}
                onPress={() => setFilterModalVisible(false)}
              >
                <Text style={styles.modalApplyText}>Apply Filters</Text>
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
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set Reminder</Text>
              <TouchableOpacity onPress={() => setReminderModalVisible(false)}>
                <Ionicons name="close" size={24} color="#F8FAFC" />
              </TouchableOpacity>
            </View>

            <Text style={styles.reminderSubtitle}>
              Choose how early the reminder should appear for "{selectedTaskForReminder?.title}".
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {REMINDER_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.reminderOption,
                    selectedReminderMinutes === option.value &&
                      styles.reminderOptionSelected,
                  ]}
                  onPress={() => setSelectedReminderMinutes(option.value)}
                >
                  <Text
                    style={[
                      styles.reminderOptionText,
                      selectedReminderMinutes === option.value &&
                        styles.reminderOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {selectedReminderMinutes === option.value && (
                    <Ionicons name="checkmark-circle" size={20} color="#4F46E5" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalClearBtn}
                onPress={() => setReminderModalVisible(false)}
              >
                <Text style={styles.modalClearText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalApplyBtn}
                onPress={() =>
                  selectedTaskForReminder &&
                  updateTaskReminder(selectedTaskForReminder.id, selectedReminderMinutes)
                }
              >
                <Text style={styles.modalApplyText}>Save Reminder</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: "#020617" },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    zIndex: 10,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + 15 : 15,
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
  header: { marginBottom: 16 },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    marginTop: 10,
    gap: 12,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(165, 180, 252, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  greeting: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94A3B8",
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#F8FAFC",
    letterSpacing: -1,
  },
  taskBadge: {
    backgroundColor: "#312E81",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#A5B4FC",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 88,
  },
  badgeNumber: {
    fontSize: 16,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#E0E7FF",
    marginTop: 2,
    letterSpacing: 0.5,
  },
  searchFilterBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  searchIconBtn: {
    flex: 1,
    backgroundColor: "rgba(49, 46, 129, 0.7)",
    padding: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(165, 180, 252, 0.4)",
    alignItems: "center",
  },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(49, 46, 129, 0.7)",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(165, 180, 252, 0.4)",
    gap: 8,
    position: "relative",
  },
  activeFilterBtn: {
    backgroundColor: "#4F46E5",
    borderColor: "#818CF8",
  },
  filterBtnText: {
    color: "#A5B4FC",
    fontWeight: "700",
    fontSize: 14,
  },
  activeFilterText: {
    color: "#FFFFFF",
  },
  filterBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#EF4444",
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  filterBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(49, 46, 129, 0.7)",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(165, 180, 252, 0.4)",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: "#F8FAFC",
    fontSize: 16,
    paddingVertical: 14,
    fontWeight: "500",
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
  resultsInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 8,
  },
  resultsText: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "500",
  },
  clearText: {
    color: "#818CF8",
    fontSize: 13,
    fontWeight: "700",
  },
  listContent: { paddingBottom: 140 },
  taskNode: {
    backgroundColor: "rgba(49, 46, 129, 0.5)",
    padding: 18,
    borderRadius: 18,
    marginBottom: 12,
    borderLeftWidth: 4,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderTopColor: "rgba(165, 180, 252, 0.2)",
    borderRightColor: "rgba(165, 180, 252, 0.15)",
    borderBottomColor: "rgba(165, 180, 252, 0.15)",
  },
  completedNode: { opacity: 0.5, backgroundColor: "rgba(49, 46, 129, 0.3)" },
  overdueNode: {
    borderLeftWidth: 6,
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
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
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
    marginTop: 2,
    borderColor: "rgba(255,255,255,0.4)",
  },
  checkboxInner: { width: 8, height: 8, borderRadius: 2 },
  nodeText: { flex: 1 },
  badgesRow: { flexDirection: "row", gap: 6, marginBottom: 6, flexWrap: "wrap" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  nodeTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#F8FAFC",
    lineHeight: 22,
  },
  dateRow: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 6 },
  dateText: { fontSize: 12, color: "#94A3B8", fontWeight: "500" },
  overdueText: { color: "#EF4444", fontWeight: "700" },
  nodeDesc: { fontSize: 13, color: "#94A3B8", marginTop: 6, fontWeight: "400" },
  strike: { textDecorationLine: "line-through", color: "#64748B" },
  actionButtons: {
    marginLeft: 12,
    gap: 10,
  },
  iconActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(15, 23, 42, 0.28)",
    borderWidth: 1,
    borderColor: "rgba(165, 180, 252, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
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
    right: 24,
    backgroundColor: "#818CF8",
    width: 68,
    height: 68,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    elevation: 25,
    shadowColor: "#6366F1",
    shadowOpacity: 0.8,
    shadowRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.95)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1E1B4B",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    maxHeight: "80%",
    width: "100%",
    borderTopWidth: 2,
    borderColor: "#4F46E5",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#F8FAFC",
  },
  filterSection: {
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#A5B4FC",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  filterOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "rgba(49, 46, 129, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(165, 180, 252, 0.3)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  filterOptionSelected: {
    backgroundColor: "#4F46E5",
    borderColor: "#818CF8",
  },
  filterOptionText: {
    color: "#94A3B8",
    fontWeight: "600",
    fontSize: 14,
  },
  filterOptionTextSelected: {
    color: "#FFFFFF",
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(165, 180, 252, 0.2)",
    gap: 12,
  },
  modalClearBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.2)",
    alignItems: "center",
  },
  modalClearText: {
    color: "#94A3B8",
    fontSize: 16,
    fontWeight: "700",
  },
  modalApplyBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: "#4F46E5",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#818CF8",
  },
  modalApplyText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  reminderBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(165, 180, 252, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    alignSelf: "flex-start",
    gap: 4,
  },
  reminderText: {
    color: "#A5B4FC",
    fontSize: 10,
    fontWeight: "600",
  },
  reminderSubtitle: {
    fontSize: 14,
    color: "#94A3B8",
    marginBottom: 20,
    lineHeight: 20,
  },
  reminderOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(49, 46, 129, 0.7)",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(165, 180, 252, 0.2)",
  },
  reminderOptionSelected: {
    borderColor: "#4F46E5",
    backgroundColor: "rgba(79, 70, 229, 0.1)",
  },
  reminderOptionText: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "500",
  },
  reminderOptionTextSelected: {
    color: "#4F46E5",
    fontWeight: "700",
  },
  descriptionContainer: {
    marginTop: 8,
  },
  expandButton: {
    marginTop: 4,
    alignSelf: "flex-start",
  },
  expandButtonText: {
    color: "#818CF8",
    fontSize: 12,
    fontWeight: "600",
  },
});
