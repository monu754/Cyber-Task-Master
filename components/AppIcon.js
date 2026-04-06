import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

const resolveTone = (theme, tone = "neutral", active = false) => {
  const accent = theme?.accent || "#2563EB";
  const accentSoft = theme?.accentSoft || "#7DD3FC";
  const text = theme?.text || "#F8FAFC";
  const muted = theme?.muted || "#94A3B8";
  const danger = theme?.danger || "#FCA5A5";

  const tones = {
    accent: {
      icon: text,
      border: "rgba(125, 211, 252, 0.26)",
      glow: `${accent}33`,
      gradient: active ? [accentSoft, accent] : ["rgba(125, 211, 252, 0.28)", "rgba(37, 99, 235, 0.18)"],
    },
    success: {
      icon: "#D1FAE5",
      border: "rgba(110, 231, 183, 0.28)",
      glow: "rgba(16, 185, 129, 0.22)",
      gradient: ["rgba(52, 211, 153, 0.28)", "rgba(5, 150, 105, 0.16)"],
    },
    danger: {
      icon: danger,
      border: "rgba(252, 165, 165, 0.26)",
      glow: "rgba(239, 68, 68, 0.18)",
      gradient: ["rgba(248, 113, 113, 0.22)", "rgba(127, 29, 29, 0.12)"],
    },
    muted: {
      icon: text,
      border: "rgba(148, 163, 184, 0.2)",
      glow: "rgba(148, 163, 184, 0.12)",
      gradient: ["rgba(148, 163, 184, 0.2)", "rgba(30, 41, 59, 0.2)"],
    },
    neutral: {
      icon: active ? text : muted,
      border: active ? "rgba(125, 211, 252, 0.24)" : "rgba(148, 163, 184, 0.18)",
      glow: active ? `${accent}29` : "rgba(15, 23, 42, 0.18)",
      gradient: active
        ? [accent, "#1D4ED8"]
        : ["rgba(255, 255, 255, 0.09)", "rgba(30, 41, 59, 0.28)"],
    },
  };

  return tones[tone] || tones.neutral;
};

export function AppIcon({
  active = false,
  name,
  size = 18,
  style,
  theme,
  tone = "neutral",
}) {
  const palette = resolveTone(theme, tone, active);

  return (
    <View style={[styles.iconShell, { shadowColor: palette.glow }, style]}>
      <LinearGradient colors={palette.gradient} style={[styles.iconWrap, { borderColor: palette.border }]}>
        <Ionicons name={name} size={size} color={palette.icon} />
      </LinearGradient>
    </View>
  );
}

export function AppIconButton({
  accessibilityLabel,
  active = false,
  disabled = false,
  iconName,
  iconSize = 18,
  onPress,
  style,
  theme,
  tone = "neutral",
}) {
  return (
    <TouchableOpacity
      accessibilityLabel={accessibilityLabel}
      activeOpacity={disabled ? 1 : 0.88}
      disabled={disabled}
      onPress={onPress}
      style={[styles.buttonBase, disabled && styles.buttonDisabled, style]}
    >
      <AppIcon active={active} name={iconName} size={iconSize} theme={theme} tone={tone} />
    </TouchableOpacity>
  );
}

export function SectionBadge({ iconName, label, theme, tone = "accent" }) {
  const palette = resolveTone(theme, tone);

  return (
    <View style={[styles.badge, { borderColor: palette.border, backgroundColor: palette.gradient[0] }]}>
      <Ionicons name={iconName} size={14} color={palette.icon} />
      <Text style={[styles.badgeLabel, { color: palette.icon }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonBase: {
    borderRadius: 18,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  iconShell: {
    borderRadius: 18,
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
});
