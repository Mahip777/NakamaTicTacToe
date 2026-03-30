import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import { AnimatedButton } from "../components/AnimatedButton";
import { useAppAlert } from "../context/AppAlertContext";
import { nakamaService } from "../services/nakama";
import { commonStyles } from "../theme/commonStyles";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { showAlert } = useAppAlert();
  const [username, setUsername] = useState(`guest_${Math.floor(Math.random() * 10000)}`);
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    try {
      setLoading(true);
      await nakamaService.authenticateGuest(username);
      await nakamaService.connectSocket();
      navigation.replace("Home");
    } catch (error) {
      showAlert({ title: "Login failed", message: String(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[commonStyles.screen, styles.container]}>
      <Text style={[commonStyles.title, styles.titleCenter]}>LILA Tic-Tac-Toe</Text>
      <TextInput
        value={username}
        onChangeText={setUsername}
        style={commonStyles.input}
        placeholder="Username"
        placeholderTextColor={colors.textMuted}
      />
      <AnimatedButton title={loading ? "Connecting..." : "Let's play"} onPress={onLogin} disabled={loading} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  titleCenter: { textAlign: "center" }
});
