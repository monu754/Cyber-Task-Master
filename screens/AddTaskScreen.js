import { useState, useRef, useEffect } from "react";
import { 
  Alert, StyleSheet, Text, TextInput, TouchableOpacity, View,
  Animated, Dimensions, StatusBar, Keyboard, Platform, ScrollView
} from "react-native";
// 👇 FIXED: Modern SafeAreaView
import { SafeAreaView } from "react-native-safe-area-context"; 
import { Ionicons } from "@expo/vector-icons";
import * as SQLite from 'expo-sqlite';
import DateTimePicker from '@react-native-community/datetimepicker'; 

const { width } = Dimensions.get('window');
const db = SQLite.openDatabaseSync('cyber_task_master.db');

export default function AddTaskScreen({ navigation }) { // 👇 FIXED: Removed 'route'
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(1);
  const [isFocused, setIsFocused] = useState(null);
  
  const [date, setDate] = useState(new Date());
  const [hasDeadline, setHasDeadline] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState('date');
  
  const slideAnim = useRef(new Animated.Value(width)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    try {
      const cats = db.getAllSync('SELECT * FROM categories');
      setCategories(cats);
      if (cats.length > 0) setSelectedCategory(cats[0].id);
    } catch (error) {}

    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true })
    ]).start();
  }, []);

  const onChangeDateTime = (event, selectedDate) => {
    setShowPicker(false); 
    if (selectedDate) {
      setDate(selectedDate);
      setHasDeadline(true);
      if (pickerMode === 'date' && Platform.OS === 'android') {
        setTimeout(() => {
          setPickerMode('time');
          setShowPicker(true);
        }, 100);
      }
    }
  };

  const handleSave = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return Alert.alert("Error", "Please enter a title.");
    if (trimmedTitle.length < 3) return Alert.alert("Error", "Title must be at least 3 characters.");

    Keyboard.dismiss();
    
    // 👇 FIXED: Direct SQLite insertion
    db.runSync(
      'INSERT INTO tasks (title, description, priority, category_id, due_date, completed) VALUES (?, ?, ?, ?, ?, ?)',
      [trimmedTitle, description.trim(), priority, selectedCategory, hasDeadline ? date.toISOString() : null, 0]
    );

    navigation.goBack();
  };

  const priorities = [
    { label: 'Low', color: '#0EA5E9' },
    { label: 'Medium', color: '#F59E0B' },
    { label: 'High', color: '#F43F5E' }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />
      <Animated.View style={[styles.orbAccent]} />
      
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.6}>
            <Ionicons name="chevron-back" size={28} color="#F8FAFC" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.heading}>Create Objective</Text>
            <Text style={styles.subtitle}>Add a task to your list</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          
          <View style={styles.fieldWrapper}>
            <Text style={styles.tag}>Objective Title</Text>
            <TextInput style={[styles.field, isFocused === 'title' && styles.fieldFocused]} placeholder="What do you want to accomplish?" placeholderTextColor="#475569" value={title} onChangeText={(text) => setTitle(text.slice(0, 50))} onFocus={() => setIsFocused('title')} onBlur={() => setIsFocused(null)} />
          </View>

          <View style={styles.fieldWrapper}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.tag}>Deadline (Optional)</Text>
              {hasDeadline && (
                <TouchableOpacity onPress={() => setHasDeadline(false)}>
                  <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: 'bold' }}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.dateTimeRow}>
              <TouchableOpacity style={styles.dateTimeBtn} onPress={() => { setPickerMode('date'); setShowPicker(true); }}>
                <Ionicons name="calendar-outline" size={20} color={hasDeadline ? "#6366F1" : "#64748B"} />
                <Text style={[styles.dateTimeText, hasDeadline && { color: "#F8FAFC" }]}>
                  {hasDeadline ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Set Date'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dateTimeBtn} onPress={() => { setPickerMode('time'); setShowPicker(true); }}>
                <Ionicons name="time-outline" size={20} color={hasDeadline ? "#6366F1" : "#64748B"} />
                <Text style={[styles.dateTimeText, hasDeadline && { color: "#F8FAFC" }]}>
                  {hasDeadline ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Set Time'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {showPicker && (
            <DateTimePicker value={date} mode={pickerMode} display="default" onChange={onChangeDateTime} />
          )}

          <View style={styles.fieldWrapper}>
            <Text style={styles.tag}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollRow}>
              {categories.map((cat) => (
                <TouchableOpacity key={cat.id} onPress={() => setSelectedCategory(cat.id)} style={[styles.categoryBtn, selectedCategory === cat.id && { backgroundColor: cat.color + '20', borderColor: cat.color }]}>
                  <Ionicons name="folder-outline" size={14} color={selectedCategory === cat.id ? cat.color : '#64748B'} />
                  <Text style={[styles.categoryBtnText, selectedCategory === cat.id && { color: cat.color }]}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.fieldWrapper}>
            <Text style={styles.tag}>Priority Level</Text>
            <View style={styles.priorityRow}>
              {priorities.map((p) => (
                <TouchableOpacity key={p.label} onPress={() => setPriority(p.label)} style={[styles.priorityBtn, priority === p.label && { backgroundColor: p.color + '20', borderColor: p.color }]}>
                  <View style={[styles.priorityDot, { backgroundColor: p.color }]} />
                  <Text style={[styles.priorityBtnText, priority === p.label && { color: p.color }]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.fieldWrapper}>
            <Text style={styles.tag}>Details (Optional)</Text>
            <TextInput style={[styles.field, styles.bigField, isFocused === 'desc' && styles.fieldFocused]} placeholder="Add any additional details..." placeholderTextColor="#475569" value={description} onChangeText={(text) => setDescription(text.slice(0, 200))} onFocus={() => setIsFocused('desc')} onBlur={() => setIsFocused(null)} multiline />
          </View>

        </ScrollView>

        <View style={styles.buttonGroup}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, !title.trim() && styles.btnDisabled]} onPress={handleSave} disabled={!title.trim()}>
            <Ionicons name="checkmark-done" size={20} color="#FFF" />
            <Text style={styles.btnText}>Create Objective</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020617" },
  orbAccent: { position: 'absolute', width: 350, height: 350, borderRadius: 175, backgroundColor: 'rgba(99, 102, 241, 0.08)', top: -100, right: -50 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 20 : 20 },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20, gap: 16 },
  backButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.2)' },
  headerContent: { flex: 1 },
  heading: { fontSize: 32, fontWeight: "900", color: "#F8FAFC", lineHeight: 38 },
  subtitle: { fontSize: 14, color: '#94A3B8', marginTop: 4, fontWeight: '500' },
  fieldWrapper: { marginBottom: 20 },
  tag: { fontSize: 13, fontWeight: "700", color: "#6366F1", letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 },
  field: { backgroundColor: "rgba(255,255,255,0.05)", paddingHorizontal: 18, paddingVertical: 14, borderRadius: 16, color: "#F8FAFC", fontSize: 16, fontWeight: '500', borderWidth: 1, borderColor: "rgba(99, 102, 241, 0.2)", minHeight: 56 },
  fieldFocused: { backgroundColor: "rgba(99, 102, 241, 0.1)", borderColor: "rgba(99, 102, 241, 0.5)" },
  bigField: { height: 100, textAlignVertical: "top", paddingTop: 16 },
  dateTimeRow: { flexDirection: 'row', gap: 12 },
  dateTimeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', gap: 8 },
  dateTimeText: { color: '#64748B', fontSize: 14, fontWeight: '600' },
  scrollRow: { gap: 10, paddingRight: 20 },
  categoryBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', gap: 8 },
  categoryBtnText: { color: '#94A3B8', fontSize: 14, fontWeight: '700' },
  priorityRow: { flexDirection: 'row', gap: 10 },
  priorityBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', gap: 8 },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  priorityBtnText: { color: '#94A3B8', fontSize: 14, fontWeight: '700' },
  buttonGroup: { flexDirection: 'row', gap: 12, paddingBottom: 24, paddingTop: 10 },
  cancelBtn: { flex: 0.35, paddingVertical: 16, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.2)', justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { color: "#94A3B8", fontSize: 15, fontWeight: "700" },
  btn: { flex: 1, backgroundColor: "#6366F1", paddingVertical: 16, borderRadius: 14, alignItems: "center", justifyContent: 'center', flexDirection: 'row', gap: 8, elevation: 10, shadowColor: "#6366F1", shadowOpacity: 0.5, shadowRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  btnDisabled: { opacity: 0.5, backgroundColor: '#64748B' },
  btnText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
});