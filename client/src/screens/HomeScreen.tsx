import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import { AnimatedButton } from "../components/AnimatedButton";
import { nakamaService } from "../services/nakama";
import { useGameStore } from "../store/useGameStore";
import { commonStyles } from "../theme/commonStyles";
import { colors } from "../theme/colors";
import { errorMessage } from "../utils/errorMessage";
import { useAppAlert } from "../context/AppAlertContext";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { showAlert } = useAppAlert();
  const [joinId, setJoinId] = useState("");
  const mode = useGameStore((s) => s.mode);
  const setMode = useGameStore((s) => s.setMode);
  const username = useGameStore((s) => s.username);

  const onPlayOnline = async () => {
    try {
      await nakamaService.addMatchmaker(mode);
      navigation.navigate("Matchmaking");
    } catch (error) {
      showAlert({ title: "Matchmaking failed", message: await errorMessage(error) });
    }
  };

  const alertShareRoomCode = (joinCode: string) => {
    showAlert({
      title: "Room created",
      message: (
        <View style={alertBodyStyles.wrap}>
          <Text style={alertBodyStyles.lead}>Share this room code with player 2:</Text>
          <Text style={alertBodyStyles.code}>{joinCode}</Text>
          <Text style={alertBodyStyles.tail}>They enter it on Home and tap Join room.</Text>
        </View>
      ),
      buttons: [{ text: "Play", onPress: () => navigation.navigate("Game"), variant: "primary" }]
    });
  };

  const onCreateRoom = async () => {
    try {
      const { matchId, joinCode } = await nakamaService.createPrivateMatch(mode);
      await nakamaService.joinMatchById(matchId, joinCode);
      alertShareRoomCode(joinCode);
    } catch (error) {
      showAlert({ title: "Create room failed", message: await errorMessage(error) });
    }
  };

  const onCreatePublicRoom = async () => {
    try {
      const { matchId, joinCode } = await nakamaService.createPublicMatch(mode);
      await nakamaService.joinMatchById(matchId, joinCode);
      alertShareRoomCode(joinCode);
    } catch (error) {
      showAlert({ title: "Create public room failed", message: await errorMessage(error) });
    }
  };

  const onDiscoverPublic = async () => {
    try {
      const matches = await nakamaService.listPublicMatches(20);
      if (!matches.length) {
        showAlert({ title: "No rooms", message: "No public rooms found." });
        return;
      }
      const first = matches[0];
      await nakamaService.joinMatchById(first.matchId, first.joinCode || "");
      navigation.navigate("Game");
    } catch (error) {
      showAlert({ title: "Discovery failed", message: await errorMessage(error) });
    }
  };

  const onJoinRoom = async () => {
    const raw = joinId.trim();
    if (!/^\d{4}$/.test(raw)) {
      showAlert({ title: "Join", message: "Enter a 4-digit room code (1000–9999)." });
      return;
    }
    try {
      const matchId = await nakamaService.resolveJoinCode(raw);
      await nakamaService.joinMatchById(matchId, raw);
      navigation.navigate("Game");
    } catch (error) {
      showAlert({ title: "Join failed", message: await errorMessage(error) });
    }
  };

  const displayName = username.trim() || "Guest";

  const onLogout = () => {
    showAlert({
      title: "Log out?",
      message: "You will return to the welcome screen and can choose a new name.",
      buttons: [
        { text: "Cancel", variant: "secondary" },
        {
          text: "Log out",
          variant: "destructive",
          onPress: () => {
            nakamaService.logout();
            navigation.replace("Login");
          }
        }
      ]
    });
  };

  return (
    <SafeAreaView style={commonStyles.screen} edges={["top", "left", "right"]}>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <Text style={commonStyles.title}>Home</Text>
        <Text style={styles.userLabel} numberOfLines={1}>
          {displayName}
        </Text>
      </View>
      <Text style={commonStyles.body}>Mode: {mode}</Text>
      <View style={styles.row}>
        <AnimatedButton
          title="Classic"
          variant="secondary"
          onPress={() => setMode("classic")}
          style={styles.rowBtn}
        />
        <AnimatedButton
          title="Timed"
          variant="secondary"
          onPress={() => setMode("timed")}
          style={styles.rowBtn}
        />
      </View>
      <AnimatedButton title="Play Online (Matchmaker)" onPress={onPlayOnline} />
      <AnimatedButton title="Create Public Room" onPress={onCreatePublicRoom} />
      <AnimatedButton title="Create Private Room" onPress={onCreateRoom} />
      <AnimatedButton title="Discover Public Room" onPress={onDiscoverPublic} />
      <TextInput
        placeholder="4-digit room code"
        placeholderTextColor={colors.textMuted}
        value={joinId}
        onChangeText={setJoinId}
        style={commonStyles.input}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="number-pad"
        maxLength={4}
      />
      <AnimatedButton title="Join room" onPress={onJoinRoom} />
      <AnimatedButton title="Leaderboard" onPress={() => navigation.navigate("Leaderboard")} />
      <AnimatedButton title="Log out" variant="secondary" onPress={onLogout} />
    </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, padding: 24, gap: 12, paddingBottom: 48 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    width: "100%"
  },
  userLabel: {
    flexShrink: 1,
    maxWidth: "55%",
    fontSize: 16,
    fontWeight: "600",
    color: colors.textMuted,
    textAlign: "right"
  },
  row: { flexDirection: "row", gap: 12 },
  rowBtn: { flex: 1 }
});

const alertBodyStyles = StyleSheet.create({
  wrap: { gap: 14 },
  lead: { color: colors.textMuted, fontSize: 16, lineHeight: 22 },
  code: {
    color: colors.playful,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 6,
    textAlign: "center"
  },
  tail: { color: colors.textMuted, fontSize: 15, lineHeight: 21 }
});
