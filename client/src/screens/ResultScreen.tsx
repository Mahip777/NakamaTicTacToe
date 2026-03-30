import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import { AnimatedButton } from "../components/AnimatedButton";
import { useGameStore } from "../store/useGameStore";
import { matchOutcomeText } from "../utils/matchOutcomeText";
import { commonStyles } from "../theme/commonStyles";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "Result">;

export const ResultScreen: React.FC<Props> = ({ navigation }) => {
  const { result, winnerUserId, forfeitReason, userId, players, resetMatch } = useGameStore();

  const goHome = () => {
    resetMatch();
    navigation.replace("Home");
  };

  const headline = matchOutcomeText(result, winnerUserId, userId, players);

  return (
    <View style={[commonStyles.screen, styles.container]}>
      <Text style={commonStyles.title}>Match Finished</Text>
      <Text style={styles.headline}>{headline}</Text>
      {forfeitReason ? <Text style={styles.detail}>Reason: {forfeitReason}</Text> : null}
      <AnimatedButton title="Back to Home" onPress={goHome} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10, padding: 20 },
  headline: { fontSize: 18, fontWeight: "600", textAlign: "center", color: colors.text },
  detail: { fontSize: 14, color: colors.textMuted, textAlign: "center" }
});
