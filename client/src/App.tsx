import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LoginScreen } from "./screens/LoginScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { MatchmakingScreen } from "./screens/MatchmakingScreen";
import { GameScreen } from "./screens/GameScreen";
import { ResultScreen } from "./screens/ResultScreen";
import { LeaderboardScreen } from "./screens/LeaderboardScreen";
import { AppAlertProvider } from "./context/AppAlertContext";
import { colors } from "./theme/colors";

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Matchmaking: undefined;
  Game: undefined;
  Result: undefined;
  Leaderboard: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const stackScreenOptions = {
  contentStyle: { backgroundColor: colors.background },
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.text,
  headerTitleStyle: { color: colors.text, fontWeight: "700" as const }
};

const App: React.FC = () => {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppAlertProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Login" screenOptions={stackScreenOptions}>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Matchmaking" component={MatchmakingScreen} />
          <Stack.Screen name="Game" component={GameScreen} />
          <Stack.Screen name="Result" component={ResultScreen} options={{ headerBackVisible: false }} />
          <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
        </Stack.Navigator>
      </NavigationContainer>
      </AppAlertProvider>
    </SafeAreaProvider>
  );
};

export default App;
