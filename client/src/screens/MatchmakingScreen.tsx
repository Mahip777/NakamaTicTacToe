import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import { useGameStore } from "../store/useGameStore";
import { commonStyles } from "../theme/commonStyles";

type Props = NativeStackScreenProps<RootStackParamList, "Matchmaking">;

export const MatchmakingScreen: React.FC<Props> = ({ navigation }) => {
  const matchId = useGameStore((s) => s.matchId);

  useEffect(() => {
    if (matchId) {
      navigation.replace("Game");
    }
  }, [matchId, navigation]);

  return (
    <View style={[commonStyles.screen, styles.container]}>
      <Text style={commonStyles.title}>Finding opponent...</Text>
      <Text style={commonStyles.muted}>Waiting in queue for 2-player match.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10, padding: 20 }
});
