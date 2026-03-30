import React, { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { colors } from "../theme/colors";

interface CountdownProps {
  turnDeadlineMs?: number;
}

export const Countdown: React.FC<CountdownProps> = ({ turnDeadlineMs }) => {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!turnDeadlineMs) {
      setRemaining(0);
      return;
    }
    const tick = () => {
      const ms = Math.max(0, turnDeadlineMs - Date.now());
      setRemaining(Math.ceil(ms / 1000));
    };
    tick();
    const timer = setInterval(tick, 200);
    return () => clearInterval(timer);
  }, [turnDeadlineMs]);

  return <Text style={styles.text}>Time Left: {remaining}s</Text>;
};

const styles = StyleSheet.create({
  text: { color: colors.accent, fontSize: 16, fontWeight: "600", fontVariant: ["tabular-nums"] }
});
