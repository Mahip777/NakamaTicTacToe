export type CellValue = "empty" | "X" | "O";
export type MatchMode = "classic" | "timed";
export type MatchStatus = "waiting" | "playing" | "finished";
export type MatchResult = "win" | "draw" | "forfeit";

export interface PlayerInfo {
  userId: string;
  username: string;
  role: "X" | "O";
  connected: boolean;
}

export interface MovePayload {
  cellIndex: number;
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

export interface StateSyncPayload {
  matchId: string;
  board: CellValue[];
  players: PlayerInfo[];
  turnUserId: string;
  moveNumber: number;
  mode: MatchMode;
  status: MatchStatus;
  timeLimitMs?: number;
  turnDeadlineMs?: number;
  result?: MatchResult;
  winnerUserId?: string;
  forfeitReason?: string;
}

export interface MatchEndPayload {
  board: CellValue[];
  status: "finished";
  result: MatchResult;
  winnerUserId?: string;
  forfeitReason?: string;
  moveNumber: number;
}

export interface MatchPlayerState {
  presence: nkruntime.Presence | null;
  userId: string;
  username: string;
  role: "X" | "O";
}

export interface TicTacToeMatchState extends nkruntime.MatchState {
  matchId?: string;
  mode: MatchMode;
  status: MatchStatus;
  board: CellValue[];
  players: Record<string, MatchPlayerState>;
  playerOrder: string[];
  turnUserId: string;
  moveNumber: number;
  tickRate: number;
  timeLimitMs: number;
  turnDeadlineMs: number;
  timeoutArmed: boolean;
  graceTicksRemaining: number;
  reconnectDeadlineByUser: Record<string, number>;
  reconnectWindowMs: number;
  result?: MatchResult;
  winnerUserId?: string;
  forfeitReason?: string;
}
