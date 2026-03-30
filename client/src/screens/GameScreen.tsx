import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import { AnimatedButton } from "../components/AnimatedButton";
import { useGameStore } from "../store/useGameStore";
import { Board } from "../components/Board";
import { Countdown } from "../components/Countdown";
import { nakamaService } from "../services/nakama";
import { matchOutcomeText } from "../utils/matchOutcomeText";
import { commonStyles } from "../theme/commonStyles";
import { colors } from "../theme/colors";
import { useAppAlert } from "../context/AppAlertContext";

type Props = NativeStackScreenProps<RootStackParamList, "Game">;

export const GameScreen: React.FC<Props> = ({ navigation }) => {
  const { showAlert } = useAppAlert();
  const {
    board,
    players,
    turnUserId,
    userId,
    status,
    result,
    turnDeadlineMs,
    joinCode,
    winnerUserId
  } = useGameStore();

  useEffect(() => {
    if (status === "finished") {
      navigation.replace("Result");
    }
  }, [status, navigation]);

  const myRole = players.find((p) => p.userId === userId)?.role ?? "?";
  const isMyTurn = turnUserId === userId;

  const onMove = async (index: number) => {
    try {
      await nakamaService.sendMove(index);
    } catch (error) {
      showAlert({ title: "Move rejected", message: String(error) });
    }
  };

  return (
    <View style={[commonStyles.screen, styles.container]}>
      {joinCode ? (
        <Text style={styles.roomCode}>Room code: {joinCode}</Text>
      ) : null}
      <Text style={commonStyles.body}>Your role: {myRole}</Text>
      <Text style={commonStyles.body}>Turn: {isMyTurn ? "You" : "Opponent"}</Text>
      <Countdown turnDeadlineMs={turnDeadlineMs} />
      <Board board={board} disabled={!isMyTurn || status !== "playing"} onCellPress={onMove} />
      {result ? (
        <Text style={commonStyles.body}>
          {matchOutcomeText(result, winnerUserId, userId, players)}
        </Text>
      ) : null}
      <AnimatedButton title="Back to Home" onPress={() => navigation.replace("Home")} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: "center", padding: 16, gap: 12 },
  roomCode: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 2,
    color: colors.playful
  }
});
