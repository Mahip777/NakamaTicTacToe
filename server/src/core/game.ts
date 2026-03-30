import { CellValue } from "./types";

const WIN_LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

export const createEmptyBoard = (): CellValue[] => Array.from({ length: 9 }, () => "empty");

export const isBoardFull = (board: CellValue[]): boolean => board.every((cell) => cell !== "empty");

export const checkWinner = (board: CellValue[]): "X" | "O" | null => {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] !== "empty" && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }

  return null;
};
