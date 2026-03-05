import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import * as SQLite from "expo-sqlite";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  AppState,
  Modal,
  ScrollView
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");
const db = SQLite.openDatabaseSync("cyber_task_master.db");

// Simple notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Reminder options for user to choose from
const REMINDER_OPTIONS = [
  { label: 'At time of task', value: 0 },
  { label: '5 minutes before', value: 5 },
  { label: '15 minutes before', value: 15 },
  { label: '30 minutes before', value: 30 },
  { label: '1 hour before', value: 60 },
  { label: '2 hours before', value: 120 },
  { label: '6 hours before', value: 360 },
  { label: '12 hours before', value: 720 },
  { label: '1 day before', value: 1440 },
  { label: '2 days before', value: 2880 },
  { label: '1 week before', value: 10080 },
];

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  
  // Filter states
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({
    timeRange: "all",
    priority: "all",
    status: "all",
    category: "all",
  });
  
  // Reminder settings modal
  const [reminderModalVisible, setReminderModalVisible] = useState(false);
  const [selectedTaskForReminder, setSelectedTaskForReminder] = useState(null);
  const [selectedReminderMinutes, setSelectedReminderMinutes] = useState(1440); // Default 1 day
  
  // Categories for filter
  const [categories, setCategories] = useState([]);

  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const notificationListener = useRef();
  const responseListener = useRef();

  // Load categories
  const loadCategories = useCallback(() => {
    try {
      const cats = db.getAllSync('SELECT * FROM categories ORDER BY name');
      setCategories(cats);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  }, []);

  // Request permissions
  const requestPermissions = async () => {
    try {
      await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
    } catch (error) {
      console.error("Permission error:", error);
    }
  };

  // Cancel all notifications for a specific task
  const cancelTaskNotifications = async (taskId) => {
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      for (const notification of scheduledNotifications) {
        if (notification.content.data?.taskId === taskId) {
          await Notifications.cancelScheduledNotificationAsync(notification.identifier);
          console.log(`Cancelled notification for task ${taskId}`);
        }
      }
    } catch (error) {
      console.error("Error canceling notifications:", error);
    }
  };

  // Schedule a single notification for a task
  const scheduleSingleNotification = async (task) => {
    if (!task.due_date || task.completed === 1) return;

    try {
      const dueDate = new Date(task.due_date);
      const now = new Date();

      if (dueDate <= now) return;

      // Get reminder minutes from task (default to 1440 = 1 day)
      const reminderMinutes = task.reminder_minutes || 1440;
      
      // Calculate reminder time
      const reminderTime = reminderMinutes > 0 
        ? new Date(dueDate.getTime() - reminderMinutes * 60 * 1000)
        : dueDate;

      if (reminderTime > now) {
        // Format the notification title based on reminder type
        let title = "⏰ Task Due";
        let body = `"${task.title}" is due now!`;
        
        if (reminderMinutes > 0) {
          if (reminderMinutes < 60) {
            title = `⏳ Due in ${reminderMinutes} minutes`;
          } else if (reminderMinutes < 1440) {
            title = `⏳ Due in ${reminderMinutes / 60} hours`;
          } else {
            title = `⏳ Due in ${reminderMinutes / 1440} days`;
          }
          body = `"${task.title}" is due soon!`;
        }

        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            data: { 
              taskId: task.id, 
              reminderMinutes,
              taskTitle: task.title 
            },
            sound: true,
          },
          trigger: {
            type: 'date',
            date: reminderTime,
            channelId: Platform.OS === "android" ? "default" : null,
          }
        });
        
        console.log(`Scheduled ONE notification for task ${task.id} at ${reminderTime}`);
      }
    } catch (error) {
      console.log("Notification scheduling error:", error);
    }
  };

  // Update notifications for a specific task
  const updateTaskNotifications = async (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    // First cancel existing notifications for this task
    await cancelTaskNotifications(taskId);
    
    // Then schedule a new one if needed
    await scheduleSingleNotification(task);
  };

  // This function should ONLY be called when tasks are first loaded or when a task is modified
  const syncAllNotifications = useCallback(async () => {
    try {
      console.log("Syncing all notifications...");
      
      // Get all pending tasks with due dates
      const pendingTasks = tasks.filter(t => t.due_date && t.completed === 0);
      
      // For each task, cancel old and schedule new
      for (const task of pendingTasks) {
        await cancelTaskNotifications(task.id);
        await scheduleSingleNotification(task);
      }
      
      console.log(`Synced ${pendingTasks.length} task notifications`);
    } catch (error) {
      console.error("Error syncing notifications:", error);
    }
  }, [tasks]);

  // Apply filters and search to tasks
  const applyFilters = useCallback((allTasks, query, filters) => {
    let result = [...allTasks];
    
    // Apply search
    if (query.trim()) {
      const searchLower = query.toLowerCase().trim();
      result = result.filter(task => 
        task.title.toLowerCase().includes(searchLower) ||
        (task.description && task.description.toLowerCase().includes(searchLower))
      );
    }
    
    // Apply time range filter
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekLater = new Date(today);
    weekLater.setDate(weekLater.getDate() + 7);
    
    if (filters.timeRange === 'today') {
      result = result.filter(task => {
        if (!task.due_date) return false;
        const dueDate = new Date(task.due_date);
        return dueDate >= today && dueDate < new Date(today.getTime() + 24 * 60 * 60 * 1000);
      });
    } else if (filters.timeRange === 'week') {
      result = result.filter(task => {
        if (!task.due_date) return false;
        const dueDate = new Date(task.due_date);
        return dueDate >= today && dueDate <= weekLater;
      });
    }
    
    // Apply priority filter
    if (filters.priority !== 'all') {
      result = result.filter(task => task.priority === filters.priority);
    }
    
    // Apply status filter
    if (filters.status === 'completed') {
      result = result.filter(task => task.completed === 1);
    } else if (filters.status === 'pending') {
      result = result.filter(task => task.completed === 0);
    }
    
    // Apply category filter
    if (filters.category !== 'all') {
      result = result.filter(task => task.category_id === filters.category);
    }
    
    return result;
  }, []);

  const loadTasks = useCallback(() => {
    try {
      // Check if reminder_minutes column exists, if not add it
      try {
        db.runSync('ALTER TABLE tasks ADD COLUMN reminder_minutes INTEGER DEFAULT 1440');
      } catch (e) {
        // Column might already exist, ignore error
      }

      const allTasks = db.getAllSync(`
        SELECT tasks.*, categories.name AS category_name, categories.color AS category_color 
        FROM tasks LEFT JOIN categories ON tasks.category_id = categories.id 
        ORDER BY tasks.completed ASC, 
               CASE WHEN tasks.due_date IS NOT NULL THEN 1 ELSE 0 END DESC,
               tasks.due_date ASC,
               tasks.id DESC
      `);
      setTasks(allTasks);
      
      // Apply current filters
      const filtered = applyFilters(allTasks, searchQuery, selectedFilters);
      setFilteredTasks(filtered);
      
    } catch (error) {
      console.error("Error loading tasks:", error);
    }
  }, [searchQuery, selectedFilters, applyFilters]);

  // Update filtered tasks when search or filters change
  useEffect(() => {
    const filtered = applyFilters(tasks, searchQuery, selectedFilters);
    setFilteredTasks(filtered);
  }, [searchQuery, selectedFilters, tasks, applyFilters]);

  // CRITICAL FIX: Only sync notifications when tasks array actually changes
  // This prevents duplicate notifications
  useEffect(() => {
    // Use a debounce to prevent multiple rapid calls
    const timeoutId = setTimeout(() => {
      if (tasks.length > 0) {
        syncAllNotifications();
      }
    }, 1000);
    
    return () => clearTimeout(timeoutId);
  }, [tasks, syncAllNotifications]);

  useEffect(() => {
    loadCategories();
    requestPermissions();

    // Setup listeners
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log("Notification received:", notification.request.content.data);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const { taskId, taskTitle } = response.notification.request.content.data;
      if (taskId) {
        Alert.alert(
          "Task Reminder", 
          `Would you like to view "${taskTitle || 'this task'}"?`,
          [
            { text: "Cancel", style: "cancel" },
            { text: "View", onPress: () => {
              // You can navigate to task details here
              console.log("View task:", taskId);
            }}
          ]
        );
      }
    });

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
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
  }, []);

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
  }, []);

  const toggleComplete = (id) => {
    const task = tasks.find((t) => t.id === id);
    const newStatus = task.completed === 1 ? 0 : 1;
    db.runSync("UPDATE tasks SET completed = ? WHERE id = ?", [newStatus, id]);
    
    // If task is completed, cancel its notifications
    if (newStatus === 1) {
      cancelTaskNotifications(id);
    }
    
    loadTasks();
  };

  const deleteTask = (id) => {
    Alert.alert("Delete Objective", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        onPress: async () => {
          // Cancel notifications before deleting
          await cancelTaskNotifications(id);
          db.runSync("DELETE FROM tasks WHERE id = ?", [id]);
          loadTasks();
        },
        style: "destructive",
      },
    ]);
  };

  const updateTaskReminder = async (taskId, minutes) => {
    db.runSync("UPDATE tasks SET reminder_minutes = ? WHERE id = ?", [minutes, taskId]);
    
    // Update the specific task's notification
    const updatedTask = tasks.find(t => t.id === taskId);
    if (updatedTask) {
      await cancelTaskNotifications(taskId);
      await scheduleSingleNotification({...updatedTask, reminder_minutes: minutes});
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

  const completedCount = tasks.filter((t) => t.completed === 1).length;
  const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  const formatDisplayDate = (isoString) => {
    if (!isoString) return null;
    const date = new Date(isoString);
    const now = new Date();
    const diffHours = (date - now) / (1000 * 60 * 60);
    
    let emoji = "⏰";
    if (diffHours < 0) emoji = "🔥";
    else if (diffHours < 24) emoji = "⚡";
    
    return `${emoji} ${date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  };

  const getReminderLabel = (minutes) => {
    const option = REMINDER_OPTIONS.find(opt => opt.value === minutes);
    return option ? option.label : 'Custom';
  };

  // Count active filters
  const activeFilterCount = Object.values(selectedFilters).filter(v => v !== 'all').length;

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
            <View>
              <Text style={styles.greeting}>Welcome Back</Text>
              <Text style={styles.headerTitle}>Objectives</Text>
            </View>
            <View style={styles.taskBadge}>
              <Text style={styles.badgeNumber}>
                {completedCount}/{tasks.length}
              </Text>
              <Text style={styles.badgeLabel}>Completed</Text>
            </View>
          </View>
          
          {/* Search and Filter Bar */}
          <View style={styles.searchFilterBar}>
            <TouchableOpacity 
              style={styles.searchIconBtn}
              onPress={() => setShowSearch(!showSearch)}
            >
              <Ionicons name="search" size={22} color="#A5B4FC" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.filterBtn, activeFilterCount > 0 && styles.activeFilterBtn]}
              onPress={() => setFilterModalVisible(true)}
            >
              <Ionicons name="filter" size={20} color={activeFilterCount > 0 ? "#FFFFFF" : "#A5B4FC"} />
              {activeFilterCount > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              )}
              <Text style={[styles.filterBtnText, activeFilterCount > 0 && styles.activeFilterText]}>
                Filters
              </Text>
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          {showSearch && (
            <Animated.View style={styles.searchContainer}>
              <Ionicons name="search-outline" size={20} color="#64748B" style={styles.searchIcon} />
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

        {/* Results count */}
        <View style={styles.resultsInfo}>
          <Text style={styles.resultsText}>
            Showing {filteredTasks.length} of {tasks.length} tasks
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
            const isOverdue = item.due_date && new Date(item.due_date) < new Date() && item.completed === 0;

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
                      <View
                        style={[
                          styles.checkboxInner,
                          { backgroundColor: categoryColor },
                        ]}
                      />
                    )}
                  </View>
                  <View style={styles.nodeText}>
                    <View style={styles.badgesRow}>
                      {item.category_name && (
                        <View
                          style={[
                            styles.badge,
                            {
                              backgroundColor: categoryColor + "20",
                              borderColor: categoryColor + "40",
                            },
                          ]}
                        >
                          <Ionicons
                            name="folder"
                            size={10}
                            color={categoryColor}
                            style={{ marginRight: 4 }}
                          />
                          <Text
                            style={[styles.badgeText, { color: categoryColor }]}
                          >
                            {item.category_name}
                          </Text>
                        </View>
                      )}
                      <View
                        style={[
                          styles.badge,
                          {
                            backgroundColor: priorityColor + "20",
                            borderColor: priorityColor + "40",
                          },
                        ]}
                      >
                        <Text
                          style={[styles.badgeText, { color: priorityColor }]}
                        >
                          {item.priority}
                        </Text>
                      </View>
                      {isOverdue && (
                        <View style={[styles.badge, { backgroundColor: "#EF444420", borderColor: "#EF444440" }]}>
                          <Text style={[styles.badgeText, { color: "#EF4444" }]}>OVERDUE</Text>
                        </View>
                      )}
                    </View>

                    <Text
                      style={[
                        styles.nodeTitle,
                        item.completed === 1 && styles.strike,
                      ]}
                      numberOfLines={2}
                    >
                      {item.title}
                    </Text>

                    {item.due_date && (
                      <View style={styles.dateRow}>
                        <Ionicons
                          name={isOverdue ? "alert-circle" : "time-outline"}
                          size={14}
                          color={isOverdue ? "#EF4444" : (item.completed === 1 ? "#64748B" : "#94A3B8")}
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

                    {/* Reminder Badge */}
                    {item.due_date && item.completed === 0 && (
                      <TouchableOpacity 
                        style={styles.reminderBadge}
                        onPress={() => {
                          setSelectedTaskForReminder(item);
                          setSelectedReminderMinutes(item.reminder_minutes || 1440);
                          setReminderModalVisible(true);
                        }}
                      >
                        <Ionicons name="notifications-outline" size={12} color="#A5B4FC" />
                        <Text style={styles.reminderText}>
                          {getReminderLabel(item.reminder_minutes || 1440)}
                        </Text>
                      </TouchableOpacity>
                    )}

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
                  ? "Create a new objective to get started"
                  : "Try adjusting your search or filters"}
              </Text>
            </View>
          }
        />

        <TouchableOpacity
          style={styles.plusFab}
          onPress={() => navigation.navigate("AddTask")}
          activeOpacity={0.8}
        >
          <Ionicons name="add-sharp" size={40} color="#FFF" />
        </TouchableOpacity>
      </Animated.View>

      {/* Filter Modal */}
      <Modal
        animationType="slide"
        transparent={true}
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
              {/* Time Range Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>DUE DATE</Text>
                <View style={styles.filterOptions}>
                  {[
                    { value: 'all', label: 'All' },
                    { value: 'today', label: 'Today' },
                    { value: 'week', label: 'This Week' }
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.filterOption,
                        selectedFilters.timeRange === option.value && styles.filterOptionSelected
                      ]}
                      onPress={() => setSelectedFilters({...selectedFilters, timeRange: option.value})}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        selectedFilters.timeRange === option.value && styles.filterOptionTextSelected
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Priority Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>PRIORITY</Text>
                <View style={styles.filterOptions}>
                  {[
                    { value: 'all', label: 'All' },
                    { value: 'High', label: 'High' },
                    { value: 'Medium', label: 'Medium' },
                    { value: 'Low', label: 'Low' }
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.filterOption,
                        selectedFilters.priority === option.value && styles.filterOptionSelected
                      ]}
                      onPress={() => setSelectedFilters({...selectedFilters, priority: option.value})}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        selectedFilters.priority === option.value && styles.filterOptionTextSelected
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Status Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>STATUS</Text>
                <View style={styles.filterOptions}>
                  {[
                    { value: 'all', label: 'All' },
                    { value: 'pending', label: 'Active' },
                    { value: 'completed', label: 'Completed' }
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.filterOption,
                        selectedFilters.status === option.value && styles.filterOptionSelected
                      ]}
                      onPress={() => setSelectedFilters({...selectedFilters, status: option.value})}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        selectedFilters.status === option.value && styles.filterOptionTextSelected
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Category Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>CATEGORY</Text>
                <View style={styles.filterOptions}>
                  <TouchableOpacity
                    style={[
                      styles.filterOption,
                      selectedFilters.category === 'all' && styles.filterOptionSelected
                    ]}
                    onPress={() => setSelectedFilters({...selectedFilters, category: 'all'})}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      selectedFilters.category === 'all' && styles.filterOptionTextSelected
                    ]}>
                      All
                    </Text>
                  </TouchableOpacity>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.filterOption,
                        selectedFilters.category === cat.id && styles.filterOptionSelected,
                        { borderColor: cat.color + '40' }
                      ]}
                      onPress={() => setSelectedFilters({...selectedFilters, category: cat.id})}
                    >
                      <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                      <Text style={[
                        styles.filterOptionText,
                        selectedFilters.category === cat.id && styles.filterOptionTextSelected
                      ]}>
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

      {/* Reminder Settings Modal */}
      <Modal
        animationType="slide"
        transparent={true}
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
              When would you like to be reminded for "{selectedTaskForReminder?.title}"?
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {REMINDER_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.reminderOption,
                    selectedReminderMinutes === option.value && styles.reminderOptionSelected
                  ]}
                  onPress={() => setSelectedReminderMinutes(option.value)}
                >
                  <Text style={[
                    styles.reminderOptionText,
                    selectedReminderMinutes === option.value && styles.reminderOptionTextSelected
                  ]}>
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
                onPress={() => updateTaskReminder(selectedTaskForReminder.id, selectedReminderMinutes)}
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
  listContent: { paddingBottom: 120 },
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
  // Modal Styles
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
    width: '100%',
    borderTopWidth: 2,
    borderLeftWidth: 0,
    borderRightWidth: 0,
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
    alignSelf: 'flex-start',
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
});