import { useEffect, useState } from "react";
import { ActivityIndicator, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { getPreference, initDatabase, setPreference } from "./database";
import MainWorkspaceScreen from "./screens/MainWorkspaceScreen";

export default function App() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [themeKey, setThemeKey] = useState("midnight");

  useEffect(() => {
    try {
      initDatabase();
      setThemeKey(getPreference("theme", "midnight"));
      setIsDbReady(true);
    } catch (error) {
      console.error("Failed to initialize database:", error);
    }
  }, []);

  if (!isDbReady) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#07111F" />
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <MainWorkspaceScreen
        themeKey={themeKey}
        onChangeTheme={(nextThemeKey) => {
          setPreference("theme", nextThemeKey);
          setThemeKey(nextThemeKey);
        }}
      />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#07111F",
    justifyContent: "center",
    alignItems: "center",
  },
});
