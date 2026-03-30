import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";
import { CellValue } from "../types/protocol";

interface BoardProps {
  board: CellValue[];
  disabled?: boolean;
  onCellPress: (index: number) => void;
}

export const Board: React.FC<BoardProps> = ({ board, disabled, onCellPress }) => (
  <View style={styles.grid}>
    {board.map((cell, index) => (
      <Pressable
        key={index}
        style={({ pressed }) => [styles.cell, pressed && !disabled && cell === "empty" && styles.cellPressed]}
        disabled={disabled || cell !== "empty"}
        onPress={() => onCellPress(index)}
      >
        <Text
          style={[
            styles.cellText,
            cell === "X" && styles.markX,
            cell === "O" && styles.markO
          ]}
        >
          {cell === "empty" ? "" : cell}
        </Text>
      </Pressable>
    ))}
  </View>
);

const styles = StyleSheet.create({
  grid: {
    width: 300,
    height: 300,
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: 1,
    borderColor: colors.buttonPrimaryBorder,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.accentSoft
  },
  cell: {
    width: "33.33%",
    height: "33.33%",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border
  },
  cellPressed: {
    backgroundColor: colors.surface2
  },
  cellText: {
    fontSize: 42,
    fontWeight: "700",
    color: colors.text
  },
  markX: {
    color: colors.markX
  },
  markO: {
    color: colors.markO
  }
});
