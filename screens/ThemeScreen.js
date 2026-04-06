import { LinearGradient } from "expo-linear-gradient";
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppIcon, SectionBadge } from "../components/AppIcon";
import { THEME_OPTIONS } from "../utils/preferences";

function ThemePreviewCard({ isCompact, isSelected, item, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={[styles.previewCard, isCompact && styles.previewCardCompact, isSelected && styles.previewCardSelected]}
    >
      <LinearGradient colors={item.gradient} style={[styles.previewGradient, isCompact && styles.previewGradientCompact]}>
        <View style={styles.previewHeader}>
          <View>
            <Text style={[styles.previewEyebrow, { color: item.accentSoft }]}>Theme preview</Text>
            <Text style={[styles.previewTitle, { color: item.text }]}>{item.name}</Text>
          </View>
          <View style={styles.previewCountCard}>
            <Text style={styles.previewCountValue}>3</Text>
            <Text style={styles.previewCountLabel}>today</Text>
          </View>
        </View>

          <View style={[styles.previewHero, isCompact && styles.previewHeroCompact, { backgroundColor: item.panel }]}>
          <Text style={[styles.previewHeroTitle, { color: item.text }]}>Keep today moving</Text>
          <Text style={[styles.previewHeroText, { color: item.muted }]}>
            Preview the dashboard colors, contrast, and card styling before applying.
          </Text>
        </View>

        <View style={styles.previewMetricRow}>
          <View style={[styles.previewMetric, { backgroundColor: item.panel }]}>
            <Text style={[styles.previewMetricValue, { color: item.text }]}>12</Text>
            <Text style={[styles.previewMetricLabel, { color: item.muted }]}>tasks</Text>
          </View>
          <View style={[styles.previewMetric, { backgroundColor: item.panel }]}>
            <Text style={[styles.previewMetricValue, { color: item.text }]}>4</Text>
            <Text style={[styles.previewMetricLabel, { color: item.muted }]}>due</Text>
          </View>
          <View style={[styles.previewMetric, { backgroundColor: item.panel }]}>
            <Text style={[styles.previewMetricValue, { color: item.text }]}>2h</Text>
            <Text style={[styles.previewMetricLabel, { color: item.muted }]}>tracked</Text>
          </View>
        </View>

        <View style={styles.previewActionRow}>
          <View style={[styles.previewPrimaryAction, { backgroundColor: item.accent }]}>
            <AppIcon
              name={isSelected ? "sparkles" : "color-palette-outline"}
              size={14}
              theme={item}
              tone="neutral"
              style={styles.previewActionIcon}
            />
            <Text style={styles.previewPrimaryActionText}>
              {isSelected ? "Selected" : "Apply theme"}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

export default function ThemeScreen({ bottomInset, onChangeTheme, theme, themeKey }) {
  const { width } = useWindowDimensions();
  const isCompact = width < 390;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={theme?.gradient?.[0] || "#07111F"} />
      <LinearGradient colors={theme?.gradient || ["#07111F", "#0B172A"]} style={styles.background}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.content, isCompact && styles.contentCompact, { paddingBottom: bottomInset }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <SectionBadge iconName="diamond-outline" label="Visual polish" theme={theme} />
            <Text style={styles.eyebrow}>Personalize</Text>
            <Text style={[styles.title, isCompact && styles.titleCompact]}>Theme Gallery</Text>
            <Text style={[styles.subtitle, isCompact && styles.subtitleCompact]}>
              Preview each theme here, then apply the one you want from this tab.
            </Text>
          </View>

          {Object.values(THEME_OPTIONS).map((item) => (
            <ThemePreviewCard
              key={item.key}
              isCompact={isCompact}
              item={item}
              isSelected={themeKey === item.key}
              onPress={() => onChangeTheme?.(item.key)}
            />
          ))}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#07111F",
  },
  background: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 18,
  },
  contentCompact: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },
  header: {
    gap: 8,
    marginBottom: 4,
  },
  eyebrow: {
    color: "#7DD3FC",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 6,
  },
  title: {
    color: "#F8FAFC",
    fontSize: 32,
    fontWeight: "900",
  },
  titleCompact: { fontSize: 28 },
  subtitle: {
    color: "#94A3B8",
    fontSize: 15,
    lineHeight: 22,
  },
  subtitleCompact: { fontSize: 14, lineHeight: 20 },
  previewCard: {
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.16)",
  },
  previewCardCompact: { borderRadius: 22 },
  previewCardSelected: {
    borderColor: "rgba(125, 211, 252, 0.7)",
  },
  previewGradient: {
    padding: 18,
    gap: 14,
  },
  previewGradientCompact: { padding: 14, gap: 12 },
  previewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  previewEyebrow: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  previewTitle: {
    fontSize: 24,
    fontWeight: "900",
    marginTop: 6,
  },
  previewCountCard: {
    minWidth: 72,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.42)",
  },
  previewCountValue: {
    color: "#F8FAFC",
    fontSize: 24,
    fontWeight: "900",
  },
  previewCountLabel: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: "700",
  },
  previewHero: {
    borderRadius: 24,
    padding: 18,
    gap: 8,
  },
  previewHeroCompact: { borderRadius: 18, padding: 14, gap: 6 },
  previewHeroTitle: {
    fontSize: 18,
    fontWeight: "900",
  },
  previewHeroText: {
    fontSize: 14,
    lineHeight: 20,
  },
  previewMetricRow: {
    flexDirection: "row",
    gap: 10,
  },
  previewMetric: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  previewMetricValue: {
    fontSize: 20,
    fontWeight: "900",
  },
  previewMetricLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
  },
  previewActionRow: {
    marginTop: 2,
  },
  previewPrimaryAction: {
    minHeight: 50,
    borderRadius: 16,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  previewActionIcon: { transform: [{ scale: 0.78 }] },
  previewPrimaryActionText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
});
