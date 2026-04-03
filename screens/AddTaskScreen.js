import DateTimePicker from "@react-native-community/datetimepicker";
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
  ensureProject,
  ensureWorkspace,
  getCategories,
  getProjects,
  getTags,
  getTasksWithDetails,
  getWorkspaces,
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
const RECURRENCE_OPTIONS = ["none", "daily", "weekly"];

const parseList = (value, separator = ",") =>
  value
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);

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
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("Todo");
  const [priority, setPriority] = useState("Medium");
  const [categories, setCategories] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tags, setTags] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [categoryId, setCategoryId] = useState(1);
  const [workspaceId, setWorkspaceId] = useState(1);
  const [projectId, setProjectId] = useState(1);
  const [newCategory, setNewCategory] = useState("");
  const [newWorkspace, setNewWorkspace] = useState("");
  const [newProject, setNewProject] = useState("");
  const [tagText, setTagText] = useState("");
  const [subtaskText, setSubtaskText] = useState("");
  const [dependencyIds, setDependencyIds] = useState([]);
  const [estimatedMinutes, setEstimatedMinutes] = useState("30");
  const [recurrence, setRecurrence] = useState("none");
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
    setWorkspaces(getWorkspaces());
    setProjects(getProjects());
    setTags(getTags());
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
      setWorkspaceId(taskToEdit.workspace_id || 1);
      setProjectId(taskToEdit.project_id || 1);
      setTagText((taskToEdit.tags || []).map((tag) => tag.name).join(", "));
      setSubtaskText((taskToEdit.subtasks || []).map((subtask) => subtask.title).join("\n"));
      setDependencyIds((taskToEdit.dependencies || []).map((item) => item.depends_on_task_id));
      setEstimatedMinutes(String(taskToEdit.estimated_minutes || 30));
      setRecurrence(taskToEdit.recurrence || "none");
      setReminderMinutes(normalizeReminderMinutes(taskToEdit.reminder_minutes));
      setNewCategory("");
      setNewWorkspace("");
      setNewProject("");
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
    setWorkspaceId(1);
    setProjectId(1);
    setNewCategory("");
    setNewWorkspace("");
    setNewProject("");
    setTagText("");
    setSubtaskText("");
    setDependencyIds([]);
    setEstimatedMinutes("30");
    setRecurrence("none");
    setReminderMinutes(1440);
    setDate(new Date());
    setHasDeadline(false);
  }, [isActive, taskToEdit]);

  const availableProjects = useMemo(
    () => projects.filter((project) => project.workspace_id === workspaceId),
    [projects, workspaceId],
  );
  const dependencyOptions = useMemo(
    () => tasks.filter((task) => task.id !== taskToEdit?.id).slice(0, 12),
    [taskToEdit?.id, tasks],
  );
  const themeAccent = theme?.accent || "#2563EB";
  const themeText = theme?.text || "#F8FAFC";
  const themeMuted = theme?.muted || "#94A3B8";
  const minimumDate = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  useEffect(() => {
    if (!isActive || newProject.trim()) {
      return;
    }

    if (availableProjects.length === 0) {
      setProjectId(1);
      return;
    }

    const hasSelectedProject = availableProjects.some((project) => project.id === projectId);
    if (!hasSelectedProject) {
      setProjectId(availableProjects[0].id);
    }
  }, [availableProjects, isActive, newProject, projectId]);

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
      const workspace = newWorkspace.trim()
        ? ensureWorkspace({ name: newWorkspace.trim() })
        : workspaces.find((item) => item.id === workspaceId);
      const resolvedWorkspaceId = workspace?.id || 1;

      let project = null;
      if (newProject.trim()) {
        project = ensureProject({ name: newProject.trim(), workspaceId: resolvedWorkspaceId });
      } else {
        project = availableProjects.find((item) => item.id === projectId) || null;
      }

      if (!project) {
        project = ensureProject({ name: "General", workspaceId: resolvedWorkspaceId });
      }

      const payload = {
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        categoryId: category?.id || 1,
        workspaceId: resolvedWorkspaceId,
        projectId: project.id,
        dueDate: hasDeadline ? date.toISOString() : null,
        reminderMinutes,
        recurrence,
        estimatedMinutes: Number(estimatedMinutes) || 0,
        tags: parseList(tagText).map((name) => ({ name })),
        dependencyIds,
        subtasks: parseList(subtaskText, "\n").map((name) => ({ name })),
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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={theme?.gradient?.[0] || "#07111F"} />
      <KeyboardAvoidingView style={styles.safeArea} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(bottomInset, insets.bottom + 28) }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerText}>
            <Text style={[styles.eyebrow, { color: themeAccent }]}>Create task</Text>
            <Text style={[styles.title, isCompact && styles.titleCompact, { color: themeText }]}>
              {taskToEdit ? "Edit task" : "New task"}
            </Text>
            <Text style={[styles.subtitle, isCompact && styles.subtitleCompact, { color: themeMuted }]}>
              Start with the basics. The sections below explain what each option does.
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: theme?.panel || "rgba(15, 23, 42, 0.76)" }]}>
            <Section title="Task name *" help="Use a short action like 'Submit report' or 'Call Rahul'.">
              <TextInput
                style={styles.input}
                placeholder="What needs to get done?"
                placeholderTextColor="#64748B"
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
                style={[styles.input, styles.topGap]}
                placeholder="Add a new category"
                placeholderTextColor="#64748B"
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

            <Section title="Workspace" help="A big area of work like Office, Home, or Freelance.">
              <ChipRow>
                {workspaces.map((item) => (
                  <Chip
                    key={item.id}
                    label={item.name}
                    selected={workspaceId === item.id && !newWorkspace.trim()}
                    onPress={() => {
                      setWorkspaceId(item.id);
                      setNewWorkspace("");
                    }}
                  />
                ))}
              </ChipRow>
              <TextInput
                style={[styles.input, styles.topGap]}
                placeholder="Add a new workspace"
                placeholderTextColor="#64748B"
                value={newWorkspace}
                onChangeText={setNewWorkspace}
              />
            </Section>

            <Section title="Project" help="A smaller group inside a workspace, such as Website Redesign.">
              <ChipRow>
                {availableProjects.map((item) => (
                  <Chip
                    key={item.id}
                    label={item.name}
                    selected={projectId === item.id && !newProject.trim()}
                    onPress={() => {
                      setProjectId(item.id);
                      setNewProject("");
                    }}
                  />
                ))}
              </ChipRow>
              <TextInput
                style={[styles.input, styles.topGap]}
                placeholder="Add a new project"
                placeholderTextColor="#64748B"
                value={newProject}
                onChangeText={setNewProject}
              />
            </Section>

            <Section title="Deadline" help="Set the date and time when this task should be finished.">
              <View style={styles.row}>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => {
                    setPickerMode("date");
                    setShowPicker(true);
                  }}
                >
                  <Text style={styles.dateText}>{hasDeadline ? date.toLocaleDateString() : "Set date"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => {
                    setPickerMode("time");
                    setShowPicker(true);
                  }}
                >
                  <Text style={styles.dateText}>
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

            <Section title="Repeat" help="Use this only for tasks that come back regularly.">
              <ChipRow>
                {RECURRENCE_OPTIONS.map((item) => (
                  <Chip key={item} label={item} selected={recurrence === item} onPress={() => setRecurrence(item)} />
                ))}
              </ChipRow>
            </Section>

            <Section title="Estimated time" help="Roughly how many minutes the task will take.">
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="30"
                placeholderTextColor="#64748B"
                value={estimatedMinutes}
                onChangeText={setEstimatedMinutes}
              />
            </Section>

            <Section title="Tags" help="Optional keywords that make searching easier later.">
              <TextInput
                style={styles.input}
                placeholder="urgent, design, review"
                placeholderTextColor="#64748B"
                value={tagText}
                onChangeText={setTagText}
              />
              <ChipRow>
                {tags.slice(0, 10).map((item) => (
                  <Chip
                    key={item.id}
                    label={item.name}
                    selected={parseList(tagText).includes(item.name)}
                    onPress={() => setTagText([...new Set([...parseList(tagText), item.name])].join(", "))}
                  />
                ))}
              </ChipRow>
            </Section>

            <Section title="Subtasks" help="Break a big task into smaller steps, one per line.">
              <TextInput
                style={[styles.input, styles.multiInput]}
                multiline
                textAlignVertical="top"
                placeholder={"Draft outline\nReview notes\nSubmit final version"}
                placeholderTextColor="#64748B"
                value={subtaskText}
                onChangeText={setSubtaskText}
              />
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
                style={[styles.input, styles.multiInput]}
                multiline
                textAlignVertical="top"
                placeholder="Add context, definition of done, or extra details."
                placeholderTextColor="#64748B"
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
