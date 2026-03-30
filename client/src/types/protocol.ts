export enum OpCode {
  MATCH_START = 1,
  STATE_UPDATE = 2,
  STATE_SYNC = 3,
  PLAYER_MOVE = 4,
  MATCH_END = 5
}

export type CellValue = "empty" | "X" | "O";
export type MatchMode = "classic" | "timed";
export type MatchStatus = "waiting" | "playing" | "finished";

export interface PlayerInfo {
  userId: string;
  username: string;
  role: "X" | "O";
  connected: boolean;
}

export interface MatchStartPayload {
  matchId: string;
  board: CellValue[];
  players: PlayerInfo[];
  turnUserId: string;
  moveNumber: number;
  mode: MatchMode;
  status: MatchStatus;
  timeLimitMs?: number;
  turnDeadlineMs?: number;
}

export interface StateUpdatePayload {
  board: CellValue[];
  turnUserId: string;
  moveNumber: number;
  status: MatchStatus;
  timeLimitMs?: number;
  turnDeadlineMs?: number;
}

export interface StateSyncPayload extends MatchStartPayload {
  result?: "win" | "draw" | "forfeit";
  winnerUserId?: string;
  forfeitReason?: string;
}

export interface MatchEndPayload {
  board: CellValue[];
  status: "finished";
  result: "win" | "draw" | "forfeit";
  winnerUserId?: string;
  forfeitReason?: string;
  moveNumber: number;
}
