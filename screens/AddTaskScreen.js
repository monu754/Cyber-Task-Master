import DateTimePicker from "@react-native-community/datetimepicker";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
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
  createTask,
  ensureCategory,
  getCategories,
  getTasksWithDetails,
  updateTask,
} from "../database";
import {
  cancelTaskNotifications,
  normalizeReminderMinutes,
  REMINDER_OPTIONS,
  scheduleSingleNotification,
} from "../utils/taskNotifications";

const STATUS_OPTIONS = ["Todo", "In Progress", "Done"];
const PRIORITY_OPTIONS = ["Low", "Medium", "High"];
function Chip({ label, onPress, selected }) {
  return (
    <TouchableOpacity style={[styles.chip, selected && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ChipRow({ children }) {
  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      directionalLockEnabled
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
    >
      {children}
    </ScrollView>
  );
}

function Section({ children, help, title }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {help ? <Text style={styles.helper}>{help}</Text> : null}
      {children}
    </View>
  );
}

export default function AddTaskScreen({ bottomInset, isActive, onCancel, onSaved, taskToEdit, theme }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 390;
  const keyboardVerticalOffset = Platform.OS === "ios" ? Math.max(insets.top, 12) : 28;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("Todo");
  const [priority, setPriority] = useState("Medium");
  const [categories, setCategories] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [categoryId, setCategoryId] = useState(1);
  const [newCategory, setNewCategory] = useState("");
  const [dependencyIds, setDependencyIds] = useState([]);
  const [reminderMinutes, setReminderMinutes] = useState(1440);
  const [date, setDate] = useState(new Date());
  const [hasDeadline, setHasDeadline] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState("date");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    setCategories(getCategories());
    setTasks(getTasksWithDetails());
  }, [isActive]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    if (taskToEdit) {
      setTitle(taskToEdit.title || "");
      setDescription(taskToEdit.description || "");
      setStatus(taskToEdit.status || "Todo");
      setPriority(taskToEdit.priority || "Medium");
      setCategoryId(taskToEdit.category_id || 1);
      setDependencyIds((taskToEdit.dependencies || []).map((item) => item.depends_on_task_id));
      setReminderMinutes(normalizeReminderMinutes(taskToEdit.reminder_minutes));
      setNewCategory("");
      if (taskToEdit.due_date) {
        setDate(new Date(taskToEdit.due_date));
        setHasDeadline(true);
      } else {
        setDate(new Date());
        setHasDeadline(false);
      }
      return;
    }

    setTitle("");
    setDescription("");
    setStatus("Todo");
    setPriority("Medium");
    setCategoryId(1);
    setNewCategory("");
    setDependencyIds([]);
    setReminderMinutes(1440);
    setDate(new Date());
    setHasDeadline(false);
  }, [isActive, taskToEdit]);

  const dependencyOptions = useMemo(
    () => tasks.filter((task) => task.id !== taskToEdit?.id).slice(0, 12),
    [taskToEdit?.id, tasks],
  );
  const themeAccent = theme?.accent || "#2563EB";
  const themeText = theme?.text || "#F8FAFC";
  const themeMuted = theme?.muted || "#94A3B8";
  const themePanel = theme?.panel || "rgba(15, 23, 42, 0.76)";
  const inputBackground = "rgba(255,255,255,0.05)";
  const inputBorder = "rgba(148,163,184,0.18)";
  const minimumDate = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  const onChangeDateTime = (_, selectedDate) => {
    setShowPicker(false);
    if (!selectedDate) {
      return;
    }

    const now = new Date();
    const nextDate = new Date(date);
    if (pickerMode === "date") {
      nextDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    } else {
      nextDate.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);

      const isToday = nextDate.toDateString() === now.toDateString();
      if (isToday && nextDate < now) {
        Alert.alert("Invalid time", "Please choose a future time for today's deadline.");
        return;
      }
    }
    setDate(nextDate);
    setHasDeadline(true);
  };

  const handleSave = async () => {
    if (isSaving) {
      return;
    }

    if (title.trim().length < 3) {
      Alert.alert("Task title required", "Please enter at least 3 characters.");
      return;
    }

    if (hasDeadline && date < new Date()) {
      Alert.alert("Invalid deadline", "Please choose a future date and time.");
      return;
    }

    setIsSaving(true);

    try {
      const category = newCategory.trim()
        ? ensureCategory({ name: newCategory.trim() })
        : categories.find((item) => item.id === categoryId);

      const payload = {
        title: title.trim(),
        description: description.trim(),
        itemType: "task",
        status,
        priority,
        categoryId: category?.id || 1,
        workspaceId: 1,
        projectId: 1,
        dueDate: hasDeadline ? date.toISOString() : null,
        reminderMinutes,
        recurrence: "none",
        estimatedMinutes: 0,
        tags: [],
        dependencyIds,
        subtasks: [],
      };

      const savedTask = taskToEdit
        ? updateTask({ id: taskToEdit.id, ...payload })
        : createTask(payload);

      if (taskToEdit) {
        await cancelTaskNotifications(taskToEdit.id);
      }
      if (savedTask?.due_date && savedTask.status !== "Done") {
        await scheduleSingleNotification({ ...savedTask, completed: 0 });
      }
      onSaved?.();
    } catch (error) {
      console.error("Failed to save task:", error);
      Alert.alert("Unable to save task", "Something went wrong while saving. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme?.gradient?.[0] || "#07111F" }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme?.gradient?.[0] || "#07111F"} />
      <LinearGradient colors={theme?.gradient || ["#07111F", "#0B172A", "#122033"]} style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.safeArea}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={keyboardVerticalOffset}
        >
          <ScrollView
            style={styles.container}
            contentContainerStyle={[styles.content, { paddingBottom: Math.max(bottomInset, insets.bottom + 28) }]}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.headerText}>
              <Text style={[styles.eyebrow, { color: themeAccent }]}>Create task</Text>
              <Text style={[styles.title, isCompact && styles.titleCompact, { color: themeText }]}>
                {taskToEdit ? "Edit task" : "New task"}
              </Text>
              <Text style={[styles.subtitle, isCompact && styles.subtitleCompact, { color: themeMuted }]}>
                Capture one-time work here. Recurring routines now belong in the habit tracker.
              </Text>
            </View>

            <View style={[styles.card, { backgroundColor: themePanel }]}>
            <Section title="Task name *" help="Use a short action like 'Submit report' or 'Call Rahul'.">
              <TextInput
                style={[styles.input, { backgroundColor: inputBackground, borderColor: inputBorder, color: themeText }]}
                placeholder="What needs to get done?"
                placeholderTextColor={themeMuted}
                value={title}
                onChangeText={setTitle}
              />
            </Section>

            <Section title="Category" help="A simple group like Work, Personal, Study, or Health.">
              <ChipRow>
                {categories.map((item) => (
                  <Chip
                    key={item.id}
                    label={item.name}
                    selected={categoryId === item.id && !newCategory.trim()}
                    onPress={() => {
                      setCategoryId(item.id);
                      setNewCategory("");
                    }}
                  />
                ))}
              </ChipRow>
              <TextInput
                style={[styles.input, styles.topGap, { backgroundColor: inputBackground, borderColor: inputBorder, color: themeText }]}
                placeholder="Add a new category"
                placeholderTextColor={themeMuted}
                value={newCategory}
                onChangeText={setNewCategory}
              />
            </Section>

            <Section title="Status" help="Choose whether the task is pending, active, or done.">
              <ChipRow>
                {STATUS_OPTIONS.map((item) => (
                  <Chip key={item} label={item} selected={status === item} onPress={() => setStatus(item)} />
                ))}
              </ChipRow>
            </Section>

            <Section title="Priority" help="High means it should be handled sooner than the rest.">
              <ChipRow>
                {PRIORITY_OPTIONS.map((item) => (
                  <Chip key={item} label={item} selected={priority === item} onPress={() => setPriority(item)} />
                ))}
              </ChipRow>
            </Section>

            <Section title="Deadline" help="Set the date and time when this task should be finished.">
              <View style={styles.row}>
                <TouchableOpacity
                  style={[styles.dateButton, { backgroundColor: inputBackground, borderColor: inputBorder }]}
                  onPress={() => {
                    setPickerMode("date");
                    setShowPicker(true);
                  }}
                >
                  <Text style={[styles.dateText, { color: themeText }]}>{hasDeadline ? date.toLocaleDateString() : "Set date"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dateButton, { backgroundColor: inputBackground, borderColor: inputBorder }]}
                  onPress={() => {
                    setPickerMode("time");
                    setShowPicker(true);
                  }}
                >
                  <Text style={[styles.dateText, { color: themeText }]}>
                    {hasDeadline
                      ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "Set time"}
                  </Text>
                </TouchableOpacity>
              </View>
              {showPicker ? (
                <DateTimePicker
                  value={date}
                  mode={pickerMode}
                  display="default"
                  minimumDate={pickerMode === "date" ? minimumDate : undefined}
                  onChange={onChangeDateTime}
                />
              ) : null}
            </Section>

            <Section title="Reminder" help="Choose when you want the app to remind you.">
              <ChipRow>
                {REMINDER_OPTIONS.map((item) => (
                  <Chip
                    key={item.value}
                    label={item.label}
                    selected={reminderMinutes === item.value}
                    onPress={() => setReminderMinutes(item.value)}
                  />
                ))}
              </ChipRow>
            </Section>

            <Section title="Dependencies" help="Choose tasks that must finish before this one starts.">
              <ChipRow>
                {dependencyOptions.map((item) => (
                  <Chip
                    key={item.id}
                    label={item.title}
                    selected={dependencyIds.includes(item.id)}
                    onPress={() =>
                      setDependencyIds((current) =>
                        current.includes(item.id)
                          ? current.filter((id) => id !== item.id)
                          : [...current, item.id],
                      )
                    }
                  />
                ))}
              </ChipRow>
            </Section>

            <Section title="Notes" help="Anything helpful you want to remember later.">
              <TextInput
                style={[styles.input, styles.multiInput, { backgroundColor: inputBackground, borderColor: inputBorder, color: themeText }]}
                multiline
                textAlignVertical="top"
                placeholder="Add context, definition of done, or extra details."
                placeholderTextColor={themeMuted}
                value={description}
                onChangeText={setDescription}
              />
            </Section>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={onCancel}>
              <Text style={styles.secondaryText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: themeAccent }]}
              onPress={handleSave}
              disabled={isSaving}
            >
              <Text style={styles.primaryText}>
                {isSaving ? "Saving..." : taskToEdit ? "Update task" : "Save task"}
              </Text>
            </TouchableOpacity>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 18, gap: 18 },
  headerText: { gap: 8 },
  eyebrow: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  title: { fontSize: 30, fontWeight: "900" },
  titleCompact: { fontSize: 26 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  subtitleCompact: { fontSize: 14, lineHeight: 20 },
  card: { borderRadius: 24, padding: 18, borderWidth: 1, borderColor: "rgba(148,163,184,0.14)", gap: 18 },
  section: { gap: 8 },
  sectionTitle: { color: "#7DD3FC", fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 },
  helper: { color: "#94A3B8", fontSize: 13, lineHeight: 19 },
  input: { minHeight: 54, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(148,163,184,0.16)", color: "#F8FAFC", paddingHorizontal: 16, fontSize: 15 },
  multiInput: { minHeight: 110, paddingTop: 14 },
  chipRow: { gap: 10, paddingRight: 18, alignItems: "center" },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(148,163,184,0.16)" },
  chipActive: { backgroundColor: "rgba(37,99,235,0.18)", borderColor: "rgba(96,165,250,0.6)" },
  chipText: { color: "#B8C6D5", fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: "#F8FAFC" },
  row: { flexDirection: "row", gap: 12 },
  dateButton: { flex: 1, minHeight: 52, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(148,163,184,0.16)", alignItems: "center", justifyContent: "center" },
  dateText: { color: "#F8FAFC", fontWeight: "700" },
  topGap: { marginTop: 4 },
  actionRow: { flexDirection: "row", gap: 12 },
  secondaryButton: { flex: 0.38, minHeight: 52, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.04)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(148,163,184,0.14)" },
  primaryButton: { flex: 1, minHeight: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: "#B8C6D5", fontSize: 15, fontWeight: "800" },
  primaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
});
