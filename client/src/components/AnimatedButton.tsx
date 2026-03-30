import React, { useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, ViewStyle, StyleProp } from "react-native";
import { colors } from "../theme/colors";

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  style?: StyleProp<ViewStyle>;
};

export const AnimatedButton: React.FC<Props> = ({
  title,
  onPress,
  disabled,
  variant = "primary",
  style
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      friction: 6,
      tension: 140
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        if (!disabled) animateTo(0.94);
      }}
      onPressOut={() => animateTo(1)}
      disabled={disabled}
      style={[styles.touch, style]}
    >
      <Animated.View
        style={[
          styles.btn,
          variant === "primary" ? styles.btnPrimary : styles.btnSecondary,
          { transform: [{ scale }] },
          disabled && styles.disabled
        ]}
      >
        <Text style={[styles.btnText, variant === "secondary" && styles.btnTextSecondary]}>{title}</Text>
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  touch: { alignSelf: "stretch" },
  btn: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1
  },
  btnPrimary: {
    backgroundColor: colors.buttonPrimaryBg,
    borderColor: colors.buttonPrimaryBorder
  },
  btnSecondary: {
    backgroundColor: "transparent",
    borderColor: colors.outlineMuted
  },
  btnText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.3
  },
  btnTextSecondary: {
    color: colors.accent,
    fontWeight: "500"
  },
  disabled: { opacity: 0.45 }
});
