import DateTimePicker from "@react-native-community/datetimepicker";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
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
import { AppIcon, SectionBadge } from "../components/AppIcon";
import {
  createHabit,
  ensureCategory,
  getCategories,
  updateHabit,
} from "../database";
import {
  cancelTaskNotifications,
  normalizeReminderMinutes,
  REMINDER_OPTIONS,
  scheduleSingleNotification,
} from "../utils/taskNotifications";

const RECURRENCE_OPTIONS = ["daily", "weekly"];

function Chip({ label, onPress, selected }) {
  return (
    <TouchableOpacity style={[styles.chip, selected && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ChipRow({ children }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {children}
    </ScrollView>
  );
}

function Section({ children, help, iconName, theme, title }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        {iconName ? <AppIcon name={iconName} size={13} theme={theme} tone="accent" style={styles.sectionIcon} /> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {help ? <Text style={styles.helper}>{help}</Text> : null}
      {children}
    </View>
  );
}

export default function AddHabitScreen({
  bottomInset,
  isActive,
  onCancel,
  onSaved,
  habitToEdit,
  theme,
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 390;
  const keyboardVerticalOffset = Platform.OS === "ios" ? Math.max(insets.top, 12) : 28;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState(1);
  const [newCategory, setNewCategory] = useState("");
  const [recurrence, setRecurrence] = useState("daily");
  const [reminderMinutes, setReminderMinutes] = useState(60);
  const [time, setTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    setCategories(getCategories());
  }, [isActive]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    if (habitToEdit) {
      setTitle(habitToEdit.title || "");
      setDescription(habitToEdit.description || "");
      setCategoryId(habitToEdit.category_id || 1);
      setRecurrence(habitToEdit.recurrence || "daily");
      setReminderMinutes(normalizeReminderMinutes(habitToEdit.reminder_minutes));
      setTime(habitToEdit.due_date ? new Date(habitToEdit.due_date) : new Date());
      setNewCategory("");
      return;
    }

    setTitle("");
    setDescription("");
    setCategoryId(1);
    setNewCategory("");
    setRecurrence("daily");
    setReminderMinutes(60);
    setTime(new Date());
  }, [habitToEdit, isActive]);
  const themeAccent = theme?.accent || "#2563EB";
  const themeText = theme?.text || "#F8FAFC";
  const themeMuted = theme?.muted || "#94A3B8";
  const themePanel = theme?.panel || "rgba(15, 23, 42, 0.76)";
  const inputBackground = "rgba(255,255,255,0.05)";
  const inputBorder = "rgba(148,163,184,0.18)";

  const handleSave = async () => {
    if (isSaving) {
      return;
    }

    if (title.trim().length < 3) {
      Alert.alert("Habit name required", "Please enter at least 3 characters.");
      return;
    }

    setIsSaving(true);

    try {
      const category = newCategory.trim()
        ? ensureCategory({ name: newCategory.trim() })
        : categories.find((item) => item.id === categoryId);

      const nextDueDate = new Date();
      nextDueDate.setHours(time.getHours(), time.getMinutes(), 0, 0);
      if (nextDueDate <= new Date()) {
        nextDueDate.setDate(nextDueDate.getDate() + 1);
      }

      const payload = {
        title: title.trim(),
        description: description.trim(),
        categoryId: category?.id || 1,
        workspaceId: 1,
        projectId: 1,
        dueDate: nextDueDate.toISOString(),
        reminderMinutes,
        recurrence,
        tags: [],
        status: habitToEdit?.status || "Todo",
        habitGroupId: habitToEdit?.habit_group_id || habitToEdit?.id || null,
      };

      const savedHabit = habitToEdit
        ? updateHabit({ id: habitToEdit.id, ...payload })
        : createHabit(payload);

      if (habitToEdit) {
        await cancelTaskNotifications(habitToEdit.id);
      }
      if (savedHabit?.due_date && savedHabit.status !== "Done") {
        await scheduleSingleNotification({ ...savedHabit, completed: 0 });
      }
      onSaved?.();
    } catch (error) {
      console.error("Failed to save habit:", error);
      Alert.alert("Unable to save habit", "Something went wrong while saving. Please try again.");
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
              <SectionBadge iconName="infinite-outline" label="Habit editor" theme={theme} />
              <Text style={[styles.eyebrow, { color: themeAccent }]}>Habit tracker</Text>
              <Text style={[styles.title, isCompact && styles.titleCompact, { color: themeText }]}>
                {habitToEdit ? "Edit habit" : "New habit"}
              </Text>
              <Text style={[styles.subtitle, isCompact && styles.subtitleCompact, { color: themeMuted }]}>
                Build recurring routines here. These entries stay separate from one-time tasks.
              </Text>
            </View>

            <View style={[styles.card, { backgroundColor: themePanel }]}>
            <Section title="Habit name *" iconName="leaf-outline" theme={theme} help="Use a repeatable action like 'Read 20 minutes' or 'Morning walk'.">
              <TextInput
                style={[styles.input, { backgroundColor: inputBackground, borderColor: inputBorder, color: themeText }]}
                placeholder="What habit do you want to repeat?"
                placeholderTextColor={themeMuted}
                value={title}
                onChangeText={setTitle}
              />
            </Section>

            <Section title="Frequency" iconName="refresh-outline" theme={theme} help="Choose how often the routine should come back.">
              <ChipRow>
                {RECURRENCE_OPTIONS.map((item) => (
                  <Chip key={item} label={item} selected={recurrence === item} onPress={() => setRecurrence(item)} />
                ))}
              </ChipRow>
            </Section>

            <Section title="Preferred time" iconName="time-outline" theme={theme} help="Set the time you usually want to do this habit.">
              <TouchableOpacity
                style={[styles.dateButton, { backgroundColor: inputBackground, borderColor: inputBorder }]}
                onPress={() => setShowTimePicker(true)}
              >
                <Text style={[styles.dateText, { color: themeText }]}>
                  {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </TouchableOpacity>
              {showTimePicker ? (
                <DateTimePicker
                  value={time}
                  mode="time"
                  display="default"
                  onChange={(_, selectedDate) => {
                    setShowTimePicker(false);
                    if (selectedDate) {
                      setTime(selectedDate);
                    }
                  }}
                />
              ) : null}
            </Section>

            <Section title="Reminder" iconName="notifications-outline" theme={theme} help="Pick when the habit should nudge you.">
              <ChipRow>
                {REMINDER_OPTIONS.slice(0, 6).map((item) => (
                  <Chip
                    key={item.value}
                    label={item.label}
                    selected={reminderMinutes === item.value}
                    onPress={() => setReminderMinutes(item.value)}
                  />
                ))}
              </ChipRow>
            </Section>

            <Section title="Category" iconName="pricetag-outline" theme={theme} help="Group routines like Health, Learning, or Home.">
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

            <Section title="Notes" iconName="reader-outline" theme={theme} help="Describe why this matters or what counts as done.">
              <TextInput
                style={[styles.input, styles.multiInput, { backgroundColor: inputBackground, borderColor: inputBorder, color: themeText }]}
                multiline
                textAlignVertical="top"
                placeholder="Add context or a simple completion rule."
                placeholderTextColor={themeMuted}
                value={description}
                onChangeText={setDescription}
              />
            </Section>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={onCancel}>
              <AppIcon name="arrow-back" size={14} theme={theme} tone="neutral" style={styles.actionIcon} />
              <Text style={styles.secondaryText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: themeAccent }]}
              onPress={handleSave}
              disabled={isSaving}
            >
              <AppIcon
                active
                name={habitToEdit ? "sparkles" : "add"}
                size={14}
                theme={theme}
                tone="neutral"
                style={styles.actionIcon}
              />
              <Text style={styles.primaryText}>
                {isSaving ? "Saving..." : habitToEdit ? "Update habit" : "Save habit"}
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
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionIcon: { transform: [{ scale: 0.78 }] },
  sectionTitle: { color: "#7DD3FC", fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 },
  helper: { color: "#94A3B8", fontSize: 13, lineHeight: 19 },
  input: { minHeight: 54, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(148,163,184,0.16)", color: "#F8FAFC", paddingHorizontal: 16, fontSize: 15 },
  multiInput: { minHeight: 110, paddingTop: 14 },
  chipRow: { gap: 10, paddingRight: 18, alignItems: "center" },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(148,163,184,0.16)" },
  chipActive: { backgroundColor: "rgba(37,99,235,0.18)", borderColor: "rgba(96,165,250,0.6)" },
  chipText: { color: "#B8C6D5", fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: "#F8FAFC" },
  dateButton: { minHeight: 52, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(148,163,184,0.16)", alignItems: "center", justifyContent: "center" },
  dateText: { color: "#F8FAFC", fontWeight: "700" },
  topGap: { marginTop: 4 },
  actionRow: { flexDirection: "row", gap: 12 },
  actionIcon: { transform: [{ scale: 0.76 }] },
  secondaryButton: { flex: 0.38, minHeight: 52, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.04)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(148,163,184,0.14)", flexDirection: "row", gap: 8 },
  primaryButton: { flex: 1, minHeight: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  secondaryText: { color: "#B8C6D5", fontSize: 15, fontWeight: "800" },
  primaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
});
