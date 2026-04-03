import { Ionicons } from "@expo/vector-icons";
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
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { createTask, getCategories, updateTask } from "../database";
import {
  cancelTaskNotifications,
  getReminderLabel,
  normalizeReminderMinutes,
  REMINDER_OPTIONS,
  scheduleSingleNotification,
} from "../utils/taskNotifications";

export default function AddTaskScreen({ bottomInset, isActive, onCancel, onSaved, taskToEdit }) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(1);
  const [date, setDate] = useState(new Date());
  const [hasDeadline, setHasDeadline] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState(1440);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState("date");
  const [focusedField, setFocusedField] = useState(null);

  useEffect(() => {
    try {
      const loadedCategories = getCategories();
      setCategories(loadedCategories);
      setSelectedCategory((current) => current || loadedCategories[0]?.id || 1);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  }, []);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    if (taskToEdit) {
      setTitle(taskToEdit.title || "");
      setDescription(taskToEdit.description || "");
      setPriority(taskToEdit.priority || "Medium");
      setSelectedCategory(taskToEdit.category_id || categories[0]?.id || 1);
      setReminderMinutes(normalizeReminderMinutes(taskToEdit.reminder_minutes));

      if (taskToEdit.due_date) {
        const parsedDate = new Date(taskToEdit.due_date);
        if (!Number.isNaN(parsedDate.getTime())) {
          setDate(parsedDate);
          setHasDeadline(true);
        }
      } else {
        setDate(new Date());
        setHasDeadline(false);
      }

      return;
    }

    setTitle("");
    setDescription("");
    setPriority("Medium");
    setSelectedCategory(categories[0]?.id || 1);
    setDate(new Date());
    setHasDeadline(false);
    setReminderMinutes(1440);
  }, [categories, isActive, taskToEdit]);

  const reminderPreview = useMemo(() => getReminderLabel(reminderMinutes), [reminderMinutes]);
  const isEditMode = Boolean(taskToEdit);
  const selectedCategoryDetails = categories.find((category) => category.id === selectedCategory);
  const deadlinePreview = hasDeadline
    ? `${date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })} at ${date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : "No deadline yet";

  const validateFutureDateTime = (candidate) => {
    if (candidate <= new Date()) {
      Alert.alert("Invalid deadline", "Please choose a future date and time.");
      return false;
    }

    return true;
  };

  const onChangeDateTime = (_, selectedDate) => {
    setShowPicker(false);

    if (!selectedDate) {
      return;
    }

    const nextDate = new Date(date);

    if (pickerMode === "date") {
      nextDate.setFullYear(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
      );
    } else {
      nextDate.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
    }

    if (pickerMode === "time" && !validateFutureDateTime(nextDate)) {
      return;
    }

    setDate(nextDate);
    setHasDeadline(true);

    if (pickerMode === "date" && Platform.OS === "android") {
      setTimeout(() => {
        setPickerMode("time");
        setShowPicker(true);
      }, 100);
    }
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      Alert.alert("Missing title", "Please enter a task title.");
      return;
    }

    if (trimmedTitle.length < 3) {
      Alert.alert("Short title", "Task titles should be at least 3 characters.");
      return;
    }

    if (hasDeadline && !validateFutureDateTime(date)) {
      return;
    }

    const dueDateIso = hasDeadline ? date.toISOString() : null;
    const payload = {
      title: trimmedTitle,
      description: description.trim(),
      priority,
      categoryId: selectedCategory,
      dueDate: dueDateIso,
      reminderMinutes,
    };

    if (isEditMode) {
      updateTask({ id: taskToEdit.id, ...payload });
      await cancelTaskNotifications(taskToEdit.id);

      if (hasDeadline && taskToEdit.completed === 0) {
        await scheduleSingleNotification({
          ...taskToEdit,
          ...payload,
          category_id: selectedCategory,
          due_date: dueDateIso,
          reminder_minutes: reminderMinutes,
        });
      }
    } else {
      const result = createTask(payload);

      if (hasDeadline) {
        await scheduleSingleNotification({
          id: result.lastInsertRowId,
          title: trimmedTitle,
          due_date: dueDateIso,
          reminder_minutes: reminderMinutes,
          completed: 0,
        });
      }
    }

    onSaved?.();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#07111F" />
      <KeyboardAvoidingView
        style={styles.safeArea}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(bottomInset, insets.bottom + 36) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>Planner</Text>
              <Text style={styles.title}>{isEditMode ? "Refine Task" : "Create a Task"}</Text>
              <Text style={styles.subtitle}>
                {isEditMode
                  ? "Shape it until it feels clear, simple, and easy to return to."
                  : "Turn a thought into a plan you can trust yourself to come back to."}
              </Text>
            </View>

            <TouchableOpacity style={styles.closeButton} activeOpacity={0.85} onPress={onCancel}>
              <Ionicons name="close" size={22} color="#F8FAFC" />
            </TouchableOpacity>
          </View>

          <View style={styles.tipCard}>
            <Ionicons name="sparkles-outline" size={18} color="#7DD3FC" />
            <Text style={styles.tipText}>
              Keep it light. One clear task is often enough to change the whole day.
            </Text>
          </View>

          <LinearGradient colors={["rgba(37,99,235,0.92)", "rgba(76,29,149,0.86)"]} style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <View>
                <Text style={styles.previewEyebrow}>Live preview</Text>
                <Text style={styles.previewTitle} numberOfLines={1}>
                  {title.trim() || "Your next task"}
                </Text>
              </View>
              <View style={styles.previewIcon}>
                <Ionicons name={isEditMode ? "create-outline" : "flash-outline"} size={18} color="#F8FAFC" />
              </View>
            </View>

            <Text style={styles.previewBody} numberOfLines={2}>
              {description.trim() || "Leave a note your future self will be grateful to read."}
            </Text>

            <View style={styles.previewMetaRow}>
              <View style={styles.previewMetaPill}>
                <View
                  style={[
                    styles.previewMetaDot,
                    { backgroundColor: selectedCategoryDetails?.color || "#7DD3FC" },
                  ]}
                />
                <Text style={styles.previewMetaText}>{selectedCategoryDetails?.name || "General"}</Text>
              </View>
              <View style={styles.previewMetaPill}>
                <Ionicons name="flag-outline" size={13} color="#FDE68A" />
                <Text style={styles.previewMetaText}>{priority}</Text>
              </View>
            </View>

            <View style={styles.previewFooter}>
              <View style={styles.previewFooterItem}>
                <Text style={styles.previewFooterLabel}>Reminder</Text>
                <Text style={styles.previewFooterValue}>{reminderPreview}</Text>
              </View>
              <View style={styles.previewFooterItem}>
                <Text style={styles.previewFooterLabel}>Deadline</Text>
                <Text style={styles.previewFooterValue}>{deadlinePreview}</Text>
              </View>
            </View>
          </LinearGradient>

          <View style={styles.card}>
            <FieldLabel label="Task title" />
            <TextInput
              style={[styles.input, focusedField === "title" && styles.inputFocused]}
              placeholder="What needs to get done?"
              placeholderTextColor="#64748B"
              value={title}
              onChangeText={(text) => setTitle(text.slice(0, 80))}
              onFocus={() => setFocusedField("title")}
              onBlur={() => setFocusedField(null)}
            />

            <View style={styles.rowTopSpacing}>
              <View style={styles.inlineLabelRow}>
                <FieldLabel label="Deadline" />
                {hasDeadline ? (
                  <TouchableOpacity onPress={() => setHasDeadline(false)}>
                    <Text style={styles.clearText}>Clear</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.dateRow}>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => {
                    setPickerMode("date");
                    setShowPicker(true);
                  }}
                >
                  <Ionicons name="calendar-outline" size={18} color="#7DD3FC" />
                  <Text style={[styles.dateButtonText, hasDeadline && styles.dateButtonTextActive]}>
                    {hasDeadline
                      ? date.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "Set date"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => {
                    setPickerMode("time");
                    setShowPicker(true);
                  }}
                >
                  <Ionicons name="time-outline" size={18} color="#7DD3FC" />
                  <Text style={[styles.dateButtonText, hasDeadline && styles.dateButtonTextActive]}>
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
                  onChange={onChangeDateTime}
                  minimumDate={pickerMode === "date" ? new Date() : undefined}
                />
              ) : null}
            </View>

            <View style={styles.rowTopSpacing}>
              <FieldLabel label="Reminder" />
              <Text style={styles.helperText}>Current reminder: {reminderPreview}</Text>
              <ScrollView
                horizontal
                nestedScrollEnabled
                directionalLockEnabled
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {REMINDER_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.reminderChip,
                      reminderMinutes === option.value && styles.reminderChipActive,
                    ]}
                    onPress={() => setReminderMinutes(option.value)}
                  >
                    <Text
                      style={[
                        styles.reminderChipText,
                        reminderMinutes === option.value && styles.reminderChipTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.rowTopSpacing}>
              <FieldLabel label="Category" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {categories.map((category) => {
                  const isSelected = selectedCategory === category.id;
                  return (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.categoryChip,
                        isSelected && {
                          backgroundColor: `${category.color}22`,
                          borderColor: category.color,
                        },
                      ]}
                      onPress={() => setSelectedCategory(category.id)}
                    >
                      <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                      <Text
                        style={[
                          styles.categoryChipText,
                          isSelected && { color: "#F8FAFC" },
                        ]}
                      >
                        {category.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.rowTopSpacing}>
              <FieldLabel label="Priority" />
              <View style={styles.priorityRow}>
                {[
                  { label: "Low", color: "#38BDF8" },
                  { label: "Medium", color: "#FBBF24" },
                  { label: "High", color: "#FB7185" },
                ].map((item) => {
                  const isSelected = priority === item.label;
                  return (
                    <TouchableOpacity
                      key={item.label}
                      style={[
                        styles.priorityChip,
                        isSelected && {
                          backgroundColor: `${item.color}22`,
                          borderColor: item.color,
                        },
                      ]}
                      onPress={() => setPriority(item.label)}
                    >
                      <View style={[styles.priorityDot, { backgroundColor: item.color }]} />
                      <Text style={[styles.priorityChipText, isSelected && styles.priorityChipTextActive]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.rowTopSpacing}>
              <FieldLabel label="Notes" optional />
              <TextInput
                style={[styles.input, styles.notesInput, focusedField === "notes" && styles.inputFocused]}
                placeholder="Add context, next steps, or anything worth remembering"
                placeholderTextColor="#64748B"
                multiline
                textAlignVertical="top"
                value={description}
                onChangeText={(text) => setDescription(text.slice(0, 240))}
                onFocus={() => setFocusedField("notes")}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.88} onPress={onCancel}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryButton, !title.trim() && styles.primaryButtonDisabled]}
              activeOpacity={0.92}
              onPress={handleSave}
              disabled={!title.trim()}
            >
              <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>
                {isEditMode ? "Update task" : "Save task"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FieldLabel({ label, optional }) {
  return (
    <Text style={styles.fieldLabel}>
      {label}
      {optional ? " (optional)" : ""}
    </Text>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    gap: 18,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
  },
  headerText: {
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
  closeButton: {
    width: 46,
    height: 46,
    borderRadius: 18,
    backgroundColor: "rgba(15, 23, 42, 0.76)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  tipCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 22,
    backgroundColor: "rgba(14, 165, 233, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(125, 211, 252, 0.16)",
  },
  tipText: {
    flex: 1,
    color: "#D7ECFF",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
  },
  previewCard: {
    borderRadius: 28,
    padding: 20,
    gap: 16,
    shadowColor: "#1D4ED8",
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  previewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  previewEyebrow: {
    color: "rgba(224, 231, 255, 0.86)",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  previewTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
  },
  previewIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewBody: {
    color: "rgba(224, 231, 255, 0.92)",
    fontSize: 14,
    lineHeight: 21,
  },
  previewMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  previewMetaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  previewMetaDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  previewMetaText: {
    color: "#F8FAFC",
    fontSize: 12,
    fontWeight: "700",
  },
  previewFooter: {
    flexDirection: "row",
    gap: 12,
  },
  previewFooterItem: {
    flex: 1,
    backgroundColor: "rgba(7, 17, 31, 0.2)",
    borderRadius: 18,
    padding: 12,
  },
  previewFooterLabel: {
    color: "rgba(191, 219, 254, 0.92)",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  previewFooterValue: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 6,
  },
  card: {
    backgroundColor: "rgba(15, 23, 42, 0.76)",
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.14)",
  },
  fieldLabel: {
    color: "#7DD3FC",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  input: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.16)",
    color: "#F8FAFC",
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: "500",
  },
  inputFocused: {
    borderColor: "rgba(96, 165, 250, 0.6)",
    backgroundColor: "rgba(37, 99, 235, 0.08)",
  },
  notesInput: {
    minHeight: 140,
    paddingTop: 16,
  },
  rowTopSpacing: {
    marginTop: 18,
  },
  inlineLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  clearText: {
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "700",
  },
  dateRow: {
    flexDirection: "row",
    gap: 12,
  },
  dateButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.16)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
  },
  dateButtonText: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "700",
  },
  dateButtonTextActive: {
    color: "#F8FAFC",
  },
  helperText: {
    color: "#94A3B8",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  chipRow: {
    gap: 10,
    paddingRight: 18,
  },
  reminderChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.16)",
  },
  reminderChipActive: {
    backgroundColor: "rgba(37, 99, 235, 0.18)",
    borderColor: "rgba(96, 165, 250, 0.6)",
  },
  reminderChipText: {
    color: "#B8C6D5",
    fontSize: 13,
    fontWeight: "700",
  },
  reminderChipTextActive: {
    color: "#F8FAFC",
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.16)",
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  categoryChipText: {
    color: "#B8C6D5",
    fontSize: 13,
    fontWeight: "700",
  },
  priorityRow: {
    flexDirection: "row",
    gap: 10,
  },
  priorityChip: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.16)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  priorityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  priorityChipText: {
    color: "#B8C6D5",
    fontSize: 14,
    fontWeight: "700",
  },
  priorityChipTextActive: {
    color: "#F8FAFC",
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  secondaryButton: {
    flex: 0.36,
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.14)",
  },
  secondaryButtonText: {
    color: "#B8C6D5",
    fontSize: 15,
    fontWeight: "800",
  },
  primaryButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
