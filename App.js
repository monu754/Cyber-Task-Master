import { useEffect, useState } from "react";
import { ActivityIndicator, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initDatabase } from "./database";
import MainWorkspaceScreen from "./screens/MainWorkspaceScreen";

export default function App() {
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    try {
      initDatabase();
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
      <MainWorkspaceScreen />
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
