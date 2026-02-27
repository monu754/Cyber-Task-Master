import { useState, useRef, useEffect } from "react";
import { 
  Alert, 
  StyleSheet, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  View,
  Animated,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Keyboard,
  Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get('window');

export default function AddTaskScreen({ navigation, route }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isFocused, setIsFocused] = useState(null);
  
  // Animation refs
  const slideAnim = useRef(new Animated.Value(width)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true })
    ]).start();
  }, []);

  const handleSave = () => {
    const trimmedTitle = title.trim();
    
    if (!trimmedTitle) {
      Alert.alert(
        "Missing Information",
        "Please enter an objective title to continue.",
        [{ text: "OK", onPress: () => {} }]
      );
      return;
    }

    if (trimmedTitle.length < 3) {
      Alert.alert(
        "Too Short",
        "Objective title must be at least 3 characters long.",
        [{ text: "OK", onPress: () => {} }]
      );
      return;
    }

    Keyboard.dismiss();
    route.params.addTask({ 
      id: Date.now().toString(), 
      title: trimmedTitle, 
      description: description.trim(), 
      completed: false 
    });
    navigation.goBack();
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />
      
      {/* BACKGROUND ORBS */}
      <Animated.View style={[styles.orbAccent]} />
      
      <Animated.View style={[styles.content, { 
        opacity: fadeAnim,
        transform: [{ translateX: slideAnim }]
      }]}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handleCancel}
            activeOpacity={0.6}
          >
            <Ionicons name="chevron-back" size={28} color="#F8FAFC" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.heading}>Create New Objective</Text>
            <Text style={styles.subtitle}>Add a task to your list</Text>
          </View>
        </View>

        {/* FORM SECTION */}
        <View style={styles.formContainer}>
          {/* TITLE INPUT */}
          <View style={styles.fieldWrapper}>
            <View style={styles.labelRow}>
              <Text style={styles.tag}>Objective Title</Text>
              <Text style={styles.counter}>{title.length}/50</Text>
            </View>
            <TextInput
              style={[styles.field, isFocused === 'title' && styles.fieldFocused]}
              placeholder="What do you want to accomplish?"
              placeholderTextColor="#475569"
              value={title}
              onChangeText={(text) => setTitle(text.slice(0, 50))}
              onFocus={() => setIsFocused('title')}
              onBlur={() => setIsFocused(null)}
              maxLength={50}
              editable
            />
          </View>

          {/* DESCRIPTION INPUT */}
          <View style={styles.fieldWrapper}>
            <View style={styles.labelRow}>
              <Text style={styles.tag}>Details (Optional)</Text>
              <Text style={styles.counter}>{description.length}/200</Text>
            </View>
            <TextInput
              style={[styles.field, styles.bigField, isFocused === 'desc' && styles.fieldFocused]}
              placeholder="Add any additional details or notes..."
              placeholderTextColor="#475569"
              value={description}
              onChangeText={(text) => setDescription(text.slice(0, 200))}
              onFocus={() => setIsFocused('desc')}
              onBlur={() => setIsFocused(null)}
              multiline
              maxLength={200}
              editable
            />
          </View>
        </View>

        {/* BUTTONS */}
        <View style={styles.buttonGroup}>
          <TouchableOpacity 
            style={styles.cancelBtn}
            onPress={handleCancel}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.btn, !title.trim() && styles.btnDisabled]}
            onPress={handleSave}
            activeOpacity={0.8}
            disabled={!title.trim()}
          >
            <Ionicons name="checkmark-done" size={20} color="#FFF" />
            <Text style={styles.btnText}>Create Objective</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#020617"
  },
  orbAccent: {
    position: 'absolute',
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    top: -100,
    right: -50
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    // 👇 ADD THIS LINE HERE AS WELL
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 20 : 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 32,
    gap: 16
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)'
  },
  headerContent: {
    flex: 1
  },
  heading: { 
    fontSize: 32, 
    fontWeight: "900", 
    color: "#F8FAFC",
    lineHeight: 38
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '500'
  },
  formContainer: {
    flex: 1,
    justifyContent: 'flex-start'
  },
  fieldWrapper: {
    marginBottom: 28
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  tag: { 
    fontSize: 13, 
    fontWeight: "700", 
    color: "#6366F1",
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  counter: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8'
  },
  field: { 
    backgroundColor: "rgba(255,255,255,0.05)", 
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 16, 
    color: "#F8FAFC", 
    fontSize: 16,
    fontWeight: '500',
    borderWidth: 1, 
    borderColor: "rgba(99, 102, 241, 0.2)",
    minHeight: 56
  },
  fieldFocused: {
    backgroundColor: "rgba(99, 102, 241, 0.1)",
    borderColor: "rgba(99, 102, 241, 0.5)"
  },
  bigField: { 
    height: 140, 
    textAlignVertical: "top",
    paddingTop: 16
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 24,
    paddingTop: 24
  },
  cancelBtn: {
    flex: 0.35,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  cancelBtnText: {
    color: "#94A3B8",
    fontSize: 15,
    fontWeight: "700"
  },
  btn: { 
    flex: 1,
    backgroundColor: "#6366F1", 
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14, 
    alignItems: "center",
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    elevation: 20,
    shadowColor: "#6366F1", 
    shadowOpacity: 0.6, 
    shadowRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  btnDisabled: {
    opacity: 0.5,
    backgroundColor: '#64748B'
  },
  btnText: { 
    color: "#FFF", 
    fontSize: 15, 
    fontWeight: "700"
  },
});
